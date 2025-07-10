

import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, Timestamp, writeBatch, updateDoc, WriteBatch, getDoc, onSnapshot, Unsubscribe, runTransaction, increment, arrayUnion } from "firebase/firestore";
import type { Transaction, SplitDetails, Settlement, Circle, UserProfile, SaleDetails, PaymentStatus, SaleItem, Customer } from "@/lib/data";
import { createNotification } from "./notificationService";


export async function addTransaction(transaction: Omit<Transaction, 'id' | 'date'> & { date: Date | Timestamp }) {
    if (!db) throw new Error("Firebase is not configured.");
    const transactionsRef = collection(db, "transactions");
    try {
        const docRef = await addDoc(transactionsRef, {
            ...transaction,
            date: transaction.date instanceof Date ? Timestamp.fromDate(transaction.date) : transaction.date,
            type: transaction.amount > 0 ? 'expense' : 'income', 
        });
        return docRef.id;
    } catch (error: any) {
        console.error('Error adding transaction:', error);
        throw new Error(error.message || "Failed to add transaction.");
    }
}

interface AddSaleTransactionInput {
    userId: string;
    items: SaleItem[];
    totalAmount: number;
    date: Date;
    customerName?: string;
    paymentStatus: PaymentStatus;
    amountPaid: number;
    notes?: string;
}

export async function addSaleTransaction(sale: AddSaleTransactionInput) {
    if (!db) throw new Error("Firebase not configured.");

    await runTransaction(db, async (t) => {
        const saleRef = doc(collection(db, "transactions"));
        let customerId: string | null = null;
        let customerRef: any = null;
        let customerData: Customer | null = null;

        // Handle customer creation/update only if a name is provided
        if (sale.customerName && sale.customerName.trim()) {
            const customerQuery = query(
                collection(db, "customers"),
                where("userId", "==", sale.userId),
                where("name", "==", sale.customerName.trim())
            );
            const customerSnap = await getDocs(customerQuery);
            
            if (customerSnap.empty) {
                // Create a new customer if they don't exist
                customerRef = doc(collection(db, "customers"));
                customerId = customerRef.id;
                const newCustomerData = {
                    userId: sale.userId,
                    name: sale.customerName.trim(),
                    totalDebt: sale.totalAmount - sale.amountPaid,
                    unpaidSaleIds: sale.paymentStatus !== 'paid' ? [saleRef.id] : [],
                };
                t.set(customerRef, newCustomerData);
            } else {
                // Update existing customer if they exist
                customerRef = customerSnap.docs[0].ref;
                customerId = customerRef.id;
                if (sale.paymentStatus !== 'paid') {
                    t.update(customerRef, {
                        totalDebt: increment(sale.totalAmount - sale.amountPaid),
                        unpaidSaleIds: arrayUnion(saleRef.id)
                    });
                }
            }
        }

        // Create the main Sale transaction
        const salePayload: Omit<Transaction, 'id'> = {
            userId: sale.userId,
            description: `Sale: ${sale.items.map(i => i.name).join(', ')}`,
            amount: sale.totalAmount,
            category: 'Sale',
            date: Timestamp.fromDate(sale.date),
            type: 'expense', // Sales are logged as an "expense" of goods/services
            isSplit: false,
            saleDetails: {
                items: sale.items,
                totalAmount: sale.totalAmount,
                customerName: sale.customerName || null,
                customerId: customerId,
                paymentStatus: sale.paymentStatus,
                amountPaid: sale.amountPaid,
                notes: sale.notes || null,
            }
        };
        t.set(saleRef, salePayload);

        // If any payment was made, create a corresponding income transaction
        if (sale.amountPaid > 0) {
            const incomeRef = doc(collection(db, "transactions"));
            t.set(incomeRef, {
                userId: sale.userId,
                description: `Payment for Sale #${saleRef.id.slice(0, 6)}`,
                amount: -sale.amountPaid, // Income is a negative amount
                category: 'Income',
                date: Timestamp.fromDate(sale.date),
                type: 'income',
                isSplit: false,
                relatedSaleId: saleRef.id,
            });
        }
    });
}


export async function settleCustomerDebt(customerId: string, amount: number) {
    if (!db) throw new Error("Firebase is not configured.");

    await runTransaction(db, async (t) => {
        // --- 1. ALL READS FIRST ---
        const customerRef = doc(db, "customers", customerId);
        const customerSnap = await t.get(customerRef);

        if (!customerSnap.exists()) {
            throw new Error("Customer not found.");
        }
        const customerData = customerSnap.data() as Customer;

        if (amount > customerData.totalDebt) {
            throw new Error("Payment cannot be more than the total debt.");
        }

        // Read all unpaid sales documents
        let unpaidSales: (Transaction & { id: string })[] = [];
        if (customerData.unpaidSaleIds && customerData.unpaidSaleIds.length > 0) {
            const unpaidSalesRefs = customerData.unpaidSaleIds.map(id => doc(db, "transactions", id));
            const unpaidSalesSnaps = await Promise.all(unpaidSalesRefs.map(ref => t.get(ref)));

            unpaidSales = unpaidSalesSnaps
                .filter(snap => snap.exists())
                .map(d => ({ id: d.id, ...(d.data() as Transaction) }))
                .filter(sale => sale.saleDetails)
                .sort((a, b) => (a.date as Timestamp).toMillis() - (b.date as Timestamp).toMillis());
        }

        // --- 2. ALL WRITES NOW ---
        const incomeRef = doc(collection(db, "transactions"));
        t.set(incomeRef, {
            userId: customerData.userId,
            description: `Debt payment from ${customerData.name}`,
            amount: -amount,
            category: 'Income',
            date: Timestamp.now(),
            type: 'income',
        });

        // Update customer's total debt immediately
        t.update(customerRef, {
            totalDebt: increment(-amount)
        });

        let remainingAmountToSettle = amount;
        const salesToRemoveFromUnpaid = new Set<string>();

        for (const sale of unpaidSales) {
            if (remainingAmountToSettle <= 0) break;

            const saleRef = doc(db, "transactions", sale.id);
            const amountOwedOnSale = sale.saleDetails!.totalAmount - sale.saleDetails!.amountPaid;
            const paymentForThisSale = Math.min(remainingAmountToSettle, amountOwedOnSale);

            const newAmountPaid = sale.saleDetails!.amountPaid + paymentForThisSale;
            const newStatus: PaymentStatus = newAmountPaid >= sale.saleDetails!.totalAmount - 0.01 ? 'paid' : 'partial';

            t.update(saleRef, {
                "saleDetails.amountPaid": newAmountPaid,
                "saleDetails.paymentStatus": newStatus
            });

            remainingAmountToSettle -= paymentForThisSale;
            if (newStatus === 'paid') {
                salesToRemoveFromUnpaid.add(sale.id);
            }
        }

        if (salesToRemoveFromUnpaid.size > 0) {
            const updatedUnpaidSaleIds = customerData.unpaidSaleIds.filter(id => !salesToRemoveFromUnpaid.has(id));
            t.update(customerRef, { unpaidSaleIds: updatedUnpaidSaleIds });
        }
    });
}


export async function addSplitTransaction(
    transaction: Omit<Transaction, 'id' | 'date' | 'isSplit' | 'splitDetails'> & { date: Date | Timestamp }, 
    splitDetails: SplitDetails
) {
    if (!db) throw new Error("Firebase is not configured.");
    const transactionsRef = collection(db, "transactions");
    
    try {
        await addDoc(transactionsRef, {
            ...transaction,
            date: transaction.date instanceof Date ? Timestamp.fromDate(transaction.date) : transaction.date,
            isSplit: true,
            splitDetails,
            type: 'expense'
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


export function getTransactionsListener(userId: string, callback: (transactions: Transaction[]) => void): Unsubscribe {
    if (!db) return () => {};
    const transactionsRef = collection(db, "transactions");
    try {
        // Query for all transactions for the user, then filter client-side
        const q = query(transactionsRef, where("userId", "==", userId));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const transactions: Transaction[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Perform the filter here instead of in the query
                if (data.category !== 'Sale') {
                    transactions.push({
                        id: doc.id,
                        ...data,
                        date: (data.date as Timestamp).toDate(),
                    } as Transaction);
                }
            });
            callback(transactions.sort((a, b) => b.date.getTime() - a.date.getTime()));
        });
        return unsubscribe;
    } catch (error) {
        console.error(`Error listening to transactions for user ${userId}:`, error);
        throw error;
    }
}

export function getSalesListener(userId: string, callback: (sales: Transaction[]) => void): Unsubscribe {
    if (!db) return () => {};
    const transactionsRef = collection(db, "transactions");
    try {
        const q = query(transactionsRef, where("userId", "==", userId), where("category", "==", "Sale"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const sales: Transaction[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                sales.push({
                    id: doc.id,
                    ...data,
                    date: (data.date as Timestamp).toDate(),
                } as Transaction);
            });
            callback(sales.sort((a, b) => b.date.getTime() - a.date.getTime()));
        });
        return unsubscribe;
    } catch (error) {
        console.error(`Error listening to sales for user ${userId}:`, error);
        throw error;
    }
}


export function getCircleTransactionsListener(circleId: string, callback: (transactions: Transaction[]) => void): Unsubscribe {
    if (!db) return () => {};
    const transactionsRef = collection(db, "transactions");
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

export async function removeTransactionFromCircle(transactionId: string, circle: Circle, owner: UserProfile) {
    if (!db) throw new Error("Firebase not configured.");
    if (owner.uid !== circle.ownerId) throw new Error("Only the circle owner can perform this action.");

    const transactionRef = doc(db, "transactions", transactionId);
    const transactionSnap = await getDoc(transactionRef);

    if (!transactionSnap.exists()) {
        throw new Error("Transaction not found.");
    }
    const transaction = transactionSnap.data() as Transaction;

    await updateDoc(transactionRef, {
        isSplit: false,
        circleId: null,
        splitDetails: null,
    });
    
    await createNotification({
        userId: transaction.userId,
        fromUser: owner,
        type: 'circle-expense-removed-by-owner',
        message: `${owner.displayName} removed your expense "${transaction.description}" from the circle "${circle.name}".`,
        link: '/history',
        relatedId: transactionId,
    });
}


    
