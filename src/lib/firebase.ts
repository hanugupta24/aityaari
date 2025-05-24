
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Re-added storage

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- BEGIN DIAGNOSTIC LOG ---
console.log("Firebase Config being used by the app:", firebaseConfig);

if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
  console.error(
    "CRITICAL: Firebase API Key is MISSING or is still the placeholder 'YOUR_API_KEY'. " +
    "Please ensure NEXT_PUBLIC_FIREBASE_API_KEY is correctly set in your .env file with your actual Firebase Web API Key and the server is restarted."
  );
}

if (!firebaseConfig.projectId) {
  console.error(
    "CRITICAL: Firebase Project ID is MISSING. " +
    "Please ensure NEXT_PUBLIC_FIREBASE_PROJECT_ID is correctly set in your .env file and the server is restarted."
  );
}
// --- END DIAGNOSTIC LOG ---

let app;
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (error) {
    console.error("CRITICAL: Firebase initialization failed!", error);
    throw error;
  }
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Re-added storage

export { app, auth, db, storage }; // Re-added storage
