
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, Timestamp, doc, getDoc, updateDoc, writeBatch, onSnapshot, Unsubscribe, deleteDoc, arrayRemove, deleteField, arrayUnion, FieldValue } from "firebase/firestore";
import type { UserProfile, Circle } from "@/lib/data";
import { addCircleTransactionsDeletionsToBatch } from "./transactionService";
import { addCircleSettlementsDeletionsToBatch } from "./debtService";


interface CreateCircleInput {
    name: string;
    owner: UserProfile;
    members: UserProfile[];
}

export async function createCircle({ name, owner, members }: CreateCircleInput) {
    if (!db) throw new Error("Firebase is not configured.");
    const circlesRef = collection(db, "circles");
    
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
        photoURL: null,
        lastMessageAt: null,
        lastRead: {},
        unreadCounts: {},
    });
}

export function getCirclesForUserListener(userId: string, callback: (circles: Circle[]) => void): Unsubscribe {
    if (!db) return () => {};
    const circlesRef = collection(db, "circles");
    
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
                lastMessageAt: data.lastMessageAt ? (data.lastMessageAt as Timestamp).toDate() : null,
                lastRead: data.lastRead ? Object.entries(data.lastRead).reduce((acc, [uid, ts]) => {
                    acc[uid] = (ts as Timestamp).toDate();
                    return acc;
                }, {} as {[uid: string]: Date}) : {},
                unreadCounts: data.unreadCounts || {},
            } as Circle);
        });
        callback(circles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    }, (error) => {
        console.error("Error listening to circles:", error);
    });

    return unsubscribe;
}

export function getCircleListener(circleId: string, callback: (circle: Circle | null) => void): Unsubscribe {
    if (!db) return () => {};
    const circleDocRef = doc(db, "circles", circleId);

    const unsubscribe = onSnapshot(circleDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const membersMap = data.members || {};
            for (const uid in membersMap) {
                if (Object.prototype.hasOwnProperty.call(membersMap, uid)) {
                    membersMap[uid].photoURL = membersMap[uid].photoURL || null;
                }
            }
            callback({
                id: docSnap.id,
                ...data,
                members: membersMap,
                createdAt: (data.createdAt as Timestamp).toDate(),
                lastMessageAt: data.lastMessageAt ? (data.lastMessageAt as Timestamp).toDate() : null,
                lastRead: data.lastRead ? Object.entries(data.lastRead).reduce((acc, [uid, ts]) => {
                    acc[uid] = (ts as Timestamp).toDate();
                    return acc;
                }, {} as {[uid: string]: Date}) : {},
                unreadCounts: data.unreadCounts || {},
            } as Circle);
        } else {
            callback(null);
        }
    }, (error) => {
        console.error(`Error listening to circle ${circleId}:`, error);
        callback(null);
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

async function deleteCircleAndRelatedData(circleId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    const batch = writeBatch(db);
    
    // Delete associated transactions
    await addCircleTransactionsDeletionsToBatch(circleId, batch);
    
    // Delete associated settlements
    await addCircleSettlementsDeletionsToBatch(circleId, batch);

    // Delete the circle itself
    const circleRef = doc(db, "circles", circleId);
    batch.delete(circleRef);

    await batch.commit();
}


export async function leaveCircle(circleId: string, userId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    
    const circleRef = doc(db, "circles", circleId);
    const circleSnap = await getDoc(circleRef);

    if (!circleSnap.exists()) {
        throw new Error("Circle not found.");
    }
    
    const circleData = circleSnap.data();
    
    if (!circleData.memberIds.includes(userId)) {
        throw new Error("You are not a member of this circle.");
    }

    if (circleData.memberIds.length === 1 && circleData.memberIds[0] === userId) {
        // This is the last member, delete the circle and its related data
        await deleteCircleAndRelatedData(circleId);
    } else {
        const updates: {[key: string]: any} = {
            memberIds: arrayRemove(userId),
            [`members.${userId}`]: deleteField(),
            [`unreadCounts.${userId}`]: deleteField(),
        };
        
        // If the leaving user was the owner, reassign ownership to the next member.
        if (circleData.ownerId === userId) {
            const newOwnerId = circleData.memberIds.find((id: string) => id !== userId);
            updates.ownerId = newOwnerId; 
        }

        await updateDoc(circleRef, updates);
    }
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
        acc[`unreadCounts.${member.uid}`] = 0;
        return acc;
    }, {} as { [key: string]: any });

    const updatePayload = {
        memberIds: arrayUnion(...memberIds),
        ...membersMapUpdates
    };

    await updateDoc(circleRef, updatePayload);
}

export async function uploadCircleMedia(file: File): Promise<string> {
    const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
    if (!apiKey) {
        throw new Error("ImgBB API key is not configured.");
    }
    const formData = new FormData();
    formData.append("image", file);
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
    });
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error?.message || "Failed to upload media.");
    }
    return result.data.url;
}

export async function updateCircle(circleId: string, data: { name?: string; photoURL?: string }) {
    if (!db) throw new Error("Firebase is not configured.");
    const circleRef = doc(db, "circles", circleId);
    await updateDoc(circleRef, data);
}
