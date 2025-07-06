import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, Timestamp, writeBatch, updateDoc, WriteBatch } from "firebase/firestore";
import type { Transaction, SplitDetails } from "@/lib/data";
import { addDebtCreationToBatch } from "./debtService";

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
            isSplit: false,
            circleId: null,
        });
        return docRef.id;
    } catch (error: any) {
        console.error('Error adding transaction:', error);
        if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission-denied'))) {
            throw new Error("Permission Denied: Could not add transaction. This is likely a Firestore Security Rules issue.");
        }
        throw error;
    }
}

export async function addSplitTransaction(
    transaction: Omit<Transaction, 'id' | 'date'> & { date: Date | Timestamp }, 
    splitDetails: SplitDetails
) {
    if (!db) throw new Error("Firebase is not configured.");
    
    try {
        const batch = writeBatch(db);

        // This ID will represent the entire financial event.
        const eventId = doc(collection(db, "debts")).id;
        let transactionRefId: string;

        // The creator of the entry (transaction.userId) must be the payer
        // to have permission to create the transaction document.
        if (transaction.userId === splitDetails.payerId) {
             const transactionRef = doc(db, "transactions", eventId);
             batch.set(transactionRef, {
                ...transaction,
                date: transaction.date instanceof Date ? Timestamp.fromDate(transaction.date) : transaction.date,
                recurringExpenseId: null,
             });
             transactionRefId = transactionRef.id;
        } else {
            // If someone else paid, we don't create a transaction document for the creator.
            // We just use the generated ID to link the debts together.
            transactionRefId = eventId;
        }

        // Create all the debt documents, linking them with the event ID
        addDebtCreationToBatch(batch, transactionRefId, splitDetails, transaction.circleId || null, transaction.description);
        
        // Commit the batch
        await batch.commit();

        return transactionRefId;

    } catch (error: any) {
        console.error('Error adding split transaction:', error);
         if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission-denied'))) {
            throw new Error("Permission Denied: Could not add split transaction. This is likely a Firestore Security Rules issue.");
        }
        throw error;
    }
}

export async function updateTransaction(transactionId: string, data: Partial<Omit<Transaction, 'id' | 'userId'>>) {
    if (!db) throw new Error("Firebase is not configured.");
    const docRef = doc(db, "transactions", transactionId);
    
    const dataToUpdate: any = { ...data };
    if (data.date) {
        dataToUpdate.date = Timestamp.fromDate(data.date);
    }
    
    await updateDoc(docRef, dataToUpdate);
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

export async function deleteTransactionsByRecurringId(userId: string, recurringExpenseId: string, batch?: WriteBatch) {
    if (!db) throw new Error("Firebase is not configured.");
    
    const q = query(
        collection(db, "transactions"), 
        where("userId", "==", userId),
        where("recurringExpenseId", "==", recurringExpenseId)
    );
    
    try {
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return;
        }

        if (batch) {
            // If a batch is provided, add deletions to it
            querySnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
        } else {
            // Otherwise, create a new batch and commit it
            const newBatch = writeBatch(db);
            querySnapshot.forEach(doc => {
                newBatch.delete(doc.ref);
            });
            await newBatch.commit();
        }
    } catch (error) {
        console.error(`Error deleting transactions for recurring expense ${recurringExpenseId}:`, error);
        throw error;
    }
}

// Used for batch deleting all of a user's data
export async function addTransactionsDeletionsToBatch(userId: string, batch: WriteBatch) {
    if (!db) return;
    const q = query(collection(db, "transactions"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
}
