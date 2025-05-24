
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc, DocumentData } from "firebase/firestore";
import type { UserProfile } from "@/types";

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean; // For user profile fetching specifically
  initialLoading: boolean; // For initial auth state resolution
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false); // Profile fetch loading
  const [initialLoading, setInitialLoading] = useState<boolean>(true); // Auth state loading

  const fetchUserProfile = useCallback(async (fbUser: FirebaseUser | null) => {
    if (!fbUser) {
      console.log("AuthContext: fetchUserProfile called with no Firebase user. Clearing profile.");
      setUserProfile(null);
      setIsAdmin(false);
      // setLoading(false); // This loading is for profile fetch, managed below
      return;
    }

    console.log(`AuthContext: Attempting to fetch profile for UID: ${fbUser.uid}`);
    setLoading(true); // Indicate profile fetch is starting
    try {
      const userDocRef = doc(db, "users", fbUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      console.log(`AuthContext: getDoc completed for UID: ${fbUser.uid}. Exists: ${userDocSnap.exists()}`);

      if (userDocSnap.exists()) {
        const profileData = userDocSnap.data() as UserProfile;
        setUserProfile(profileData);
        setIsAdmin(profileData.role === "admin");
        console.log(`AuthContext: Profile loaded for UID: ${fbUser.uid}`, profileData);
      } else {
        setUserProfile(null);
        setIsAdmin(false);
        console.warn(`AuthContext: User profile document not found for UID: ${fbUser.uid}`);
      }
    } catch (error: any) {
      console.error(`AuthContext: Error fetching user profile for UID: ${fbUser.uid}. Message: ${error.message}, Code: ${error.code}`, error);
      setUserProfile(null);
      setIsAdmin(false);
    } finally {
      console.log(`AuthContext: fetchUserProfile finally block for UID: ${fbUser.uid}. Setting profile loading to false.`);
      setLoading(false); // Indicate profile fetch is complete (success or fail)
    }
  }, []);

  useEffect(() => {
    console.log("AuthContext: Mounting and setting up onAuthStateChanged listener.");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("AuthContext: onAuthStateChanged triggered. User:", firebaseUser ? firebaseUser.uid : 'null');
      setInitialLoading(true); // Mark that we are processing auth state
      setUser(firebaseUser);

      if (firebaseUser) {
        console.log("AuthContext: Firebase user detected, calling fetchUserProfile.");
        await fetchUserProfile(firebaseUser);
        console.log("AuthContext: fetchUserProfile call completed (or errored).");
      } else {
        console.log("AuthContext: No Firebase user. Clearing profile, admin status, and profile loading state.");
        setUserProfile(null);
        setIsAdmin(false);
        setLoading(false); // Ensure profile-specific loading is also false
      }
      setInitialLoading(false); // Mark auth state processing as complete
      console.log("AuthContext: initialLoading set to false. Current states: user loaded:", !!user, "profile loaded:", !!userProfile, "profile fetch loading:", loading);
    });

    return () => {
      console.log("AuthContext: Unmounting and unsubscribing from onAuthStateChanged.");
      unsubscribe();
    };
  }, [fetchUserProfile]); // user, loading, initialLoading removed from deps as they cause loops or are set inside

  const signOut = async () => {
    console.log("AuthContext: signOut called.");
    setLoading(true); // Can indicate a general loading state for sign out
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
    setIsAdmin(false);
    setLoading(false);
    setInitialLoading(false); // After sign out, initial auth state is resolved (no user)
    console.log("AuthContext: SignOut complete.");
  };

  const refreshUserProfile = useCallback(async () => {
    if (user) {
      console.log("AuthContext: refreshUserProfile called for user:", user.uid);
      await fetchUserProfile(user);
    } else {
      console.log("AuthContext: refreshUserProfile called but no user is logged in.");
    }
  }, [user, fetchUserProfile]);

  return (
    <AuthContext.Provider value={{ user, userProfile, isAdmin, loading, initialLoading, signOut, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
