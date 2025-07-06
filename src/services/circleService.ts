import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, Timestamp, doc, getDoc, updateDoc, arrayUnion, writeBatch } from "firebase/firestore";
import type { UserProfile, Circle } from "@/lib/data";
import { createNotification } from './notificationService';

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


export async function getCircleById(circleId: string): Promise<Circle | null> {
    if (!db) return null;
    const circleDocRef = doc(db, "circles", circleId);
    const docSnap = await getDoc(circleDocRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            createdAt: (data.createdAt as Timestamp).toDate(),
        } as Circle;
    }
    return null;
}

export async function addMembersToCircle(circleId: string, friendsToAdd: UserProfile[], inviter: UserProfile) {
    if (!db) throw new Error("Firebase is not configured.");
    const circleRef = doc(db, "circles", circleId);

    const circleSnap = await getDoc(circleRef);
    if (!circleSnap.exists()) throw new Error("Circle not found.");
    const circleName = circleSnap.data().name;

    const batch = writeBatch(db);

    const updates: {[key: string]: any} = {
        memberIds: arrayUnion(...friendsToAdd.map(f => f.uid))
    };

    friendsToAdd.forEach(friend => {
        updates[`members.${friend.uid}`] = friend;
    });

    batch.update(circleRef, updates);
    await batch.commit();

    // Create notifications after commit
    const notificationPromises = friendsToAdd.map(friend => {
        return createNotification({
            userId: friend.uid,
            fromUser: inviter,
            type: 'circle-invite',
            message: `${inviter.displayName} invited you to join the circle "${circleName}".`,
            link: `/spend-circle/${circleId}`
        });
    });

    await Promise.all(notificationPromises);
}
