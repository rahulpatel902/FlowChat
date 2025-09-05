import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  where,
  serverTimestamp,
  getDocs,
  setDoc
} from 'firebase/firestore';
import { db, firebaseAuthReady } from './config';
import { PRESENCE_TTL_MS, RECOMPUTE_INTERVAL_MS } from '../constants/presence';

// Message operations
export const sendMessage = async (roomId, messageData) => {
  try {
    await firebaseAuthReady;
    const messagesRef = collection(db, `chat_rooms_${roomId}`);
    const docRef = await addDoc(messagesRef, {
      ...messageData,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Fetch latest single message (no listener) for sidebar preview
export const getLastMessage = async (roomId) => {
  await firebaseAuthReady;
  const messagesRef = collection(db, `chat_rooms_${roomId}`);
  const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
  const snap = await getDocs(q);
  let last = null;
  snap.forEach((docSnap) => {
    last = { id: docSnap.id, ...docSnap.data() };
  });
  return last; // may be null
};

export const subscribeToMessages = (roomId, callback, limitCount = 50) => {
  const start = async () => {
    await firebaseAuthReady;
    const messagesRef = collection(db, `chat_rooms_${roomId}`);
    const q = query(
      messagesRef,
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    return onSnapshot(q, (snapshot) => {
      const messages = [];
      snapshot.forEach((doc) => {
        messages.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(messages.reverse()); // Reverse to show oldest first
    });
  };
  // Kick off without blocking caller; return a no-op unsubscribe until ready
  const unsub = { current: () => {} };
  start().then((u) => (unsub.current = u)).catch(console.error);
  return () => {
    if (typeof unsub.current === 'function') unsub.current();
  };
};

export const updateMessage = async (roomId, messageId, updates) => {
  try {
    const messageRef = doc(db, `chat_rooms_${roomId}`, messageId);
    await updateDoc(messageRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating message:', error);
    throw error;
  }
};

export const deleteMessage = async (roomId, messageId) => {
  try {
    const messageRef = doc(db, `chat_rooms_${roomId}`, messageId);
    await deleteDoc(messageRef);
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
};

// Typing indicators
export const updateTypingStatus = async (roomId, userId, isTyping) => {
  try {
    await firebaseAuthReady;
    const typingRef = doc(db, `typing_${roomId}`, userId.toString());
    if (isTyping) {
      await setDoc(
        typingRef,
        {
          isTyping: true,
          timestamp: serverTimestamp()
        },
        { merge: true }
      );
    } else {
      await deleteDoc(typingRef);
    }
  } catch (error) {
    console.error('Error updating typing status:', error);
  }
};

export const subscribeToTyping = (roomId, callback) => {
  const start = async () => {
    await firebaseAuthReady;
    const typingRef = collection(db, `typing_${roomId}`);
    return onSnapshot(typingRef, (snapshot) => {
      const typingUsers = [];
      snapshot.forEach((doc) => {
        typingUsers.push({
          userId: doc.id,
          ...doc.data()
        });
      });
      callback(typingUsers);
    });
  };
  const unsub = { current: () => {} };
  start().then((u) => (unsub.current = u)).catch(console.error);
  return () => {
    if (typeof unsub.current === 'function') unsub.current();
  };
};

// Read receipts
export const markMessageAsRead = async (roomId, messageId, userId) => {
  try {
    await firebaseAuthReady;
    const readReceiptRef = doc(db, `read_receipts_${roomId}_${messageId}`, userId.toString());
    await setDoc(
      readReceiptRef,
      { readAt: serverTimestamp() },
      { merge: true }
    );
  } catch (error) {
    console.error('Error marking message as read:', error);
  }
};

export const subscribeToReadReceipts = (roomId, messageId, callback) => {
  const start = async () => {
    await firebaseAuthReady;
    const readReceiptsRef = collection(db, `read_receipts_${roomId}_${messageId}`);
    return onSnapshot(readReceiptsRef, (snapshot) => {
      const readReceipts = [];
      snapshot.forEach((doc) => {
        readReceipts.push({
          userId: doc.id,
          ...doc.data()
        });
      });
      callback(readReceipts);
    });
  };
  const unsub = { current: () => {} };
  start().then((u) => (unsub.current = u)).catch(console.error);
  return () => {
    if (typeof unsub.current === 'function') unsub.current();
  };
};

// Online status
export const updateOnlineStatus = async (userId, isOnline) => {
  try {
    await firebaseAuthReady;
    const statusRef = doc(db, 'user_status', userId.toString());
    // Use setDoc with merge to create if missing and update if exists
    await setDoc(
      statusRef,
      {
        isOnline,
        lastSeen: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error updating online status:', error);
  }
};

export const subscribeToOnlineStatus = (userIds, callback) => {
  const start = async () => {
    await firebaseAuthReady;
    const statusRef = collection(db, 'user_status');

    // If no users, emit empty map and return a no-op unsubscribe
    if (!Array.isArray(userIds) || userIds.length === 0) {
      callback({});
      return () => {};
    }

    // Helper to chunk arrays to Firestore 'in' max of 10
    const chunk = (arr, size) => {
      const out = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    const idStrings = userIds.map((id) => id.toString());
    const chunks = chunk(idStrings, 10);

    // Keep latest snapshot data so we can recompute freshness on a timer
    const latest = new Map(); // id -> raw data

    const emitComputed = () => {
      const now = Date.now();
      const TTL_MS = PRESENCE_TTL_MS; // centralized TTL
      const statuses = {};
      idStrings.forEach((key) => {
        const data = latest.get(key) || {};
        const hasLastSeen = typeof data?.lastSeen?.toMillis === 'function';
        const lastSeenMs = hasLastSeen ? data.lastSeen.toMillis() : 0;
        // Handle clock skew by clamping negative deltas to 0
        const age = hasLastSeen ? Math.max(0, now - lastSeenMs) : 0;
        // If lastSeen hasn't resolved yet (immediately after a write with serverTimestamp),
        // assume freshness when isOnline is true to avoid flashing Offline until next snapshot.
        const fresh = hasLastSeen ? age < TTL_MS : (data?.isOnline === true);
        const computedOnline = data?.isOnline === true && fresh;
        statuses[key] = {
          ...data,
          isOnline: computedOnline,
          lastSeen: data?.lastSeen || null,
        };
      });
      callback(statuses);
    };

    // Subscribe to each chunk and merge results
    const unsubs = chunks.map((ids) => {
      const q = query(statusRef, where('__name__', 'in', ids));
      return onSnapshot(q, (snapshot) => {
        snapshot.forEach((doc) => {
          latest.set(doc.id, doc.data());
        });
        emitComputed();
      });
    });

    // Periodically recompute so stale users flip to Offline even without new snapshots
    const intervalId = setInterval(emitComputed, RECOMPUTE_INTERVAL_MS); // every 10s

    return () => {
      clearInterval(intervalId);
      unsubs.forEach((u) => { if (typeof u === 'function') u(); });
    };
  };
  const unsub = { current: () => {} };
  start().then((u) => (unsub.current = u)).catch(console.error);
  return () => {
    if (typeof unsub.current === 'function') unsub.current();
  };
};
