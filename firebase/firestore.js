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
  getDocs
} from 'firebase/firestore';
import { db } from './config';

// Message operations
export const sendMessage = async (roomId, messageData) => {
  try {
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

export const subscribeToMessages = (roomId, callback, limitCount = 50) => {
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

// Fetch latest single message (no listener)
export const getLastMessage = async (roomId) => {
  const messagesRef = collection(db, `chat_rooms_${roomId}`);
  const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
  const snap = await getDocs(q);
  let last = null;
  snap.forEach((docSnap) => {
    last = { id: docSnap.id, ...docSnap.data() };
  });
  return last; // may be null
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
    const typingRef = doc(db, `typing_${roomId}`, userId.toString());
    if (isTyping) {
      await updateDoc(typingRef, {
        isTyping: true,
        timestamp: serverTimestamp()
      });
    } else {
      await deleteDoc(typingRef);
    }
  } catch (error) {
    console.error('Error updating typing status:', error);
  }
};

export const subscribeToTyping = (roomId, callback) => {
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

// Read receipts
export const markMessageAsRead = async (roomId, messageId, userId) => {
  try {
    const readReceiptRef = doc(db, `read_receipts_${roomId}_${messageId}`, userId.toString());
    await updateDoc(readReceiptRef, {
      readAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
  }
};

export const subscribeToReadReceipts = (roomId, messageId, callback) => {
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

// Online status
export const updateOnlineStatus = async (userId, isOnline) => {
  try {
    const statusRef = doc(db, 'user_status', userId.toString());
    await updateDoc(statusRef, {
      isOnline,
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating online status:', error);
  }
};

export const subscribeToOnlineStatus = (userIds, callback) => {
  const statusRef = collection(db, 'user_status');
  const q = query(statusRef, where('__name__', 'in', userIds.map(id => id.toString())));
  
  return onSnapshot(q, (snapshot) => {
    const statuses = {};
    snapshot.forEach((doc) => {
      statuses[doc.id] = doc.data();
    });
    callback(statuses);
  });
};
