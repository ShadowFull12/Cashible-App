
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut, updateProfile, deleteUser as firebaseDeleteUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { toast } from "sonner";
import { db } from '@/lib/firebase';
import * as userService from '@/services/userService';
import * as authService from '@/services/authService';
import { defaultCategories } from '@/lib/data';


interface UserData {
  uid: string;
  displayName: string;
  email: string;
  categories: any[];
  budget: number;
  budgetIsSet: boolean;
  photoURL?: string;
  primaryColor?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  userData: UserData | null; 
  refreshUserData: () => Promise<void>;
  updateUserProfile: (data: Partial<UserData>) => Promise<void>;
  uploadAndSetProfileImage: (file: File) => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateUserEmail: (currentPassword: string, newEmail: string) => Promise<void>;
  reauthenticateWithPassword: (password: string) => Promise<void>;
  deleteAllUserData: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (user: User) => {
    if (!db) return;
    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            let data = userDoc.data() as UserData;
            
            // Soft migration for new default categories
            const existingCategoryNames = new Set(data.categories.map((c: any) => c.name));
            const categoriesToAdd = defaultCategories.filter(
                (dc) => !existingCategoryNames.has(dc.name)
            );

            if (categoriesToAdd.length > 0) {
                await updateDoc(userDocRef, {
                    categories: arrayUnion(...categoriesToAdd)
                });
                // Re-fetch to get the fresh data after update
                const updatedUserDoc = await getDoc(userDocRef);
                if (updatedUserDoc.exists()) {
                  data = updatedUserDoc.data() as UserData;
                }
            }
            setUserData(data);
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
  
  const updateUserProfile_ = async (data: Partial<UserData>) => {
    if (!user) throw new Error("User not authenticated.");

    const { displayName, photoURL, ...otherData } = data;
    const profileDataToPropagate: { displayName?: string, photoURL?: string | null } = {};
    const authUpdateData: { displayName?: string, photoURL?: string | null } = {};

    if (displayName !== undefined) {
        profileDataToPropagate.displayName = displayName;
        authUpdateData.displayName = displayName;
    }
    if (photoURL !== undefined) {
        profileDataToPropagate.photoURL = photoURL;
        authUpdateData.photoURL = photoURL;
    }

    // Propagate profile changes if there are any
    if (Object.keys(profileDataToPropagate).length > 0) {
        await userService.updateUserProfileAndPropagate(user.uid, profileDataToPropagate);
        await updateProfile(user, authUpdateData);
    }

    // Update other user data that doesn't need propagation (like budget)
    if (Object.keys(otherData).length > 0) {
        await userService.updateUser(user.uid, otherData);
    }

    await refreshUserData();
  };

  const uploadAndSetProfileImage_ = async (file: File) => {
    if (!user) throw new Error("User not authenticated.");
    const photoURL = await userService.uploadProfileImage(file);
    // This will now call the new propagation logic via updateUserProfile_
    await updateUserProfile_({ photoURL });
  };

  const updateUserPassword_ = async (currentPassword: string, newPassword: string) => {
    if (!user) throw new Error("User not authenticated.");
    await authService.changePassword(currentPassword, newPassword);
  };

  const updateUserEmail_ = async (currentPassword: string, newEmail: string) => {
    if (!user) throw new Error("User not authenticated.");
    await authService.changeEmail(currentPassword, newEmail);
    await refreshUserData();
  };

  const reauthenticateWithPassword_ = async (password: string) => {
      if (!user) throw new Error("User not authenticated.");
      await authService.reauthenticate(password);
  }

  const deleteAllUserData_ = async () => {
      if (!user) throw new Error("User not authenticated.");
      await userService.deleteAllUserData(user.uid);
      await updateProfile(user, { photoURL: null });
      await refreshUserData();
  }

  const deleteAccount_ = async () => {
      if (!user) throw new Error("User not authenticated.");
      await userService.deleteAllUserData(user.uid);
      await firebaseDeleteUser(user);
  }

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
    reauthenticateWithPassword: reauthenticateWithPassword_,
    deleteAllUserData: deleteAllUserData_,
    deleteAccount: deleteAccount_,
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
