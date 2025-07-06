import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, Unsubscribe, Timestamp, orderBy, updateDoc, doc, getDocs, writeBatch } from "firebase/firestore";
import type { Notification, NotificationType, UserProfile } from "@/lib/data";

const notificationsRef = collection(db, "notifications");

interface CreateNotificationInput {
    userId: string;
    fromUser: UserProfile;
    type: NotificationType;
    message: string;
    link: string;
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
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const notifications: Notification[] = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            notifications.push({
                id: doc.id,
                ...data,
                createdAt: (data.createdAt as Timestamp).toDate(),
            } as Notification);
        });
        callback(notifications);
    }, (error) => {
        console.error("Error listening to notifications:", error);
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
