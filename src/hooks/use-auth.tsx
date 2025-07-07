
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut, updateProfile, deleteUser as firebaseDeleteUser, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { toast } from "sonner";
import * as userService from '@/services/userService';
import * as authService from '@/services/authService';

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
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userData: UserData | null; 
  isSettingUsername: boolean;
  googleAuthError: string | null;
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
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string, username: string) => Promise<void>;
  completeInitialSetup: (username: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSettingUsername, setIsSettingUsername] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);

  const fetchUserData = useCallback(async (user: User) => {
    if (!db) return;
    try {
        let userDocRef = doc(db, 'users', user.uid);
        let userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          // This handles new Google Sign-In users
          await userService.createInitialUserDocForGoogle(user);
          userDoc = await getDoc(userDocRef); // Re-fetch the doc after creation
        }

        if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            setUserData(data);
        } else {
            setUserData(null);
        }
    } catch (error: any) {
        console.error("Failed to fetch user data:", error);
        if (error.code === 'permission-denied') {
            toast.error("Permission Denied", { description: "The app could not access user data." });
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
      setLoading(false); // Make UI interactive faster
      if (user) {
        await fetchUserData(user);
      } else {
        setUserData(null);
        setIsSettingUsername(false);
      }
    });
    return () => unsubscribe();
  }, [fetchUserData]);

  useEffect(() => {
    // Trigger username modal if user is loaded but has no username
    if (user && userData && !userData.username && !isSettingUsername) {
        setIsSettingUsername(true);
    }
  }, [user, userData, isSettingUsername]);

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
  };
  
  const completeInitialSetup_ = async (username: string) => {
    if (!user) throw new Error("User not authenticated.");
    await userService.setUsernameForNewUser(user.uid, username);
    await refreshUserData();
    setIsSettingUsername(false);
  }
  
  const signInWithEmail_ = async (emailOrUsername: string, password: string) => {
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
    await signInWithEmailAndPassword(auth, emailToLogin, password);
  }

  const signUpWithEmail_ = async (email: string, password: string, displayName: string, username: string) => {
    if (!auth) throw new Error("Firebase not configured.");
    
    const usernameAvailable = await userService.isUsernameAvailable(username);
    if (!usernameAvailable) {
      throw new Error(`Username "${username}" is already taken.`);
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await updateProfile(user, { displayName });
    await user.getIdToken(true); // Force token refresh
    await userService.createInitialUserDocument(user, username);
  }

  const signInWithGoogle_ = async () => {
    if (!auth) throw new Error("Firebase not configured.");
    setGoogleAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch(error: any) {
        if (error.code === 'auth/account-exists-with-different-credential') {
            setGoogleAuthError("An account already exists with this email address. Please sign in with your original method to link your Google account.");
            toast.error("Account already exists", { description: "Please sign in with your original method first."});
        } else {
             setGoogleAuthError(error.message || "An unknown error occurred during Google sign-in.");
             toast.error("Google Sign-In Failed", { description: error.message });
        }
        throw error;
    }
  }

  const uploadAndSetProfileImage_ = async (file: File) => { await updateUserProfile_({ photoURL: await userService.uploadProfileImage(file) }); };
  const updateUserPassword_ = async (currentPassword: string, newPassword: string) => { await authService.changePassword(currentPassword, newPassword); };
  const reauthenticateWithPassword_ = async (password: string) => { await authService.reauthenticate(password); }
  const deleteAllUserData_ = async () => { if (!user) throw new Error("User not authenticated."); await userService.deleteAllUserData(user.uid); await updateProfile(user, { photoURL: null }); await refreshUserData(); }
  const deleteAccount_ = async () => { if (!user) throw new Error("User not authenticated."); await userService.deleteAllUserData(user.uid); await firebaseDeleteUser(user); }
  const updateUserEmail_ = async (currentPassword: string, newEmail: string) => { await authService.changeEmail(currentPassword, newEmail); await refreshUserData(); };
  const updateUserUsername_ = async (currentPassword: string, newUsername: string) => { if (!user || !userData) throw new Error("User data not found."); await authService.reauthenticate(currentPassword); await userService.updateUsernameAndPropagate(user.uid, userData.username, newUsername); await refreshUserData(); };

  const value: AuthContextType = {
    user, loading, userData, isSettingUsername, googleAuthError, logout, refreshUserData,
    updateUserProfile: updateUserProfile_, uploadAndSetProfileImage: uploadAndSetProfileImage_,
    updateUserPassword: updateUserPassword_, updateUserEmail: updateUserEmail_,
    updateUserUsername: updateUserUsername_, reauthenticateWithPassword: reauthenticateWithPassword_,
    deleteAllUserData: deleteAllUserData_, deleteAccount: deleteAccount_,
    signInWithEmail: signInWithEmail_, signInWithGoogle: signInWithGoogle_, signUpWithEmail: signUpWithEmail_,
    completeInitialSetup: completeInitialSetup_,
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
