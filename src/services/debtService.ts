
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, query, where, Timestamp, writeBatch, WriteBatch, updateDoc, getDoc, deleteDoc, addDoc } from "firebase/firestore";
import type { Debt, SplitDetails, Transaction, UserProfile, Settlement } from "@/lib/data";
import { getTransactionById, addTransaction, updateTransaction } from "./transactionService";
import { createNotification, deleteNotificationByRelatedId } from "./notificationService";

const settlementsRef = collection(db, "settlements");

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
    
    // Update the settlement status to 'confirmed'. This will be picked up by the listener on the circle page.
    await updateDoc(settlementRef, {
        status: 'confirmed',
        processedAt: Timestamp.now(),
    });

    // Clean up the original notification and send a confirmation to the payer.
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

    // A rejected settlement is simply deleted. 
    await deleteDoc(settlementRef);
    
    await deleteNotificationByRelatedId(settlementId);

    await createNotification({
        userId: settlement.fromUserId,
        fromUser: settlement.toUser,
        type: 'settlement-rejected',
        message: `${settlement.toUser.displayName} declined your payment claim of ₹${settlement.amount.toFixed(2)}.`,
        link: `/spend-circle/${settlement.circleId}?tab=balances`,
    });
}


export async function addCircleSettlementsDeletionsToBatch(circleId: string, batch: WriteBatch) {
    if (!db) return;
    const q = query(collection(db, "settlements"), where("circleId", "==", circleId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
}
