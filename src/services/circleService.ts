
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, Timestamp, doc, getDoc, updateDoc, writeBatch, onSnapshot, Unsubscribe, deleteDoc, arrayRemove, deleteField, arrayUnion } from "firebase/firestore";
import type { UserProfile, Circle } from "@/lib/data";
import { deleteDebtsForCircle } from "./debtService";

const circlesRef = collection(db, "circles");

interface CreateCircleInput {
    name: string;
    owner: UserProfile;
    members: UserProfile[];
}

export async function createCircle({ name, owner, members }: CreateCircleInput) {
    if (!db) throw new Error("Firebase is not configured.");
    
    const memberIds = members.map(m => m.uid);
    const membersMap = members.reduce((acc, member) => {
        acc[member.uid] = member;
        return acc;
    }, {} as {[uid: string]: UserProfile});

    await addDoc(circlesRef, {
        name,
        ownerId: owner.uid,
        memberIds,
        members: membersMap,
        createdAt: Timestamp.now(),
    });
}

export function getCirclesForUserListener(userId: string, callback: (circles: Circle[]) => void): Unsubscribe {
    if (!db) return () => {};
    
    const q = query(circlesRef, where("memberIds", "array-contains", userId));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const circles: Circle[] = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const membersMap = data.members || {};
            // Sanitize photoURL to prevent 'undefined' values
            for (const uid in membersMap) {
                if (Object.prototype.hasOwnProperty.call(membersMap, uid)) {
                    membersMap[uid].photoURL = membersMap[uid].photoURL || null;
                }
            }
            circles.push({
                id: doc.id,
                ...data,
                members: membersMap,
                createdAt: (data.createdAt as Timestamp).toDate(),
            } as Circle);
        });
        callback(circles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    }, (error) => {
        console.error("Error listening to circles:", error);
    });

    return unsubscribe;
}

export async function getCircleById(circleId: string): Promise<Circle | null> {
    if (!db) return null;
    const circleDocRef = doc(db, "circles", circleId);
    try {
        const docSnap = await getDoc(circleDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const membersMap = data.members || {};
            for (const uid in membersMap) {
                if (Object.prototype.hasOwnProperty.call(membersMap, uid)) {
                    membersMap[uid].photoURL = membersMap[uid].photoURL || null;
                }
            }
            return {
                id: docSnap.id,
                ...data,
                members: membersMap,
                createdAt: (data.createdAt as Timestamp).toDate(),
            } as Circle;
        }
        return null;
    } catch (error) {
        console.error("Error getting circle by ID:", error);
        throw error;
    }
}

export async function leaveCircle(circleId: string, userId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    
    const circleRef = doc(db, "circles", circleId);
    const circleSnap = await getDoc(circleRef);

    if (!circleSnap.exists()) {
        throw new Error("Circle not found.");
    }
    
    const circleData = circleSnap.data() as Circle;
    
    if (!circleData.memberIds.includes(userId)) {
        throw new Error("You are not a member of this circle.");
    }
    
    const remainingMemberIds = circleData.memberIds.filter(id => id !== userId);
    const updates: {[key: string]: any} = {
        memberIds: arrayRemove(userId),
        [`members.${userId}`]: deleteField(),
    };
    
    // If the leaving user was the owner AND there are members left, reassign ownership.
    // If they are the last one, the circle becomes ownerless but persists.
    if (circleData.ownerId === userId && remainingMemberIds.length > 0) {
        updates.ownerId = remainingMemberIds[0]; 
    }

    await updateDoc(circleRef, updates);
}

export async function addMembersToCircle(circleId: string, membersToAdd: UserProfile[]) {
    if (!db) throw new Error("Firebase is not configured.");
    if (membersToAdd.length === 0) return;

    const circleRef = doc(db, "circles", circleId);

    const memberIds = membersToAdd.map(m => m.uid);
    const membersMapUpdates = membersToAdd.reduce((acc, member) => {
        acc[`members.${member.uid}`] = {
            uid: member.uid,
            displayName: member.displayName,
            email: member.email,
            photoURL: member.photoURL || null,
        };
        return acc;
    }, {} as { [key: string]: any });

    const updatePayload = {
        memberIds: arrayUnion(...memberIds),
        ...membersMapUpdates
    };

    await updateDoc(circleRef, updatePayload);
}
