
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import type { UserProfile, Circle } from "@/lib/data";

const circlesRef = collection(db, "circles");

interface CreateCircleInput {
    name: string;
    ownerId: string;
    friends: UserProfile[]; // Includes the owner
}

export async function createCircle({ name, ownerId, friends }: CreateCircleInput) {
    if (!db) throw new Error("Firebase is not configured.");
    
    const memberIds = friends.map(f => f.uid);
    const membersMap = friends.reduce((acc, friend) => {
        acc[friend.uid] = friend;
        return acc;
    }, {} as {[uid: string]: UserProfile});

    await addDoc(circlesRef, {
        name,
        ownerId,
        memberIds,
        members: membersMap,
        createdAt: Timestamp.now(),
    });
}

export async function getCirclesForUser(userId: string): Promise<Circle[]> {
    if (!db) return [];
    
    const q = query(circlesRef, where("memberIds", "array-contains", userId));
    const querySnapshot = await getDocs(q);

    const circles: Circle[] = [];
    querySnapshot.forEach(doc => {
        const data = doc.data();
        circles.push({
            id: doc.id,
            ...data,
            createdAt: (data.createdAt as Timestamp).toDate(),
        } as Circle);
    });

    return circles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
