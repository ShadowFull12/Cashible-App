"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  userData: any; 
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (user: User) => {
    if (!db) return;
    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            setUserData(userDoc.data());
        } else {
            setUserData(null);
        }
    } catch (error: any) {
        console.error("Failed to fetch user data:", error);
        if (error.code === 'unavailable' || error.message.includes('offline')) {
             toast.error("Could not connect to the database. Please check your internet connection and ensure Firestore is enabled in your Firebase project.");
        } else if (error.code === 'permission-denied') {
            toast.error("Permission Denied", {
                description: "The app could not access user data. Please check your Firestore security rules in the Firebase Console."
            });
        } else {
            toast.error("An error occurred while fetching your data.");
        }
        setUserData(null);
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!auth || !db) return;
    const currentUser = auth.currentUser;
    if (currentUser) {
      await fetchUserData(currentUser);
    }
  }, [fetchUserData]);

  useEffect(() => {
    // If firebase is not configured, don't do anything
    if (!auth || !db) {
        setLoading(false);
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await fetchUserData(user);
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserData]);

  const logout = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  };

  const value = {
    user,
    loading,
    logout,
    userData,
    refreshUserData
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
