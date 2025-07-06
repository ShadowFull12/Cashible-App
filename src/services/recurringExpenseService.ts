import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, Timestamp, writeBatch, WriteBatch } from "firebase/firestore";
import type { RecurringExpense } from "@/lib/data";
import { deleteTransactionsByRecurringId } from "./transactionService";

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

export async function deleteRecurringExpenseAndHistory(userId: string, id: string) {
    if (!db) throw new Error("Firebase is not configured.");
    try {
        // This transaction pattern ensures that both operations succeed or fail together.
        const batch = writeBatch(db);
        
        // First, delete all historical transactions linked to this recurring expense
        await deleteTransactionsByRecurringId(userId, id, batch);
        
        // Then, delete the recurring expense document itself
        const recurringExpenseRef = doc(db, "recurring-expenses", id);
        batch.delete(recurringExpenseRef);
        
        await batch.commit();

    } catch (error) {
        console.error(`Error permanently deleting recurring expense ${id} and its history:`, error);
        throw error;
    }
}

// Used for batch deleting all of a user's data
export async function addRecurringExpensesDeletionsToBatch(userId: string, batch: WriteBatch) {
    if (!db) return;
    const q = query(collection(db, "recurring-expenses"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
}
