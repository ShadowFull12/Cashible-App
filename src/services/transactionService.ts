
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, Timestamp, writeBatch, updateDoc, WriteBatch, getDoc, onSnapshot, Unsubscribe } from "firebase/firestore";
import type { Transaction, SplitDetails, Settlement } from "@/lib/data";

const transactionsRef = collection(db, "transactions");

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'date'> & { date: Date | Timestamp }) {
    if (!db) throw new Error("Firebase is not configured.");
    try {
        const docRef = await addDoc(transactionsRef, {
            ...transaction,
            date: transaction.date instanceof Date ? Timestamp.fromDate(transaction.date) : transaction.date,
        });
        return docRef.id;
    } catch (error: any) {
        console.error('Error adding transaction:', error);
        throw new Error(error.message || "Failed to add transaction.");
    }
}

export async function addSplitTransaction(
    transaction: Omit<Transaction, 'id' | 'date' | 'isSplit' | 'splitDetails'> & { date: Date | Timestamp }, 
    splitDetails: SplitDetails
) {
    if (!db) throw new Error("Firebase is not configured.");
    
    try {
        // A split transaction is a single document that contains all the details needed for balance calculation.
        // The on-the-fly balance calculation in the UI will handle the debt creation.
        await addDoc(transactionsRef, {
            ...transaction,
            date: transaction.date instanceof Date ? Timestamp.fromDate(transaction.date) : transaction.date,
            isSplit: true,
            splitDetails,
        });
    } catch (error: any) {
        console.error('Error adding split transaction:', error);
        throw new Error(error.message || "Failed to add split transaction.");
    }
}

export async function updateTransaction(transactionId: string, data: Partial<Omit<Transaction, 'id' | 'userId'>>) {
    if (!db) throw new Error("Firebase is not configured.");
    const docRef = doc(db, "transactions", transactionId);
    
    const dataToUpdate: any = { ...data };
    if (data.date && data.date instanceof Date) {
        dataToUpdate.date = Timestamp.fromDate(data.date);
    }
    
    await updateDoc(docRef, dataToUpdate);
}

export async function getTransactionById(transactionId: string): Promise<Transaction | null> {
    if (!db) return null;
    const docRef = doc(db, "transactions", transactionId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            date: (data.date as Timestamp).toDate(),
        } as Transaction;
    }
    return null;
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
    if (!db) return [];
    try {
        const q = query(transactionsRef, where("userId", "==", userId));
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

export async function getCircleTransactions(circleId: string): Promise<Transaction[]> {
    if (!db) return [];
    const q = query(transactionsRef, where("circleId", "==", circleId));
    const querySnapshot = await getDocs(q);
    const transactions: Transaction[] = [];
    querySnapshot.forEach(doc => {
        const data = doc.data();
        transactions.push({
            id: doc.id,
            ...data,
            date: (data.date as Timestamp).toDate(),
        } as Transaction);
    });
    return transactions.sort((a,b) => b.date.getTime() - a.date.getTime());
}

export function getCircleTransactionsListener(circleId: string, callback: (transactions: Transaction[]) => void): Unsubscribe {
    if (!db) return () => {};
    const q = query(transactionsRef, where("circleId", "==", circleId));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const transactions: Transaction[] = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            transactions.push({
                id: doc.id,
                ...data,
                date: (data.date as Timestamp).toDate(),
            } as Transaction);
        });
        callback(transactions.sort((a,b) => b.date.getTime() - a.date.getTime()));
    }, (error) => {
        console.error(`Error listening to circle transactions for ${circleId}:`, error);
    });

    return unsubscribe;
}


export async function getCircleSettlements(circleId: string): Promise<Settlement[]> {
    if (!db) return [];
    const q = query(collection(db, "settlements"), where("circleId", "==", circleId));
    const querySnapshot = await getDocs(q);
    const settlements: Settlement[] = [];
    querySnapshot.forEach(doc => {
        const data = doc.data();
        settlements.push({
            id: doc.id,
            ...data,
            createdAt: (data.createdAt as Timestamp).toDate(),
            processedAt: data.processedAt ? (data.processedAt as Timestamp).toDate() : null,
        } as Settlement);
    });
    return settlements.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function getCircleSettlementsListener(circleId: string, callback: (settlements: Settlement[]) => void): Unsubscribe {
    if (!db) return () => {};
    const settlementsRef = collection(db, "settlements");
    const q = query(settlementsRef, where("circleId", "==", circleId));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const settlements: Settlement[] = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            settlements.push({
                id: doc.id,
                ...data,
                createdAt: (data.createdAt as Timestamp).toDate(),
                processedAt: data.processedAt ? (data.processedAt as Timestamp).toDate() : null,
            } as Settlement);
        });
        callback(settlements.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    }, (error) => {
        console.error(`Error listening to circle settlements for ${circleId}:`, error);
    });

    return unsubscribe;
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
            querySnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
        } else {
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

export async function addTransactionsDeletionsToBatch(userId: string, batch: WriteBatch) {
    if (!db) return;
    const q = query(collection(db, "transactions"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
}

export async function addCircleTransactionsDeletionsToBatch(circleId: string, batch: WriteBatch) {
    if (!db) return;
    const q = query(collection(db, "transactions"), where("circleId", "==", circleId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
}
