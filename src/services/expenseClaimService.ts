
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, getDoc, Timestamp, writeBatch, updateDoc } from "firebase/firestore";
import type { ExpenseClaim, SplitDetails, UserProfile } from "@/lib/data";
import { addDebtCreationToBatch } from "./debtService";
import { createNotification, deleteNotificationByRelatedId } from "./notificationService";

const claimsRef = collection(db, "expense-claims");

interface CreateClaimInput {
    claimerProfile: UserProfile;
    payerId: string;
    expenseDetails: {
        description: string;
        amount: number;
        category: string;
        date: Date;
        circleId: string | null;
        splitDetails: SplitDetails;
    };
}

export async function createExpenseClaim(data: CreateClaimInput) {
    if (!db) throw new Error("Firebase is not configured.");

    const claimDocRef = await addDoc(claimsRef, {
        claimerId: data.claimerProfile.uid,
        claimerProfile: data.claimerProfile,
        payerId: data.payerId,
        expenseDetails: {
            ...data.expenseDetails,
            date: Timestamp.fromDate(data.expenseDetails.date),
        },
        status: 'pending',
        createdAt: Timestamp.now(),
    });

    const payer = data.expenseDetails.splitDetails.members.find(m => m.uid === data.payerId);
    if (!payer) throw new Error("Payer not found in split details");

    await createNotification({
        userId: data.payerId,
        fromUser: data.claimerProfile,
        type: 'expense-claim-request',
        message: `${data.claimerProfile.displayName} logged an expense of ₹${data.expenseDetails.amount.toFixed(2)} that they said you paid for.`,
        link: '/notifications',
        relatedId: claimDocRef.id,
    });
}

export async function acceptExpenseClaim(claimId: string) {
    if (!db) throw new Error("Firebase is not configured.");

    const claimDocRef = doc(db, "expense-claims", claimId);
    const claimDocSnap = await getDoc(claimDocRef);

    if (!claimDocSnap.exists() || claimDocSnap.data().status !== 'pending') {
        throw new Error("This expense claim is not available or has already been processed.");
    }
    const claimData = claimDocSnap.data();
    const claim = {
        ...claimData,
        createdAt: (claimData.createdAt as Timestamp).toDate(),
        expenseDetails: {
            ...claimData.expenseDetails,
            date: (claimData.expenseDetails.date as Timestamp).toDate(),
        }
    } as ExpenseClaim;
    
    const batch = writeBatch(db);

    // 1. Create the transaction for the payer
    const transactionRef = doc(collection(db, "transactions"));
    batch.set(transactionRef, {
        userId: claim.payerId,
        description: claim.expenseDetails.description,
        amount: claim.expenseDetails.amount,
        category: claim.expenseDetails.category,
        date: Timestamp.fromDate(new Date(claim.expenseDetails.date)),
        isSplit: true,
        circleId: claim.expenseDetails.circleId,
        recurringExpenseId: null,
    });

    // 2. Create the debts
    addDebtCreationToBatch(
        batch, 
        transactionRef.id, 
        claim.expenseDetails.splitDetails, 
        claim.expenseDetails.circleId, 
        claim.expenseDetails.description
    );
    
    // 3. Update the claim status to accepted
    batch.update(claimDocRef, { status: 'accepted' });

    await batch.commit();

    // 4. Clean up original notification and notify claimer
    await deleteNotificationByRelatedId(claimId);
    
    const payer = claim.expenseDetails.splitDetails.members.find(m => m.uid === claim.payerId);
    if (payer) {
         await createNotification({
            userId: claim.claimerId,
            fromUser: payer,
            type: 'expense-claim-accepted',
            message: `${payer.displayName} accepted your expense claim for "${claim.expenseDetails.description}".`,
            link: '/history',
        });
    }
}

export async function rejectExpenseClaim(claimId: string) {
    if (!db) throw new Error("Firebase is not configured.");

    const claimDocRef = doc(db, "expense-claims", claimId);
    const claimDocSnap = await getDoc(claimDocRef);
    if (!claimDocSnap.exists() || claimDocSnap.data().status !== 'pending') {
        throw new Error("This expense claim is not available or has already been processed.");
    }
    const claimData = claimDocSnap.data();
     const claim = {
        ...claimData,
        createdAt: (claimData.createdAt as Timestamp).toDate(),
        expenseDetails: {
            ...claimData.expenseDetails,
            date: (claimData.expenseDetails.date as Timestamp).toDate(),
        }
    } as ExpenseClaim;

    await updateDoc(claimDocRef, { status: 'rejected' });
    
    // Clean up original notification and notify claimer
    await deleteNotificationByRelatedId(claimId);

    const payer = claim.expenseDetails.splitDetails.members.find(m => m.uid === claim.payerId);
    if(payer) {
        await createNotification({
            userId: claim.claimerId,
            fromUser: payer,
            type: 'expense-claim-rejected',
            message: `${payer.displayName} declined your expense claim for "${claim.expenseDetails.description}".`,
            link: '/notifications',
        });
    }
}
