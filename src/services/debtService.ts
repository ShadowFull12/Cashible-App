import { db } from "@/lib/firebase";
import { collection, doc, getDocs, query, where, Timestamp, writeBatch, WriteBatch } from "firebase/firestore";
import type { Debt, SplitDetails } from "@/lib/data";

const debtsRef = collection(db, "debts");

export function addDebtCreationToBatch(
    batch: WriteBatch,
    transactionId: string,
    split: SplitDetails,
    circleId: string | null
) {
    if (!db) throw new Error("Firebase is not configured.");

    const payer = split.members.find(m => m.isPayer);
    if (!payer) throw new Error("No payer defined in split.");

    split.members.forEach(member => {
        if (member.uid === payer.uid) return; // Payer doesn't owe themselves

        const debtAmount = member.share;
        if (debtAmount > 0) {
            const debtDocRef = doc(collection(db, "debts"));
            batch.set(debtDocRef, {
                circleId: circleId || null,
                transactionId,
                debtorId: member.uid,
                creditorId: payer.uid,
                amount: debtAmount,
                isSettled: false,
                createdAt: Timestamp.now(),
            });
        }
    });
}

export async function getDebtsForCircle(circleId: string): Promise<Debt[]> {
    if (!db) return [];
    
    const q = query(debtsRef, where("circleId", "==", circleId), where("isSettled", "==", false));
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
