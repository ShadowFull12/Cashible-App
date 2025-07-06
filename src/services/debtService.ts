
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
        payerTransactionId: null,
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
        link: `/notifications`,
        relatedId: settlementId,
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

export async function logSettlementAsExpense(settlementId: string, notificationId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    
    const batch = writeBatch(db);
    const settlementRef = doc(db, "settlements", settlementId);
    const settlementSnap = await getDoc(settlementRef);

    if (!settlementSnap.exists() || settlementSnap.data().status !== 'confirmed') {
        throw new Error("Settlement not found or not confirmed.");
    }
    if (settlementSnap.data().payerTransactionId) {
        const notificationRef = doc(db, "notifications", notificationId);
        await deleteDoc(notificationRef);
        throw new Error("This settlement has already been logged.");
    }
    
    const settlementData = settlementSnap.data();
    const settlement = {
        id: settlementSnap.id,
        ...settlementData,
        createdAt: (settlementData.createdAt as Timestamp).toDate(),
        processedAt: settlementData.processedAt ? (settlementData.processedAt as Timestamp).toDate() : new Date(),
    } as Settlement;


    // 1. Create the personal expense transaction for the payer
    const newTransactionRef = doc(collection(db, "transactions"));
    batch.set(newTransactionRef, {
        userId: settlement.fromUserId,
        description: `Settlement to ${settlement.toUser.displayName}`,
        amount: settlement.amount,
        category: "Settlement",
        date: Timestamp.fromDate(settlement.processedAt!),
        isSplit: false,
        circleId: null, // Not a circle expense
        recurringExpenseId: null,
        splitDetails: null
    });
    
    // 2. Update the settlement with the new transaction ID
    batch.update(settlementRef, { payerTransactionId: newTransactionRef.id });

    // 3. Delete the actionable notification
    const notificationRef = doc(db, "notifications", notificationId);
    batch.delete(notificationRef);

    await batch.commit();
}


export async function addCircleSettlementsDeletionsToBatch(circleId: string, batch: WriteBatch) {
    if (!db) return;
    const q = query(collection(db, "settlements"), where("circleId", "==", circleId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
}
