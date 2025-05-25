import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- BEGIN DIAGNOSTIC LOG ---
console.log("Firebase Config Check (src/lib/firebase.ts):");
console.log("Attempting to initialize Firebase with the following configuration:");
console.table({
  apiKey: firebaseConfig.apiKey ? `********${firebaseConfig.apiKey.slice(-4)}` : 'MISSING or UNDEFINED',
  authDomain: firebaseConfig.authDomain || 'MISSING or UNDEFINED',
  projectId: firebaseConfig.projectId || 'MISSING or UNDEFINED',
  storageBucket: firebaseConfig.storageBucket || 'MISSING or UNDEFINED',
  messagingSenderId: firebaseConfig.messagingSenderId || 'MISSING or UNDEFINED',
  appId: firebaseConfig.appId || 'MISSING or UNDEFINED',
});

if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY_HERE_DO_NOT_COMMIT_THIS_PLACEHOLDER" || firebaseConfig.apiKey === "YOUR_API_KEY") {
  const errorMessage =
    "CRITICAL_FIREBASE_SETUP_ERROR: Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is MISSING or is still a placeholder. " +
    "Please ensure it is correctly set in your .env file with the value from your Firebase project settings (Project settings > General > Your apps > Web app). Then, restart your development server. The application WILL NOT WORK without a valid API key.";
  console.error(errorMessage);
  // Optionally, you could throw an error here to halt execution if the key is obviously a placeholder
  // throw new Error(errorMessage);
} else if (!firebaseConfig.projectId) {
  console.error(
    "CRITICAL_FIREBASE_SETUP_ERROR: Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) is MISSING. " +
    "Please ensure it is correctly set in your .env file and the server is restarted."
  );
} else {
  console.log("Firebase configuration seems to have values. Attempting initialization...");
}
// --- END DIAGNOSTIC LOG ---

let app;
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    console.log("Firebase app initialized successfully.");
  } catch (error) {
    console.error("CRITICAL: Firebase initialization failed!", error);
    // It's crucial to see this error if initialization itself fails.
    // This might indicate a fundamentally malformed config object,
    // though "auth/configuration-not-found" usually means the call to Firebase services fails later.
    throw error; 
  }
} else {
  app = getApp();
  console.log("Firebase app already initialized.");
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };