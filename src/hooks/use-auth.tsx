"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from "sonner";
import { db } from '@/lib/firebase';
import * as userService from '@/services/userService';
import * as authService from '@/services/authService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  userData: any; 
  refreshUserData: () => Promise<void>;
  updateUserProfile: (data: Partial<{ displayName: string; budget: number; budgetIsSet: boolean }>) => Promise<void>;
  uploadAndSetProfileImage: (file: File) => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateUserEmail: (currentPassword: string, newEmail: string) => Promise<void>;
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
        if (error.code === 'permission-denied') {
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
    if (!auth?.currentUser) return;
    await fetchUserData(auth.currentUser);
  }, [fetchUserData]);

  useEffect(() => {
    if (!auth) {
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
  
  const updateUserProfile_ = async (data: Partial<{ displayName: string; budget: number; budgetIsSet: boolean }>) => {
    if (!user) throw new Error("User not authenticated.");
    await userService.updateUser(user.uid, data);
    await refreshUserData();
  };

  const uploadAndSetProfileImage_ = async (file: File) => {
    if (!user) throw new Error("User not authenticated.");
    const photoURL = await userService.uploadProfileImage(user.uid, file);
    await updateProfile(user, { photoURL });
    setUser({ ...user, photoURL }); // Force state update
    await refreshUserData();
  };

  const updateUserPassword_ = async (currentPassword: string, newPassword: string) => {
    if (!user) throw new Error("User not authenticated.");
    await authService.changePassword(currentPassword, newPassword);
  };

  const updateUserEmail_ = async (currentPassword: string, newEmail: string) => {
    if (!user) throw new Error("User not authenticated.");
    await authService.changeEmail(currentPassword, newEmail);
    // User object will update on next auth state change after email verification
    await refreshUserData();
  };

  const value = {
    user,
    loading,
    logout,
    userData,
    refreshUserData,
    updateUserProfile: updateUserProfile_,
    uploadAndSetProfileImage: uploadAndSetProfileImage_,
    updateUserPassword: updateUserPassword_,
    updateUserEmail: updateUserEmail_,
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
