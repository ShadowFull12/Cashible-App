
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, Timestamp, writeBatch } from "firebase/firestore";
import type { Transaction } from "@/lib/data";

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'date'> & { date: Date | Timestamp }) {
    if (!db) throw new Error("Firebase is not configured.");
    try {
        const docRef = await addDoc(collection(db, "transactions"), {
            userId: transaction.userId,
            description: transaction.description,
            amount: transaction.amount,
            category: transaction.category,
            date: transaction.date instanceof Date ? Timestamp.fromDate(transaction.date) : transaction.date,
            recurringExpenseId: transaction.recurringExpenseId || null,
        });
        return docRef.id;
    } catch (error: any) {
        console.error('Error adding transaction:', error);
        // Provide a more specific error message for permission issues
        if (error.code === 'permission-denied') {
            throw new Error("Permission Denied: Could not add transaction. Please check Firestore security rules.");
        }
        throw error;
    }
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
    if (!db) return [];
    try {
        const q = query(collection(db, "transactions"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        const transactions: Transaction[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            transactions.push({
                id: doc.id,
                ...data,
                date: (data.date as Timestamp).toDate(),
            } as Transaction);
        });
        return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
        console.error(`Error getting transactions for user ${userId}:`, error);
        throw error;
    }
}

export async function deleteTransaction(transactionId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    try {
        await deleteDoc(doc(db, "transactions", transactionId));
    } catch (error) {
        console.error(`Error deleting transaction ${transactionId}:`, error);
        throw error;
    }
}

export async function deleteTransactionsByRecurringId(recurringExpenseId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    
    const q = query(collection(db, "transactions"), where("recurringExpenseId", "==", recurringExpenseId));
    
    try {
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log("No transactions found for this recurring expense, nothing to delete.");
            return;
        }

        const batch = writeBatch(db);
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log(`Successfully deleted ${querySnapshot.size} historical transactions.`);
    } catch (error) {
        console.error(`Error deleting transactions for recurring expense ${recurringExpenseId}:`, error);
        throw error;
    }
}
