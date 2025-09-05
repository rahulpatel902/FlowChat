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
  serverTimestamp,
  getDocs,
  setDoc
} from 'firebase/firestore';
import { db, firebaseAuthReady } from './config';

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

