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

/**
 * Adds a transaction that is split between multiple users.
 * This function handles two cases:
 * 1. The logger is the payer: A transaction is created, and debts are created for other members.
 * 2. The logger is NOT the payer: Only a debt record is created for the logger. No transaction is logged for them.
 *
 * Firestore Security Rule Requirement:
 * To allow users to log debts for expenses paid by others, your `firestore.rules` must allow
 * a debt to be created by either the debtor or the creditor. The creating user must be in the `involvedUids` array.
 *
 * Example Rule for `/debts/{debtId}`:
 * `allow create: if request.auth.uid in request.resource.data.involvedUids;`
 */
export async function addSplitTransaction(
    transaction: Omit<Transaction, 'id' | 'date'> & { date: Date | Timestamp }, 
    splitDetails: SplitDetails
) {
    if (!db) throw new Error("Firebase is not configured.");
    
    try {
        const batch = writeBatch(db);

        const loggerId = transaction.userId;
        const { payerId, members } = splitDetails;
        
        const payerProfile = members.find(m => m.uid === payerId);
        if (!payerProfile) throw new Error("Payer could not be found in the split members.");

        // Case 1: The person logging the expense is the person who paid.
        // They have authority to create the main transaction and assign debts to others.
        if (loggerId === payerId) {
            const transactionRef = doc(collection(db, "transactions"));
            batch.set(transactionRef, {
                userId: loggerId,
                description: transaction.description,
                amount: transaction.amount,
                category: transaction.category,
                date: transaction.date instanceof Date ? Timestamp.fromDate(transaction.date) : transaction.date,
                isSplit: true,
                circleId: transaction.circleId || null,
                recurringExpenseId: null,
            });

            addDebtCreationToBatch(batch, transactionRef.id, splitDetails, transaction.circleId || null, transaction.description);

        } else {
            // Case 2: The person logging the expense is NOT who paid.
            const loggerProfile = members.find(m => m.uid === loggerId);
            if (!loggerProfile) throw new Error("Logger could not be found in the split members.");
            
            // Create a single debt record for the logger.
            const debtDocRef = doc(collection(db, "debts"));
            
            // The `members` array for debt creation must include both the debtor (logger) and the creditor (payer).
            const singleDebtDetails: SplitDetails = {
                ...splitDetails,
                members: [loggerProfile, payerProfile]
            };

            // Use the debt's own ID as a placeholder, since no central transaction exists for this logger.
            addDebtCreationToBatch(batch, debtDocRef.id, singleDebtDetails, transaction.circleId || null, transaction.description);
        }
        
        await batch.commit();

    } catch (error: any) {
        console.error('Error adding split transaction:', error);
         if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission-denied'))) {
            throw new Error("Permission Denied: Could not add split transaction. Check Firestore Security Rules.");
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
