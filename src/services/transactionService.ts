'use server';

import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, Timestamp } from "firebase/firestore";

export interface Transaction {
    id?: string;
    userId: string;
    name: string;
    amount: number;
    category: string;
    date: Date;
}

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'date'> & { date: Date | Timestamp }) {
    const docRef = await addDoc(collection(db, "transactions"), {
        ...transaction,
        date: transaction.date instanceof Date ? Timestamp.fromDate(transaction.date) : transaction.date,
    });
    return docRef.id;
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
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
    await deleteDoc(doc(db, "transactions", transactionId));
}
