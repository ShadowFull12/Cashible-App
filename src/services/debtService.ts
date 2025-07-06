
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, query, where, Timestamp, writeBatch, WriteBatch, updateDoc, getDoc, deleteDoc, addDoc } from "firebase/firestore";
import type { Debt, SplitDetails, Transaction, UserProfile, Settlement } from "@/lib/data";
import { getTransactionById, addTransaction, updateTransaction } from "./transactionService";
import { createNotification, deleteNotificationByRelatedId } from "./notificationService";

const debtsRef = collection(db, "debts");
const settlementsRef = collection(db, "settlements");

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
        throw new Error("Payer could not be found in the provided split members list.");
    }

    split.members.forEach(member => {
        if (member.uid === split.payerId) return;

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

export async function deleteDebtsForCircle(circleId: string, batch: WriteBatch) {
    if (!db) return;
    const debtsQuery = query(collection(db, "debts"), where("circleId", "==", circleId));
    const debtsSnapshot = await getDocs(debtsQuery);
    debtsSnapshot.forEach(doc => batch.delete(doc.ref));
}

// --- Partial Settlement Logic ---

export async function initiateSettlement(fromUser: UserProfile, toUser: UserProfile, amount: number, circleId: string, circleName: string) {
    if (!db) throw new Error("Firebase is not configured.");
    
    const settlementDocRef = await addDoc(settlementsRef, {
        circleId,
        fromUserId: fromUser.uid,
        fromUser,
        toUserId: toUser.uid,
        toUser,
        amount,
        status: 'pending_confirmation',
        createdAt: Timestamp.now(),
    });

    await createNotification({
        userId: toUser.uid,
        fromUser: fromUser,
        type: 'settlement-request',
        message: `${fromUser.displayName} marked a payment of ₹${amount.toFixed(2)} to you in "${circleName}".`,
        link: `/spend-circle/${circleId}?tab=balances`,
        relatedId: settlementDocRef.id,
    });
}

export async function acceptSettlement(settlementId: string) {
    if (!db) throw new Error("Firebase is not configured.");

    const settlementRef = doc(db, "settlements", settlementId);
    const settlementSnap = await getDoc(settlementRef);

    if (!settlementSnap.exists()) {
        throw new Error("Settlement request not found.");
    }

    const settlement = settlementSnap.data() as Settlement;
    const batch = writeBatch(db);

    // 1. Create a "Settlement" transaction for the person who paid (the debtor)
    const transactionRef = doc(collection(db, "transactions"));
    batch.set(transactionRef, {
        userId: settlement.fromUserId,
        description: `Paid back ${settlement.toUser.displayName}`,
        amount: settlement.amount,
        category: 'Settlement',
        date: Timestamp.now(),
        isSplit: false,
        circleId: settlement.circleId,
        recurringExpenseId: null,
        splitDetails: null
    });

    // 2. Update the settlement status to 'confirmed'
    batch.update(settlementRef, {
        status: 'confirmed',
        processedAt: Timestamp.now(),
    });

    await batch.commit();

    // 3. Clean up the original notification and send confirmations
    await deleteNotificationByRelatedId(settlementId);

    await createNotification({
        userId: settlement.fromUserId,
        fromUser: settlement.toUser,
        type: 'settlement-confirmed',
        message: `${settlement.toUser.displayName} confirmed your payment of ₹${settlement.amount.toFixed(2)}.`,
        link: `/spend-circle/${settlement.circleId}?tab=history`,
    });
}

export async function rejectSettlement(settlementId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    
    const settlementRef = doc(db, "settlements", settlementId);
    const settlementSnap = await getDoc(settlementRef);
    if (!settlementSnap.exists()) {
        throw new Error("Settlement request not found.");
    }
    const settlement = settlementSnap.data() as Settlement;

    await updateDoc(settlementRef, { status: 'rejected' });
    
    await deleteNotificationByRelatedId(settlementId);

    await createNotification({
        userId: settlement.fromUserId,
        fromUser: settlement.toUser,
        type: 'settlement-rejected',
        message: `${settlement.toUser.displayName} declined your payment claim of ₹${settlement.amount.toFixed(2)}.`,
        link: `/spend-circle/${settlement.circleId}?tab=balances`,
    });
}
