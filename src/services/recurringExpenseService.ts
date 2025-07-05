
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import type { RecurringExpense } from "@/lib/data";

export async function addRecurringExpense(expense: Omit<RecurringExpense, 'id'>) {
    if (!db) throw new Error("Firebase is not configured.");
    try {
        const docRef = await addDoc(collection(db, "recurring-expenses"), {
            ...expense,
            lastProcessed: expense.lastProcessed ? Timestamp.fromDate(expense.lastProcessed) : null,
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding recurring expense:', error);
        throw error;
    }
}

export async function getRecurringExpenses(userId: string): Promise<RecurringExpense[]> {
    if (!db) return [];
    try {
        const q = query(collection(db, "recurring-expenses"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        const expenses: RecurringExpense[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            expenses.push({
                id: doc.id,
                ...data,
                lastProcessed: data.lastProcessed ? (data.lastProcessed as Timestamp).toDate() : null,
            } as RecurringExpense);
        });
        return expenses;
    } catch (error) {
        console.error(`Error getting recurring expenses for user ${userId}:`, error);
        throw error;
    }
}

export async function updateRecurringExpense(id: string, data: Partial<RecurringExpense>) {
    if (!db) throw new Error("Firebase is not configured.");
    const docRef = doc(db, "recurring-expenses", id);
    const updateData: any = { ...data };
    if (data.lastProcessed) {
        updateData.lastProcessed = Timestamp.fromDate(data.lastProcessed);
    }
    await updateDoc(docRef, updateData);
}

export async function deleteRecurringExpense(id: string) {
    if (!db) throw new Error("Firebase is not configured.");
    try {
        await deleteDoc(doc(db, "recurring-expenses", id));
    } catch (error) {
        console.error(`Error deleting recurring expense ${id}:`, error);
        throw error;
    }
}
