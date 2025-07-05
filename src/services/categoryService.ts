'use server';

import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { defaultCategories } from "@/lib/data";

export async function getCategories(userId: string) {
    if (!db) return []; // Gracefully handle missing config
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
        const data = userDoc.data();
        return data.categories || defaultCategories;
    }
    return defaultCategories;
}

export async function addCategory(userId: string, category: { name: string; color: string }) {
    if (!db) throw new Error("Firebase is not configured.");
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, {
        categories: arrayUnion(category)
    });
    return category;
}

export async function deleteCategory(userId: string, category: { name: string; color: string }) {
    if (!db) throw new Error("Firebase is not configured.");
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, {
        categories: arrayRemove(category)
    });
}
