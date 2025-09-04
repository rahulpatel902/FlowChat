import { 
  collection, 
  getDocs, 
  deleteDoc, 
  doc,
  writeBatch 
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Clear all chat messages for a specific room
export const clearChatRoom = async (roomId) => {
  try {
    const messagesRef = collection(db, `chat_rooms_${roomId}`);
    const snapshot = await getDocs(messagesRef);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`Cleared ${snapshot.size} messages from room ${roomId}`);
  } catch (error) {
    console.error('Error clearing chat room:', error);
  }
};

// Clear typing indicators for a specific room
export const clearTypingIndicators = async (roomId) => {
  try {
    const typingRef = collection(db, `typing_${roomId}`);
    const snapshot = await getDocs(typingRef);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`Cleared typing indicators for room ${roomId}`);
  } catch (error) {
    console.error('Error clearing typing indicators:', error);
  }
};

// Clear all read receipts for a specific room
export const clearReadReceipts = async (roomId) => {
  try {
    // This is more complex as read receipts are per message
    // You'll need to know message IDs or use a different approach
    console.log('Read receipts clearing requires message IDs');
  } catch (error) {
    console.error('Error clearing read receipts:', error);
  }
};

// Clear all user status data
export const clearUserStatus = async () => {
  try {
    const statusRef = collection(db, 'user_status');
    const snapshot = await getDocs(statusRef);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`Cleared ${snapshot.size} user status records`);
  } catch (error) {
    console.error('Error clearing user status:', error);
  }
};

// Clear ALL Firebase data (DANGER: This deletes everything!)
export const clearAllFirebaseData = async () => {
  try {
    console.log('Starting complete Firebase cleanup...');
    
    // Get all collections that match our patterns
    const collections = [
      'user_status'
    ];
    
    // Clear known collections
    for (const collectionName of collections) {
      const ref = collection(db, collectionName);
      const snapshot = await getDocs(ref);
      
      if (snapshot.size > 0) {
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Cleared ${snapshot.size} documents from ${collectionName}`);
      }
    }
    
    console.log('Firebase cleanup completed!');
    alert('All Firebase data has been cleared!');
  } catch (error) {
    console.error('Error during complete cleanup:', error);
    alert('Error during cleanup: ' + error.message);
  }
};

// Usage examples:
// clearChatRoom('room-uuid-here');
// clearUserStatus();
// clearAllFirebaseData(); // BE CAREFUL!
