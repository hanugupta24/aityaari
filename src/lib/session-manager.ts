import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Generate a unique session ID using crypto API
 */
export function generateSessionId(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback: generate a random UUID v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get a device fingerprint based on user agent
 * Note: This is NOT browser-specific, it's device-level
 */
export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") {
    return "server-side";
  }

  const userAgent = window.navigator.userAgent;
  
  // Simple hash function for the user agent
  let hash = 0;
  for (let i = 0; i < userAgent.length; i++) {
    const char = userAgent.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `device_${Math.abs(hash).toString(16)}`;
}

/**
 * Create a new session for a user
 * This will overwrite any existing session in Firestore
 */
export async function createSession(userId: string): Promise<string> {
  console.log(`[SessionManager] Creating new session for user: ${userId}`);
  
  const sessionId = generateSessionId();
  const deviceInfo = getDeviceFingerprint();
  const now = new Date().toISOString();

  try {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, {
      activeSessionId: sessionId,
      sessionDeviceInfo: deviceInfo,
      sessionStartTime: now,
      sessionLastActive: now,
    });

    // Store session ID in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("sessionId", sessionId);
    }

    console.log(`[SessionManager] Session created successfully: ${sessionId}`);
    return sessionId;
  } catch (error) {
    console.error("[SessionManager] Error creating session:", error);
    throw error;
  }
}

/**
 * Validate if the local session matches the Firestore session
 * Returns true if valid, false if session mismatch
 */
export async function validateSession(
  userId: string,
  localSessionId: string | null
): Promise<boolean> {
  if (!localSessionId) {
    console.log("[SessionManager] No local session ID found");
    return false;
  }

  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      console.log("[SessionManager] User document not found");
      return false;
    }

    const userData = userDoc.data();
    const activeSessionId = userData.activeSessionId;

    if (!activeSessionId) {
      console.log("[SessionManager] No active session in Firestore");
      return false;
    }

    const isValid = activeSessionId === localSessionId;
    
    if (!isValid) {
      console.log(
        `[SessionManager] Session mismatch. Local: ${localSessionId}, Firestore: ${activeSessionId}`
      );
    } else {
      console.log("[SessionManager] Session validated successfully");
      
      // Update last active timestamp
      const now = new Date().toISOString();
      await updateDoc(userDocRef, {
        sessionLastActive: now,
      });
    }

    return isValid;
  } catch (error) {
    console.error("[SessionManager] Error validating session:", error);
    // On error, assume session is invalid to be safe
    return false;
  }
}

/**
 * Invalidate/clear session data from Firestore
 */
export async function invalidateSession(userId: string): Promise<void> {
  console.log(`[SessionManager] Invalidating session for user: ${userId}`);

  try {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, {
      activeSessionId: null,
      sessionDeviceInfo: null,
      sessionStartTime: null,
      sessionLastActive: null,
    });

    // Clear from localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("sessionId");
    }

    console.log("[SessionManager] Session invalidated successfully");
  } catch (error) {
    console.error("[SessionManager] Error invalidating session:", error);
    throw error;
  }
}

/**
 * Get the local session ID from localStorage
 */
export function getLocalSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem("sessionId");
}

