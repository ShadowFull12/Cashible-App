import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { defaultCategories } from "@/lib/data";

export async function getCategories(userId: string) {
    if (!db) return [];
    console.log(`Attempting to get categories for user: ${userId}`);
    try {
        const userDocRef = doc(db, "users", userId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const data = userDoc.data();
            console.log(`Successfully fetched categories for user: ${userId}`);
            return data.categories || defaultCategories;
        }
        console.log(`No custom categories found for user: ${userId}, returning default.`);
        return defaultCategories;
    } catch (error) {
        console.error(`Error getting categories for user ${userId}:`, error);
        throw error;
    }
}

export async function addCategory(userId: string, category: { name: string; color: string }) {
    if (!db) throw new Error("Firebase is not configured.");
    console.log(`Attempting to add category "${category.name}" for user: ${userId}`);
    try {
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, {
            categories: arrayUnion(category)
        });
        console.log(`Successfully added category "${category.name}" for user: ${userId}`);
        return category;
    } catch (error) {
        console.error(`Error adding category for user ${userId}:`, error);
        throw error;
    }
}

export async function deleteCategory(userId: string, category: { name: string; color: string }) {
    if (!db) throw new Error("Firebase is not configured.");
    console.log(`Attempting to delete category "${category.name}" for user: ${userId}`);
    try {
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, {
            categories: arrayRemove(category)
        });
        console.log(`Successfully deleted category "${category.name}" for user: ${userId}`);
    } catch (error) {
        console.error(`Error deleting category for user ${userId}:`, error);
        throw error;
    }
}
