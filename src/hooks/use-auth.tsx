
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { 
    User, 
    onAuthStateChanged, 
    signOut as firebaseSignOut, 
    updateProfile, 
    deleteUser as firebaseDeleteUser,
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    getIdTokenResult
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from "sonner";
import * as userService from '@/services/userService';
import * as authService from '@/services/authService';
import type { BusinessProfile } from '@/lib/data';

export type AccountType = 'personal' | 'business';

interface UserData {
  uid: string;
  displayName: string;
  email: string;
  username?: string;
  categories: any[];
  budget: number;
  budgetIsSet: boolean;
  photoURL?: string;
  primaryColor?: string;
  businessProfile?: BusinessProfile;
  accountType: AccountType;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userData: UserData | null; 
  isSettingUsername: boolean;
  isChoosingAccountType: boolean;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  updateUserProfile: (data: Partial<UserData>) => Promise<void>;
  uploadAndSetProfileImage: (file: File) => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateUserEmail: (currentPassword: string, newEmail: string) => Promise<void>;
  updateUserUsername: (currentPassword: string, newUsername: string) => Promise<void>;
  reauthenticateWithPassword: (password: string) => Promise<void>;
  deleteAllUserData: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  signInWithEmail: (emailOrUsername: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  completeInitialSetup: (username: string) => Promise<void>;
  completeAccountTypeChoice: (type: AccountType) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSettingUsername, setIsSettingUsername] = useState(false);
  const [isChoosingAccountType, setIsChoosingAccountType] = useState(false);

  const fetchUserData = useCallback(async (user: User) => {
    if (!db) return;
    try {
        let userDocRef = doc(db, 'users', user.uid);
        let userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            setUserData(data);
            if (!data.username) {
                setIsSettingUsername(true);
                setIsChoosingAccountType(false);
            } else if (!data.accountType) {
                setIsSettingUsername(false);
                setIsChoosingAccountType(true);
            } else {
                setIsSettingUsername(false);
                setIsChoosingAccountType(false);
            }
        }
    } catch (error: any) {
        console.error("Failed to fetch user data:", error);
        toast.error("An error occurred while fetching your data.");
        setUserData(null);
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!auth?.currentUser) return;
    await fetchUserData(auth.currentUser);
  }, [fetchUserData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!auth) {
        console.error("Firebase Auth is not initialized. This is likely due to missing environment variables on your deployment platform.");
        setLoading(false);
        return;
      }
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          await fetchUserData(currentUser);
        } else {
          setUserData(null);
          setIsSettingUsername(false);
          setIsChoosingAccountType(false);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, [fetchUserData]);

  const logout = useCallback(async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
    setUserData(null);
    setUser(null);
  }, []);
  
  const signInWithEmail = useCallback(async (emailOrUsername: string, password: string) => {
    if (!auth) throw new Error("Firebase not configured.");
    let emailToLogin = emailOrUsername;
    if (!emailOrUsername.includes('@')) {
        const userProfile = await userService.getUserByUsername(emailOrUsername);
        if (userProfile?.email) {
          emailToLogin = userProfile.email;
        } else {
          throw new Error("User not found with that username or email.");
        }
    }
    const userCredential = await signInWithEmailAndPassword(auth, emailToLogin, password);
    await fetchUserData(userCredential.user);
  }, [fetchUserData]);

  const signUpWithEmail = useCallback(async (email: string, password: string, displayName: string) => {
    if (!auth) throw new Error("Firebase not configured.");
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await updateProfile(user, { displayName });
    await userService.createInitialUserDocument(user, displayName);
    await fetchUserData(user);
    setIsSettingUsername(true);
  }, [fetchUserData]);

  const completeInitialSetup = useCallback(async (username: string) => {
    if (!user) throw new Error("User not authenticated.");
    try {
        await userService.setUsernameForNewUser(user.uid, username);
        await refreshUserData();
        setIsSettingUsername(false);
        setIsChoosingAccountType(true);
    } catch(error) {
        throw error;
    }
  }, [user, refreshUserData]);
  
  const completeAccountTypeChoice = useCallback(async (type: AccountType) => {
      if (!user) throw new Error("User not authenticated.");
      try {
          await updateUserProfile({ accountType: type });
          setIsChoosingAccountType(false);
          await refreshUserData();
      } catch(error) {
           throw error;
      }
  }, [user, refreshUserData]);

  const updateUserProfile = useCallback(async (data: Partial<UserData>) => {
    if (!user) throw new Error("User not authenticated.");
    const { displayName, photoURL, ...otherData } = data;
    const profileDataToPropagate: { displayName?: string, photoURL?: string | null } = {};
    const authUpdateData: { displayName?: string, photoURL?: string | null } = {};
    if (displayName !== undefined) {
        profileDataToPropagate.displayName = displayName; authUpdateData.displayName = displayName;
    }
    if (photoURL !== undefined) {
        profileDataToPropagate.photoURL = photoURL; authUpdateData.photoURL = photoURL;
    }
    if (Object.keys(profileDataToPropagate).length > 0) {
        await userService.updateUserProfileAndPropagate(user.uid, profileDataToPropagate);
        await updateProfile(user, authUpdateData);
    }
    if (Object.keys(otherData).length > 0) {
        await userService.updateUser(user.uid, otherData);
    }
    await refreshUserData();
  }, [user, refreshUserData]);

  const uploadAndSetProfileImage = useCallback(async (file: File) => {
      if (!process.env.NEXT_PUBLIC_IMGBB_API_KEY) {
        toast.error("Image upload is not configured.");
        return;
      }
      const newPhotoURL = await userService.uploadProfileImage(file);
      await updateUserProfile({ photoURL: newPhotoURL });
  }, [updateUserProfile]);
  
  const updateUserPassword = useCallback(async (currentPassword: string, newPassword: string) => {
      await authService.changePassword(currentPassword, newPassword);
  }, []);
  
  const updateUserEmail = useCallback(async (currentPassword: string, newEmail: string) => {
      await authService.changeEmail(currentPassword, newEmail);
      await refreshUserData();
  }, [refreshUserData]);

  const updateUserUsername = useCallback(async (currentPassword: string, newUsername: string) => {
      if (!user || !userData?.username) throw new Error("User data not found.");
      await authService.reauthenticate(currentPassword);
      await userService.updateUsernameAndPropagate(user.uid, userData.username, newUsername);
      await refreshUserData();
  }, [user, userData, refreshUserData]);

  const reauthenticateWithPassword = useCallback(async (password: string) => {
      await authService.reauthenticate(password);
  }, []);

  const deleteAllUserData = useCallback(async () => {
      if (!user) throw new Error("User not authenticated.");
      await userService.deleteAllUserData(user.uid);
      await updateProfile(user, { photoURL: null });
      await refreshUserData();
  }, [user, refreshUserData]);
  
  const deleteAccount = useCallback(async () => {
      if (!user) throw new Error("User not authenticated.");
      await userService.deleteAllUserData(user.uid);
      await firebaseDeleteUser(user);
  }, [user]);

  const value: AuthContextType = {
    user, loading, userData, isSettingUsername, isChoosingAccountType, logout, refreshUserData,
    updateUserProfile, uploadAndSetProfileImage,
    updateUserPassword, updateUserEmail, updateUserUsername, reauthenticateWithPassword,
    deleteAllUserData, deleteAccount,
    signInWithEmail, signUpWithEmail,
    completeInitialSetup, completeAccountTypeChoice,
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
