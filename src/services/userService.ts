
import { db } from "@/lib/firebase";
import { doc, updateDoc, writeBatch, collection, query, where, getDocs, limit } from "firebase/firestore";
import { defaultCategories } from "@/lib/data";
import { addTransactionsDeletionsToBatch } from "./transactionService";
import { addRecurringExpensesDeletionsToBatch } from "./recurringExpenseService";
import type { UserProfile } from "@/lib/data";


export async function updateUser(userId: string, data: object) {
    if (!db) throw new Error("Firestore is not initialized.");
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, data);
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
            photoURL: data.photoURL,
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

    const batch = writeBatch(db);

    // 1. Delete all transactions
    await addTransactionsDeletionsToBatch(userId, batch);
    
    // 2. Delete all recurring expenses
    await addRecurringExpensesDeletionsToBatch(userId, batch);

    // 3. Reset the user document to its default state
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
