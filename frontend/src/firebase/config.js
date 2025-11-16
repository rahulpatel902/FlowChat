import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

// Your Firebase configuration
// Replace these values with your actual Firebase project configuration
// EXAMPLE - Replace with your actual config from Firebase Console
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "your-api-key-here",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "flowchat-final4.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "flowchat-final4",
  // storageBucket is no longer used for media (Cloudinary handles files now),
  // but we keep the field for compatibility with the Firebase project.
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "flowchat-final4.appspot.com",
  // IMPORTANT: Specify RTDB URL so SDK connects to the correct regional instance
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || undefined,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "your-sender-id",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "your-app-id",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "your-measurement-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services (no Storage; media handled by Cloudinary via Django API)
export const db = getFirestore(app);
export const auth = getAuth(app);
// If databaseURL is provided, pass it explicitly to ensure correct region
export const rtdb = getDatabase(app, process.env.REACT_APP_FIREBASE_DATABASE_URL);
export const firebaseAuthReady = new Promise((resolve) => {
  const unsub = onAuthStateChanged(auth, () => {
    resolve();
    unsub();
  });
});

// Connect to emulators in development
if (process.env.NODE_ENV === 'development') {
  // Uncomment these lines if you want to use Firebase emulators
  // connectFirestoreEmulator(db, 'localhost', 8080);
  // connectStorageEmulator(storage, 'localhost', 9199);
  // connectAuthEmulator(auth, 'http://localhost:9099');
}

// No automatic anonymous sign-in; the app will sign in with a custom token from the backend

export default app;
