
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
  loading: boolean;
  initialLoading: boolean;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);

  const fetchUserProfile = useCallback(async (fbUser: FirebaseUser | null) => {
    if (!fbUser) {
      setUserProfile(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const userDocRef = doc(db, "users", fbUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const profileData = userDocSnap.data() as UserProfile;
        setUserProfile(profileData);
        setIsAdmin(profileData.role === "admin");
      } else {
        // Profile might not exist yet (e.g., right after signup before profile page)
        // Or if Firestore rules prevent access, or other error.
        // Check if it's a new user by looking at metadata (optional refinement)
        // For now, if doc doesn't exist, profile is null.
        setUserProfile(null);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setUserProfile(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setInitialLoading(true); // Set initial loading true at the start of auth change
      setUser(firebaseUser);
      await fetchUserProfile(firebaseUser);
      setInitialLoading(false); // Initial load complete after user and profile fetch attempt
    });

    return () => unsubscribe();
  }, [fetchUserProfile]);

  const signOut = async () => {
    setLoading(true);
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
    setIsAdmin(false);
    setLoading(false);
  };

  const refreshUserProfile = useCallback(async () => {
    if (user) {
      await fetchUserProfile(user);
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
