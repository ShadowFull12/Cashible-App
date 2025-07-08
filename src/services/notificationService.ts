
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, Unsubscribe, Timestamp, updateDoc, doc, getDocs, writeBatch, deleteDoc, WriteBatch } from "firebase/firestore";
import type { Notification, NotificationType, UserProfile } from "@/lib/data";

const notificationsRef = collection(db, "notifications");

interface CreateNotificationInput {
    userId: string;
    fromUser: UserProfile;
    type: NotificationType;
    message: string;
    link: string;
    relatedId?: string;
}

export async function createNotification(data: CreateNotificationInput) {
    if (!db) throw new Error("Firebase is not configured.");
    
    await addDoc(notificationsRef, {
        ...data,
        read: false,
        createdAt: Timestamp.now(),
    });
}

export function getNotificationsForUser(userId: string, callback: (notifications: Notification[]) => void): Unsubscribe {
    if (!db) return () => {};
    
    const q = query(
        notificationsRef, 
        where("userId", "==", userId)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const notifications: Notification[] = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const fromUser = data.fromUser as UserProfile;
            // Sanitize photoURL to prevent 'undefined' values
            fromUser.photoURL = fromUser.photoURL || null;

            notifications.push({
                id: doc.id,
                ...data,
                fromUser: fromUser,
                createdAt: (data.createdAt as Timestamp).toDate(),
            } as Notification);
        });
        
        // Sort on the client-side to avoid needing a composite index.
        notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        callback(notifications);
    }, (error) => {
        console.error("Error listening to notifications:", error);
        if ((error as any).code === 'failed-precondition') {
             console.error("Firestore query failed. This is often due to a missing composite index. The query has been modified to sort on the client to avoid this, but if performance is an issue, consider creating the index in the Firebase Console.");
        }
    });
    
    return unsubscribe;
}

export async function markNotificationAsRead(notificationId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    const notificationRef = doc(db, "notifications", notificationId);
    await updateDoc(notificationRef, { read: true });
}

export async function markAllNotificationsAsRead(userId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    const q = query(notificationsRef, where("userId", "==", userId), where("read", "==", false));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { read: true });
    });
    await batch.commit();
}

export async function deleteNotification(notificationId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    const notificationRef = doc(db, "notifications", notificationId);
    await deleteDoc(notificationRef);
}

export async function deleteNotificationByRelatedId(relatedId: string, batch?: WriteBatch) {
    if (!db) throw new Error("Firebase is not configured.");
    const q = query(notificationsRef, where("relatedId", "==", relatedId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    if(batch) {
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
    } else {
        const newBatch = writeBatch(db);
        snapshot.docs.forEach(doc => {
            newBatch.delete(doc.ref);
        });
        await newBatch.commit();
    }
}

export async function addNotificationsDeletionsToBatch(userId: string, batch: WriteBatch) {
    if (!db) return;
    const q = query(notificationsRef, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
}
