
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, Timestamp, doc, getDoc, updateDoc, arrayUnion, writeBatch, onSnapshot, Unsubscribe, deleteDoc } from "firebase/firestore";
import type { UserProfile, Circle } from "@/lib/data";
import { createNotification } from './notificationService';
import { deleteDebtsForCircle } from "./debtService";

const circlesRef = collection(db, "circles");
const circleInvitationsRef = collection(db, "circle-invitations");

interface CreateCircleInput {
    name: string;
    owner: UserProfile;
    friendsToInvite: UserProfile[];
}

export async function createCircle({ name, owner, friendsToInvite }: CreateCircleInput) {
    if (!db) throw new Error("Firebase is not configured.");
    
    // Circle only contains the owner initially
    const membersMap = { [owner.uid]: owner };

    const circleDocRef = await addDoc(circlesRef, {
        name,
        ownerId: owner.uid,
        memberIds: [owner.uid],
        members: membersMap,
        createdAt: Timestamp.now(),
    });

    // Send invitations to the selected friends
    if (friendsToInvite.length > 0) {
        await sendCircleInvitations(circleDocRef.id, name, owner, friendsToInvite);
    }
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

export async function sendCircleInvitations(circleId: string, circleName: string, fromUser: UserProfile, friendsToInvite: UserProfile[]) {
    if (!db) throw new Error("Firebase is not configured.");
    const batch = writeBatch(db);

    const notificationPromises: Promise<any>[] = [];

    for (const friend of friendsToInvite) {
        // Check if invitation already exists
        const q = query(circleInvitationsRef, where("circleId", "==", circleId), where("toUserId", "==", friend.uid));
        const existingInvites = await getDocs(q);
        if (!existingInvites.empty) {
            console.log(`Invitation for ${friend.displayName} to circle ${circleName} already exists.`);
            continue; // Skip if invite already sent
        }

        const invitationRef = doc(circleInvitationsRef);
        batch.set(invitationRef, {
            circleId,
            circleName,
            fromUser,
            toUserId: friend.uid,
            status: 'pending',
            createdAt: Timestamp.now(),
        });
        
        notificationPromises.push(createNotification({
            userId: friend.uid,
            fromUser: fromUser,
            type: 'circle-invitation',
            message: `${fromUser.displayName} invited you to join the circle "${circleName}".`,
            link: `/notifications`,
            relatedId: invitationRef.id
        }));
    }
    
    await batch.commit();
    await Promise.all(notificationPromises);
}

export function getCircleInvitationsListener(userId: string, callback: (requests: any[]) => void): Unsubscribe {
    if (!db) return () => {};
    
    const q = query(circleInvitationsRef, where("toUserId", "==", userId), where("status", "==", "pending"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const invitations: any[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            invitations.push({
                id: doc.id,
                ...data,
                createdAt: (data.createdAt as Timestamp).toDate(),
            });
        });
        callback(invitations.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));
    }, (error) => {
        console.error("Error listening to circle invitations:", error);
    });
    
    return unsubscribe;
}


export async function addMembersToCircle(circleId: string, friendsToAdd: UserProfile[], inviter: UserProfile) {
    if (!db) throw new Error("Firebase is not configured.");
    const circleRef = doc(db, "circles", circleId);

    const circleSnap = await getDoc(circleRef);
    if (!circleSnap.exists()) throw new Error("Circle not found.");
    const circleName = circleSnap.data().name;

    await sendCircleInvitations(circleId, circleName, inviter, friendsToAdd);
}

export async function acceptCircleInvitation(invitationId: string, user: UserProfile) {
    if (!db) throw new Error("Firebase not configured");
    const invitationRef = doc(db, 'circle-invitations', invitationId);
    const invitationSnap = await getDoc(invitationRef);

    if (!invitationSnap.exists() || invitationSnap.data().toUserId !== user.uid) {
        throw new Error("Invitation not found or you are not the recipient.");
    }
    
    const { circleId } = invitationSnap.data();
    const circleRef = doc(db, "circles", circleId);

    const batch = writeBatch(db);
    
    // Add user to circle
    batch.update(circleRef, {
        memberIds: arrayUnion(user.uid),
        [`members.${user.uid}`]: user
    });
    
    // Delete invitation
    batch.delete(invitationRef);
    
    await batch.commit();
}

export async function rejectCircleInvitation(invitationId: string) {
    if (!db) throw new Error("Firebase not configured");
    const invitationRef = doc(db, 'circle-invitations', invitationId);
    await deleteDoc(invitationRef);
}

export async function deleteCircle(circleId: string, ownerId: string) {
    if (!db) throw new Error("Firebase not configured");
    
    const circleRef = doc(db, "circles", circleId);
    const circleSnap = await getDoc(circleRef);

    if (!circleSnap.exists() || circleSnap.data().ownerId !== ownerId) {
        throw new Error("Circle not found or you are not the owner.");
    }
    
    const circleData = circleSnap.data() as Circle;
    const batch = writeBatch(db);
    
    // Delete the circle itself
    batch.delete(circleRef);
    
    // Delete all debts associated with the circle
    await deleteDebtsForCircle(circleId, batch);
    
    // Delete pending invitations for this circle
    const invitationsQuery = query(collection(db, 'circle-invitations'), where('circleId', '==', circleId));
    const invitationsSnapshot = await getDocs(invitationsQuery);
    invitationsSnapshot.forEach(doc => batch.delete(doc.ref));

    await batch.commit();
    
    // Send notifications to all members (except owner)
    const notificationPromises = circleData.memberIds
        .filter(id => id !== ownerId)
        .map(memberId => 
            createNotification({
                userId: memberId,
                fromUser: circleData.members[ownerId], // The owner's profile
                type: 'circle-deleted',
                message: `${circleData.members[ownerId].displayName} has deleted the circle "${circleData.name}".`,
                link: '/spend-circle'
            })
        );
        
    await Promise.all(notificationPromises);
}
