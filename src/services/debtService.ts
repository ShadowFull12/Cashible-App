import { db } from "@/lib/firebase";
import { collection, doc, getDocs, query, where, Timestamp, writeBatch, WriteBatch, updateDoc, getDoc, deleteDoc } from "firebase/firestore";
import type { Debt, SplitDetails, Transaction } from "@/lib/data";
import { getTransactionById, addTransaction, updateTransaction } from "./transactionService";
import { createNotification } from "./notificationService";

const debtsRef = collection(db, "debts");

/**
 * Creates debt documents for a split transaction and adds them to a Firestore batch.
 * This function is designed to be used within a larger transaction batch.
 *
 * It correctly handles the case where the person logging the expense (the logger)
 * is not the one who paid (the payer). In this scenario, it ensures a debt record
 * is created for the logger owing the payer.
 *
 * @param batch The Firestore WriteBatch to add operations to.
 * @param transactionId The ID of the parent transaction (or a unique ID if no parent transaction is logged by the user).
 * @param split The details of the split, including payer and members.
 * @param circleId The ID of the circle, if applicable.
 * @param transactionDescription A description of the original expense.
 */
export function addDebtCreationToBatch(
    batch: WriteBatch,
    transactionId: string,
    split: SplitDetails,
    circleId: string | null,
    transactionDescription: string
) {
    if (!db) throw new Error("Firebase is not configured.");
    
    const payer = split.members.find(m => m.uid === split.payerId);
    if (!payer) {
        // This case can happen if the payer was filtered out of the members list before calling this function.
        // We throw an error to prevent invalid data from being written.
        throw new Error("Payer could not be found in the provided split members list. Ensure the payer is included.");
    }

    // Create debts for every member who is not the payer.
    split.members.forEach(member => {
        if (member.uid === split.payerId) return; // Payer doesn't owe themselves

        const debtAmount = member.share;
        if (debtAmount > 0) {
            const debtDocRef = doc(collection(db, "debts"));
            batch.set(debtDocRef, {
                circleId: circleId || null,
                transactionId,
                transactionDescription,
                debtorId: member.uid,
                debtor: { uid: member.uid, displayName: member.displayName, email: member.email, photoURL: member.photoURL || null },
                creditorId: payer.uid,
                creditor: { uid: payer.uid, displayName: payer.displayName, email: payer.email, photoURL: payer.photoURL || null },
                amount: debtAmount,
                settlementStatus: 'unsettled',
                createdAt: Timestamp.now(),
                involvedUids: [member.uid, payer.uid],
            });
        }
    });
}


export async function getDebtsForCircle(circleId: string, userId: string): Promise<Debt[]> {
    if (!db) return [];
    
    try {
        const q = query(
            debtsRef, 
            where("circleId", "==", circleId),
            where("involvedUids", "array-contains", userId)
        );
        const querySnapshot = await getDocs(q);

        const debts: Debt[] = [];
        querySnapshot.forEach(doc => {
            const data = doc.data() as Debt;
            // Backwards compatibility for old data model
            if (data.isSettled && !data.settlementStatus) {
                data.settlementStatus = 'confirmed';
            } else if (!data.settlementStatus) {
                data.settlementStatus = 'unsettled';
            }

            debts.push({
                id: doc.id,
                ...data,
                createdAt: (data.createdAt as unknown as Timestamp).toDate(),
            } as Debt);
        });
        
        return debts.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error: any) {
         console.error("Failed to fetch circle debts:", error);
         if (error.code === 'failed-precondition') {
                throw new Error("A database index is required to view this data. The link to create it can be found in your browser's developer console (press F12).");
            } else if (error.code === 'permission-denied') {
                throw new Error("You do not have permission to view this circle's debt information.");
            }
        throw new Error("An unexpected error occurred while loading circle data.");
    }
}

export async function initiateSettlement(debt: Debt) {
    if (!db) throw new Error("Firebase is not configured.");
    const debtDocRef = doc(db, "debts", debt.id);
    await updateDoc(debtDocRef, { settlementStatus: 'pending_confirmation' });

    // Notify creditor that the debtor has marked the payment as sent
    await createNotification({
        userId: debt.creditorId,
        fromUser: debt.debtor,
        type: 'debt-settlement-request',
        message: `${debt.debtor.displayName} marked their payment of ₹${debt.amount.toFixed(2)} as complete.`,
        link: debt.circleId ? `/spend-circle/${debt.circleId}` : `/spend-circle`,
    });
}

export async function cancelSettlement(debtId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    const debtDocRef = doc(db, "debts", debtId);
    await updateDoc(debtDocRef, { settlementStatus: 'unsettled' });
}

export async function rejectSettlement(debtId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    const debtDocRef = doc(db, "debts", debtId);
    await updateDoc(debtDocRef, { settlementStatus: 'unsettled' });
}


export async function confirmSettlement(debt: Debt) {
    if (!db) throw new Error("Firebase is not configured.");
    const batch = writeBatch(db);

    // 1. Mark debt as confirmed
    const debtRef = doc(db, "debts", debt.id);
    batch.update(debtRef, { settlementStatus: 'confirmed' });

    // 2. Reduce the amount of the original transaction for the creditor
    const originalTx = await getTransactionById(debt.transactionId);
    if (originalTx) {
        const transactionRef = doc(db, "transactions", debt.transactionId);
        const newAmount = originalTx.amount - debt.amount;
        batch.update(transactionRef, { amount: newAmount < 0 ? 0 : newAmount });
    }

    await batch.commit();

    // 3. Notify debtor that payment was confirmed
    await createNotification({
        userId: debt.debtorId,
        fromUser: debt.creditor,
        type: 'debt-settlement-confirmed',
        message: `${debt.creditor.displayName} confirmed your payment of ₹${debt.amount.toFixed(2)}. You can now log it as an expense.`,
        link: debt.circleId ? `/spend-circle/${debt.circleId}` : `/spend-circle`,
    });
}

export async function logSettledDebtAsExpense(debt: Debt) {
     if (!db) throw new Error("Firebase is not configured.");
     const batch = writeBatch(db);

     // 1. Create a new "settlement" transaction for the debtor
     const transactionRef = doc(collection(db, "transactions"));
     batch.set(transactionRef, {
        userId: debt.debtorId,
        description: `Paid ${debt.creditor.displayName} for "${debt.transactionDescription}"`,
        amount: debt.amount,
        category: 'Settlement',
        date: Timestamp.now(),
        isSplit: false,
        circleId: debt.circleId,
        recurringExpenseId: null
     });
     
     // 2. Mark the debt as fully logged and settled
     const debtRef = doc(db, "debts", debt.id);
     batch.update(debtRef, { settlementStatus: 'logged' });

     await batch.commit();
}

export async function deleteDebtById(debtId: string, circleId: string, userId: string) {
    if (!db) throw new Error("Firebase not configured.");

    const circleRef = doc(db, "circles", circleId);
    const circleSnap = await getDoc(circleRef);

    if (!circleSnap.exists() || circleSnap.data().ownerId !== userId) {
        throw new Error("You must be the circle owner to delete a debt.");
    }
    
    const debtRef = doc(db, "debts", debtId);
    await deleteDoc(debtRef);
}

export async function deleteDebtsForCircle(circleId: string, batch: WriteBatch) {
    if (!db) return;
    const debtsQuery = query(collection(db, "debts"), where("circleId", "==", circleId));
    const debtsSnapshot = await getDocs(debtsQuery);
    debtsSnapshot.forEach(doc => batch.delete(doc.ref));
}
