
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { 
    User, 
    onAuthStateChanged, 
    signOut as firebaseSignOut, 
    updateProfile, 
    deleteUser as firebaseDeleteUser, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword 
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
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
          await userService.createInitialUserDocForGoogle(user);
          userDoc = await getDoc(userDocRef);
        }

        if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            setUserData(data);
            if (!data.username) {
                setIsSettingUsername(true);
            }
        } else {
            setUserData(null);
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
    if (!auth) {
        setLoading(false);
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);
      if (currentUser) {
        await fetchUserData(currentUser);
      } else {
        setUserData(null);
        setIsSettingUsername(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserData]);

  const logout = useCallback(async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
    // onAuthStateChanged will handle the rest
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
    await signInWithEmailAndPassword(auth, emailToLogin, password);
    // onAuthStateChanged will handle the rest
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) throw new Error("Firebase not configured.");
    setGoogleAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        // onAuthStateChanged will handle the rest
    } catch (error: any) {
        if (error.code === 'auth/popup-closed-by-user') {
            console.warn("Google sign-in popup closed by user.");
            toast.info("Sign-in cancelled.");
            return;
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            setGoogleAuthError("An account already exists with this email address. Please sign in with your original method to link it.");
            toast.error("Account already exists", { description: "This email is linked to another sign-in method." });
        } else {
            setGoogleAuthError(error.message || "An unknown error occurred during Google sign-in.");
            toast.error("Google Sign-In Failed", { description: error.message });
        }
        throw error;
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, displayName: string, username: string) => {
    if (!auth) throw new Error("Firebase not configured.");
    
    const usernameAvailable = await userService.isUsernameAvailable(username);
    if (!usernameAvailable) {
      throw new Error(`Username "${username}" is already taken.`);
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await updateProfile(user, { displayName });
    await userService.createInitialUserDocument(user, username, displayName);
    // onAuthStateChanged will handle the rest
  }, []);

  const completeInitialSetup = useCallback(async (username: string) => {
    if (!user) throw new Error("User not authenticated.");
    await userService.setUsernameForNewUser(user.uid, username);
    await refreshUserData();
    setIsSettingUsername(false);
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
      await updateUserProfile({ photoURL: await userService.uploadProfileImage(file) });
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
    user, loading, userData, isSettingUsername, googleAuthError, logout, refreshUserData,
    updateUserProfile, uploadAndSetProfileImage,
    updateUserPassword, updateUserEmail, updateUserUsername, reauthenticateWithPassword,
    deleteAllUserData, deleteAccount,
    signInWithEmail, signInWithGoogle, signUpWithEmail,
    completeInitialSetup,
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
