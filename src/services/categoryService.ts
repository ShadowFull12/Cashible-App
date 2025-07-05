import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { defaultCategories } from "@/lib/data";

export async function getCategories(userId: string) {
    if (!db) return [];
    try {
        const userDocRef = doc(db, "users", userId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const data = userDoc.data();
            return data.categories || defaultCategories;
        }
        return defaultCategories;
    } catch (error) {
        console.error(`Error getting categories for user ${userId}:`, error);
        throw error;
    }
}

export async function addCategory(userId: string, category: { name: string; color: string }) {
    if (!db) throw new Error("Firebase is not configured.");
    try {
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, {
            categories: arrayUnion(category)
        });
        return category;
    } catch (error) {
        console.error(`Error adding category for user ${userId}:`, error);
        throw error;
    }
}

export async function updateCategory(userId: string, categoryName: string, newColor: string) {
    if (!db) throw new Error("Firebase is not configured.");
    const userDocRef = doc(db, "users", userId);
    try {
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const categories = userData.categories || [];
            
            const categoryIndex = categories.findIndex((c: any) => c.name === categoryName);
            
            if (categoryIndex !== -1) {
                const newCategories = [...categories];
                newCategories[categoryIndex] = { ...newCategories[categoryIndex], color: newColor };
                
                await updateDoc(userDocRef, {
                    categories: newCategories
                });
            } else {
                throw new Error(`Category "${categoryName}" not found.`);
            }
        }
    } catch (error) {
        console.error(`Error updating category for user ${userId}:`, error);
        throw error;
    }
}

export async function deleteCategory(userId: string, category: { name: string; color: string }) {
    if (!db) throw new Error("Firebase is not configured.");
    try {
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, {
            categories: arrayRemove(category)
        });
    } catch (error) {
        console.error(`Error deleting category for user ${userId}:`, error);
        throw error;
    }
}
