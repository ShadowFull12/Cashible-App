
import { db } from "@/lib/firebase";
import { doc, updateDoc, writeBatch, collection, query, where, getDocs, limit, deleteDoc, getDoc } from "firebase/firestore";
import { defaultCategories } from "@/lib/data";
import { addTransactionsDeletionsToBatch } from "./transactionService";
import { addRecurringExpensesDeletionsToBatch } from "./recurringExpenseService";
import { leaveCircle } from "./circleService";
import type { UserProfile } from "@/lib/data";
import { addNotificationsDeletionsToBatch } from "./notificationService";
import { addFriendRequestsDeletionsToBatch } from "./friendService";
import { addAllUserSettlementsDeletionsToBatch } from "./debtService";

export async function updateUser(userId: string, data: object) {
    if (!db) throw new Error("Firestore is not initialized.");
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, data);
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
    if (!db) throw new Error("Firestore is not initialized.");
    if (!/^[a-zA-Z0-9_]{3,15}$/.test(username)) {
        throw new Error("Username must be 3-15 characters long and can only contain letters, numbers, and underscores.");
    }
    const usernameRef = doc(db, "usernames", username.toLowerCase());
    const docSnap = await getDoc(usernameRef);
    return !docSnap.exists();
}

export async function getUserByUsername(username: string): Promise<UserProfile | null> {
    if (!db) throw new Error("Firestore is not initialized.");
    const usernameRef = doc(db, "usernames", username.toLowerCase());
    const usernameSnap = await getDoc(usernameRef);

    if (!usernameSnap.exists()) return null;

    const { uid } = usernameSnap.data();
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return null; // Data inconsistency
    const data = userSnap.data();
    return {
        uid: data.uid,
        displayName: data.displayName,
        email: data.email,
        photoURL: data.photoURL || null,
        username: data.username,
    };
}


/**
 * Updates a user's profile information (displayName, photoURL) and propagates
 * those changes to denormalized data in other collections like 'friendships' and 'circles'.
 */
export async function updateUserProfileAndPropagate(userId: string, data: { displayName?: string, photoURL?: string | null }) {
    if (!db) throw new Error("Firestore is not initialized.");
    
    const batch = writeBatch(db);

    const userDocRef = doc(db, "users", userId);
    batch.update(userDocRef, data);

    const updateForPropagation: {[key: string]: any} = {};
    if (data.displayName !== undefined) updateForPropagation.displayName = data.displayName;
    if (data.photoURL !== undefined) updateForPropagation.photoURL = data.photoURL;

    const updateUserInDoc = async (docSnap: any, fieldPrefix: string) => {
        if (docSnap.exists()) {
            const docData = docSnap.data();
            const userObject = docData[fieldPrefix][userId];
            if(userObject) {
                 batch.update(docSnap.ref, {
                    [`${fieldPrefix}.${userId}`]: { ...userObject, ...updateForPropagation }
                });
            }
        }
    };

    const friendshipQuery = query(collection(db, "friendships"), where("userIds", "array-contains", userId));
    const friendshipDocs = await getDocs(friendshipQuery);
    friendshipDocs.forEach(doc => updateUserInDoc(doc, 'users'));

    const circleQuery = query(collection(db, "circles"), where("memberIds", "array-contains", userId));
    const circleDocs = await getDocs(circleQuery);
    circleDocs.forEach(doc => updateUserInDoc(doc, 'members'));
    
    await batch.commit();
}

export async function updateUsernameAndPropagate(userId: string, oldUsername: string | undefined, newUsername: string) {
    if (!db) throw new Error("Firestore is not initialized.");

    const newUsernameLower = newUsername.toLowerCase();
    
    if (oldUsername && newUsername.toLowerCase() === oldUsername.toLowerCase()) {
        return;
    }

    if (!/^[a-zA-Z0-9_]{3,15}$/.test(newUsername)) {
        throw new Error("Username must be 3-15 characters long (letters, numbers, _).");
    }

    const isAvailable = await isUsernameAvailable(newUsername);
    if (!isAvailable) {
        throw new Error(`Username "${newUsername}" is already taken.`);
    }

    const batch = writeBatch(db);

    if (oldUsername) {
        const oldUsernameRef = doc(db, "usernames", oldUsername.toLowerCase());
        batch.delete(oldUsernameRef);
    }

    const newUsernameRef = doc(db, "usernames", newUsernameLower);
    batch.set(newUsernameRef, { uid: userId });

    const userDocRef = doc(db, "users", userId);
    batch.update(userDocRef, { username: newUsernameLower });
    
    await batch.commit();
}


export async function searchUsers(searchTerm: string): Promise<UserProfile[]> {
    if (!db) throw new Error("Firestore is not initialized.");
    const lowerCaseTerm = searchTerm.toLowerCase();

    const userByUsername = await getUserByUsername(lowerCaseTerm);
    if (userByUsername) {
        return [userByUsername];
    }

    const emailQuery = query(collection(db, "users"), where("email", "==", searchTerm), limit(10));
    const emailSnapshot = await getDocs(emailQuery);
    
    const users: UserProfile[] = [];
    emailSnapshot.forEach((doc) => {
        const data = doc.data();
        users.push({
            uid: data.uid,
            displayName: data.displayName,
            email: data.email,
            photoURL: data.photoURL || null,
            username: data.username,
        });
    });
    
    return users;
}

export async function uploadProfileImage(file: File): Promise<string> {
    const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
    if (!apiKey) {
        throw new Error("ImgBB API key is not configured. Please add it to your .env.local file.");
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();
        
        if (!response.ok) {
            console.error("ImgBB API Error - Non-OK response:", { 
                status: response.status, 
                statusText: response.statusText,
                body: result 
            });
             throw new Error(result?.error?.message || `Failed to upload image. Server responded with ${response.status}.`);
        }
        
        if (!result.success) {
            console.error("ImgBB API Error - Success False:", result);
            throw new Error(result?.error?.message || "Upload failed due to a generic API error.");
        }

        return result.data.url;
    } catch (error) {
        console.error("Error during image upload fetch/parse:", error);
        if (error instanceof Error) {
           throw error;
        }
        throw new Error("An unknown network error occurred during image upload.");
    }
}

export async function deleteAllUserData(userId: string) {
    if (!db) throw new Error("Firestore is not initialized.");

    const userDoc = await getDoc(doc(db, "users", userId));
    const username = userDoc.data()?.username;

    // 1. Leave all circles
    const circleQuery = query(collection(db, "circles"), where("memberIds", "array-contains", userId));
    const circleDocs = await getDocs(circleQuery);
    await Promise.all(circleDocs.docs.map(doc => leaveCircle(doc.id, userId)));

    // 2. Remove all friendships
    const friendshipQuery = query(collection(db, "friendships"), where("userIds", "array-contains", userId));
    const friendshipDocs = await getDocs(friendshipQuery);
    const friendshipBatch = writeBatch(db);
    friendshipDocs.forEach(doc => friendshipBatch.delete(doc.ref));
    await friendshipBatch.commit();
    
    // 3. Delete all other user-specific data in a single batch
    const batch = writeBatch(db);

    await addTransactionsDeletionsToBatch(userId, batch);
    await addRecurringExpensesDeletionsToBatch(userId, batch);
    await addNotificationsDeletionsToBatch(userId, batch);
    await addFriendRequestsDeletionsToBatch(userId, batch);
    await addAllUserSettlementsDeletionsToBatch(userId, batch);
    
    if (username) {
        const usernameRef = doc(db, "usernames", username);
        batch.delete(usernameRef);
    }

    const userDocRef = doc(db, "users", userId);
    batch.update(userDocRef, {
        budget: 0,
        budgetIsSet: false,
        photoURL: null,
        categories: defaultCategories,
        primaryColor: '181 95% 45%',
    });

    await batch.commit();
}
