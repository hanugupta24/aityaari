
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// import { getStorage } from "firebase/storage"; // No longer storing resume files in Firebase Storage

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- BEGIN DIAGNOSTIC LOG ---
console.log("Firebase Config being used by the app:", {
  apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 4)}...` : 'MISSING_OR_UNDEFINED', // Show only a snippet for security
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
});

if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY_HERE_DO_NOT_COMMIT_THIS_PLACEHOLDER") {
  const errorMessage =
    "CRITICAL_FIREBASE_SETUP_ERROR: Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is MISSING or is still the placeholder 'YOUR_API_KEY_HERE_DO_NOT_COMMIT_THIS_PLACEHOLDER'. " +
    "You MUST create an API key in your Google Cloud Console for the Firebase project '" + (firebaseConfig.projectId || 'UNKNOWN_PROJECT') + "', " +
    "restrict it (HTTP referrers and API restrictions for Identity Toolkit API & Token Service API), " +
    "and set it in your .env file. Then, restart your development server. The application WILL NOT WORK without a valid API key.";
  console.error(errorMessage);
  // In a client-side environment, you might throw an error or display this to the user more visibly.
  // For now, the console error is the primary feedback.
  // throw new Error(errorMessage); // Optionally throw to halt execution
}

if (!firebaseConfig.projectId) {
  console.error(
    "CRITICAL_FIREBASE_SETUP_ERROR: Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) is MISSING. " +
    "Please ensure it is correctly set in your .env file and the server is restarted."
  );
}
// --- END DIAGNOSTIC LOG ---

let app;
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (error) {
    console.error("CRITICAL: Firebase initialization failed!", error);
    throw error; // Re-throw to make it clear initialization failed
  }
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
// const storage = getStorage(app); // Not using Firebase Storage for resumes

export { app, auth, db };
