
import { db } from "@/lib/firebase";
import { collection, addDoc, query, onSnapshot, Unsubscribe, Timestamp, orderBy, updateDoc, doc } from "firebase/firestore";
import type { ChatMessage, UserProfile } from "@/lib/data";

interface SendMessageInput {
    circleId: string;
    user: UserProfile;
    text?: string;
    mediaURL?: string;
    mediaType?: 'image' | 'receipt';
}

export async function sendChatMessage(data: SendMessageInput) {
    if (!db) throw new Error("Firebase is not configured.");
    
    const circleRef = doc(db, "circles", data.circleId);
    const chatCollectionRef = collection(circleRef, "chats");

    await addDoc(chatCollectionRef, {
        ...data,
        createdAt: Timestamp.now(),
    });

    // Update the circle's last message timestamp to trigger unread indicators
    await updateDoc(circleRef, {
        lastMessageAt: Timestamp.now(),
    });
}

export function getChatMessagesListener(circleId: string, callback: (messages: ChatMessage[]) => void): Unsubscribe {
    if (!db) return () => {};
    
    const chatCollectionRef = collection(db, "circles", circleId, "chats");
    const q = query(chatCollectionRef, orderBy("createdAt", "asc"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const messages: ChatMessage[] = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
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
    });
}
