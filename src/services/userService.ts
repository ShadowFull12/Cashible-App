
import { db } from "@/lib/firebase";
import { doc, updateDoc, writeBatch, collection, query, where, getDocs, limit, deleteDoc } from "firebase/firestore";
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

/**
 * Updates a user's profile information (displayName, photoURL) and propagates
 * those changes to denormalized data in other collections like 'friendships' and 'circles'.
 * This is a client-side implementation of data propagation. For larger applications,
 * a Cloud Function would be more robust.
 */
export async function updateUserProfileAndPropagate(userId: string, data: { displayName?: string, photoURL?: string | null }) {
    if (!db) throw new Error("Firestore is not initialized.");
    
    const batch = writeBatch(db);

    // 1. Update the main user document
    const userDocRef = doc(db, "users", userId);
    batch.update(userDocRef, data);

    // 2. Find and update all friendships this user is a part of
    const friendshipQuery = query(collection(db, "friendships"), where("userIds", "array-contains", userId));
    const friendshipDocs = await getDocs(friendshipQuery);
    friendshipDocs.forEach(doc => {
        const updateData: { [key: string]: any } = {};
        if (data.displayName !== undefined) {
            updateData[`users.${userId}.displayName`] = data.displayName;
        }
        if (data.photoURL !== undefined) {
            updateData[`users.${userId}.photoURL`] = data.photoURL;
        }
        if (Object.keys(updateData).length > 0) {
            batch.update(doc.ref, updateData);
        }
    });

    // 3. Find and update all circles this user is a member of
    const circleQuery = query(collection(db, "circles"), where("memberIds", "array-contains", userId));
    const circleDocs = await getDocs(circleQuery);
    circleDocs.forEach(doc => {
        const updateData: { [key: string]: any } = {};
            if (data.displayName !== undefined) {
            updateData[`members.${userId}.displayName`] = data.displayName;
        }
        if (data.photoURL !== undefined) {
            updateData[`members.${userId}.photoURL`] = data.photoURL;
        }
        if (Object.keys(updateData).length > 0) {
            batch.update(doc.ref, updateData);
        }
    });
    
    await batch.commit();
}


export async function searchUsersByEmail(email: string): Promise<UserProfile[]> {
    if (!db) throw new Error("Firestore is not initialized.");
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email), limit(10));
    const querySnapshot = await getDocs(q);
    const users: UserProfile[] = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        users.push({
            uid: data.uid,
            displayName: data.displayName,
            email: data.email,
            photoURL: data.photoURL || null,
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
