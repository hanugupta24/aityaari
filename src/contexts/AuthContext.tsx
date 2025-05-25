
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
      setLoading(false); 
      return;
    }

    console.log(`AuthContext: Attempting to fetch profile for UID: ${fbUser.uid}`);
    setLoading(true); 
    try {
      const userDocRef = doc(db, "users", fbUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      console.log(`AuthContext: getDoc completed for UID: ${fbUser.uid}. Exists: ${userDocSnap.exists()}`);

      if (userDocSnap.exists()) {
        const profileData = userDocSnap.data() as UserProfile;
        setUserProfile(profileData);
        // Prioritize the isAdmin boolean field. Fallback to role if isAdmin is not defined.
        if (typeof profileData.isAdmin === 'boolean') {
          setIsAdmin(profileData.isAdmin);
          console.log(`AuthContext: Admin status set from 'isAdmin' field: ${profileData.isAdmin}`);
        } else if (profileData.role === "admin") { // Fallback for older setups, though isAdmin is preferred
          setIsAdmin(true);
          console.log("AuthContext: Admin status set from 'role' field (isAdmin field missing).");
        } else {
          setIsAdmin(false);
          console.log("AuthContext: User is not an admin based on profile data.");
        }
        console.log(`AuthContext: Profile loaded for UID: ${fbUser.uid}`, profileData);
      } else {
        setUserProfile(null);
        setIsAdmin(false); // Ensure isAdmin is false if profile doesn't exist
        console.warn(`AuthContext: User profile document not found for UID: ${fbUser.uid}`);
      }
    } catch (error: any) {
      console.error(`AuthContext: Error fetching user profile for UID: ${fbUser.uid}. Message: ${error.message}, Code: ${error.code}`, error);
      setUserProfile(null);
      setIsAdmin(false); // Ensure isAdmin is false on error
    } finally {
      console.log(`AuthContext: fetchUserProfile finally block for UID: ${fbUser?.uid}. Setting profile loading to false.`);
      setLoading(false); 
    }
  }, []);

  useEffect(() => {
    console.log("AuthContext: Mounting and setting up onAuthStateChanged listener.");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("AuthContext: onAuthStateChanged triggered. User:", firebaseUser ? firebaseUser.uid : 'null');
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          console.log("AuthContext: Firebase user detected, calling fetchUserProfile.");
          await fetchUserProfile(firebaseUser);
        } else {
          console.log("AuthContext: No Firebase user. Clearing user, profile, admin status, and profile loading state.");
          setUser(null);
          setUserProfile(null);
          setIsAdmin(false);
          setLoading(false); 
        }
      } catch (error) {
         console.error("AuthContext: Critical error during onAuthStateChanged processing:", error);
         setUser(null);
         setUserProfile(null);
         setIsAdmin(false);
         setLoading(false);
      } finally {
        setInitialLoading(false);
        console.log("AuthContext: initialLoading set to false after auth state processing. User:", !!user, "Profile Loaded:", !!userProfile, "isAdmin:", isAdmin, "Profile Fetch Loading:", loading);
      }
    });

    return () => {
      console.log("AuthContext: Unmounting and unsubscribing from onAuthStateChanged.");
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUserProfile]); 

  const signOut = async () => {
    console.log("AuthContext: signOut called.");
    setLoading(true); 
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
    setIsAdmin(false);
    setLoading(false);
    setInitialLoading(false); 
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
