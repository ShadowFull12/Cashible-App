
import { db } from "@/lib/firebase";
import { collection, addDoc, query, onSnapshot, Unsubscribe, Timestamp, orderBy, updateDoc, doc, writeBatch, increment, arrayUnion } from "firebase/firestore";
import type { ChatMessage, UserProfile, Circle } from "@/lib/data";

interface SendMessageInput {
    circle: Circle;
    user: UserProfile;
    text?: string;
    mediaURL?: string | null;
    mediaType?: 'image' | 'receipt';
    replyTo?: ChatMessage['replyTo'];
}

export async function sendChatMessage(data: SendMessageInput) {
    if (!db) throw new Error("Firebase is not configured.");
    
    const batch = writeBatch(db);
    const circleRef = doc(db, "circles", data.circle.id);
    const chatCollectionRef = collection(circleRef, "chats");
    const newChatDocRef = doc(chatCollectionRef);

    const messagePayload: Omit<ChatMessage, 'id' | 'createdAt'> = {
        circleId: data.circle.id,
        user: data.user,
        text: data.text,
        replyTo: data.replyTo || null,
        mediaURL: data.mediaURL || null,
        mediaType: data.mediaType,
    };
    batch.set(newChatDocRef, { ...messagePayload, createdAt: Timestamp.now() });

    const unreadUpdates = data.circle.memberIds
        .filter(id => id !== data.user.uid)
        .reduce((acc, memberId) => {
            acc[`unreadCounts.${memberId}`] = increment(1);
            return acc;
        }, {} as Record<string, any>);

    batch.update(circleRef, {
        lastMessageAt: Timestamp.now(),
        ...unreadUpdates
    });

    await batch.commit();
}


export function getChatMessagesListener(circleId: string, currentUserId: string, callback: (messages: ChatMessage[]) => void): Unsubscribe {
    if (!db) return () => {};
    
    const chatCollectionRef = collection(db, "circles", circleId, "chats");
    const q = query(chatCollectionRef, orderBy("createdAt", "asc"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const messages: ChatMessage[] = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            // Filter out messages deleted for the current user
            if (data.deletedFor && data.deletedFor.includes(currentUserId)) {
                return;
            }

            messages.push({
                id: doc.id,
                ...data,
                createdAt: (data.createdAt as Timestamp).toDate(),
            } as ChatMessage);
        });
        callback(messages);
    }, (error) => {
        console.error(`Error listening to chat messages for circle ${circleId}:`, error);
    });

    return unsubscribe;
}

export async function updateUserLastReadTimestamp(circleId: string, userId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    
    const circleRef = doc(db, "circles", circleId);
    await updateDoc(circleRef, {
        [`lastRead.${userId}`]: Timestamp.now(),
        [`unreadCounts.${userId}`]: 0
    });
}

export async function deleteMessageForEveryone(circleId: string, messageId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    const messageRef = doc(db, "circles", circleId, "chats", messageId);
    await updateDoc(messageRef, {
        isDeleted: true,
        text: "",
        mediaURL: null,
        mediaType: null,
        replyTo: null,
    });
}

export async function deleteMessageForMe(circleId: string, messageId: string, userId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    const messageRef = doc(db, "circles", circleId, "chats", messageId);
    await updateDoc(messageRef, {
        deletedFor: arrayUnion(userId)
    });
}
