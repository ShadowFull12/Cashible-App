import { db } from "@/lib/firebase";
import { collection, doc, getDocs, query, where, Timestamp, writeBatch, WriteBatch, updateDoc } from "firebase/firestore";
import type { Debt, SplitDetails, UserProfile } from "@/lib/data";

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
    
    // The members array now only contains those who need a debt record created.
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
                isSettled: false,
                createdAt: Timestamp.now(),
                involvedUids: [member.uid, payer.uid],
            });
        }
    });
}

export async function getDebtsForCircle(circleId: string): Promise<Debt[]> {
    if (!db) return [];
    
    const q = query(
        debtsRef, 
        where("circleId", "==", circleId)
    );
    const querySnapshot = await getDocs(q);

    const debts: Debt[] = [];
    querySnapshot.forEach(doc => {
        const data = doc.data();
        debts.push({
            id: doc.id,
            ...data,
            createdAt: (data.createdAt as Timestamp).toDate(),
        } as Debt);
    });
    
    return debts;
}

export async function settleDebt(debtId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    const debtDocRef = doc(db, "debts", debtId);
    await updateDoc(debtDocRef, {
        isSettled: true,
    });
}