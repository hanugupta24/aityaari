
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
console.log("%cFirebase Config Check (src/lib/firebase.ts):", "color: orange; font-weight: bold; font-size: 1.2em;");
console.log("Attempting to initialize Firebase with the following configuration:");
const configForTable = {
  apiKey: firebaseConfig.apiKey ? `********${firebaseConfig.apiKey.slice(-4)} (Loaded)` : 'MISSING or UNDEFINED',
  authDomain: firebaseConfig.authDomain || 'MISSING or UNDEFINED',
  projectId: firebaseConfig.projectId || 'MISSING or UNDEFINED',
  storageBucket: firebaseConfig.storageBucket || 'MISSING or UNDEFINED',
  messagingSenderId: firebaseConfig.messagingSenderId || 'MISSING or UNDEFINED',
  appId: firebaseConfig.appId || 'MISSING or UNDEFINED',
};
console.table(configForTable);

if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY" || firebaseConfig.apiKey === "YOUR_API_KEY_HERE_DO_NOT_COMMIT_THIS_PLACEHOLDER" || firebaseConfig.apiKey.includes("YOUR_") || firebaseConfig.apiKey.length < 10) {
  const errorMessage =
    "CRITICAL_FIREBASE_SETUP_ERROR: Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) appears to be MISSING, a PLACEHOLDER, or INVALID. " +
    "Please ensure it is correctly set in your .env file with the value from your Firebase project settings (Project settings > General > Your apps > Web app). " +
    "Then, RESTART your development server. The application WILL NOT WORK without a valid API key.";
  console.error("%c" + errorMessage, "color: red; font-weight: bold; font-size: 1.1em;");
  // Optionally, you could throw an error here in development to halt execution.
  // if (process.env.NODE_ENV === 'development') throw new Error(errorMessage);
} else if (!firebaseConfig.projectId) {
  console.error(
    "%cCRITICAL_FIREBASE_SETUP_ERROR: Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) is MISSING. " +
    "Please ensure it is correctly set in your .env file and the server is restarted.", "color: red; font-weight: bold; font-size: 1.1em;"
  );
} else {
  console.log("%cFirebase configuration seems to have necessary values. Attempting initialization...", "color: green;");
}
// --- END DIAGNOSTIC LOG ---

let app;
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    console.log("%cFirebase app initialized successfully.", "color: green; font-weight: bold;");
  } catch (error) {
    console.error("%cCRITICAL: Firebase initialization failed during initializeApp()!", "color: red; font-weight: bold; font-size: 1.1em;", error);
    // This error is crucial if initializeApp itself fails.
    throw error;
  }
} else {
  app = getApp();
  console.log("%cFirebase app already initialized.", "color: blue;");
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
