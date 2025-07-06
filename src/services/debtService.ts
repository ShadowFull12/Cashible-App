import { db } from "@/lib/firebase";
import { collection, doc, getDocs, query, where, Timestamp, writeBatch, WriteBatch, updateDoc, getDoc } from "firebase/firestore";
import type { Debt, SplitDetails, Transaction } from "@/lib/data";
import { getTransactionById, addTransaction, updateTransaction } from "./transactionService";

const debtsRef = collection(db, "debts");

export function addDebtCreationToBatch(
    batch: WriteBatch,
    transactionId: string,
    split: SplitDetails,
    circleId: string | null,
    transactionDescription: string
) {
    if (!db) throw new Error("Firebase is not configured.");

    const payer = split.members.find(m => m.uid === split.payerId);
    if (!payer) throw new Error("No payer defined in split.");
    
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
    
    return debts.sort((a,b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function initiateSettlement(debtId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    const debtDocRef = doc(db, "debts", debtId);
    await updateDoc(debtDocRef, { settlementStatus: 'pending_confirmation' });
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
