'use server';

import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, Timestamp } from "firebase/firestore";
import type { Transaction } from "@/lib/data";

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'date'> & { date: Date | Timestamp }) {
    if (!db) throw new Error("Firebase is not configured.");
    const docRef = await addDoc(collection(db, "transactions"), {
        ...transaction,
        date: transaction.date instanceof Date ? Timestamp.fromDate(transaction.date) : transaction.date,
    });
    return docRef.id;
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
    if (!db) return []; // Gracefully handle missing config
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
}

export async function deleteTransaction(transactionId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    await deleteDoc(doc(db, "transactions", transactionId));
}
