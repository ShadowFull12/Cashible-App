
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, Timestamp, doc, getDoc, updateDoc, arrayUnion, writeBatch, onSnapshot, Unsubscribe, deleteDoc } from "firebase/firestore";
import type { UserProfile, Circle, CircleInvitation } from "@/lib/data";
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
}

export async function sendCircleInvitations(circleId: string, circleName: string, fromUser: UserProfile, friendsToInvite: UserProfile[]) {
    if (!db) throw new Error("Firebase is not configured.");

    const invitationPromises = friendsToInvite.map(async (friend) => {
        const q = query(
            circleInvitationsRef, 
            where("circleId", "==", circleId), 
            where("toUserId", "==", friend.uid),
            where("status", "==", "pending")
        );
        const existingInvites = await getDocs(q);
        if (!existingInvites.empty) {
            console.log(`Invitation for ${friend.displayName} to circle ${circleName} already exists.`);
            return;
        }

        const invitationDocRef = await addDoc(circleInvitationsRef, {
            circleId,
            circleName,
            fromUser,
            toUserId: friend.uid,
            status: 'pending',
            createdAt: Timestamp.now(),
        });

        await createNotification({
            userId: friend.uid,
            fromUser: fromUser,
            type: 'circle-invitation',
            message: `${fromUser.displayName} invited you to join the circle "${circleName}".`,
            link: `/notifications`,
            relatedId: invitationDocRef.id
        });
    });
    
    await Promise.all(invitationPromises);
}

export function getCircleInvitationsListener(userId: string, callback: (invitations: CircleInvitation[]) => void): Unsubscribe {
    if (!db) return () => {};
    
    const q = query(circleInvitationsRef, where("toUserId", "==", userId), where("status", "==", "pending"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const invitations: CircleInvitation[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            invitations.push({
                id: doc.id,
                ...data,
                createdAt: (data.createdAt as Timestamp).toDate(),
            } as CircleInvitation);
        });
        callback(invitations.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));
    }, (error) => {
        console.error("Error listening to circle invitations:", error);
    });
    
    return unsubscribe;
}

export async function acceptCircleInvitation(invitationId: string, user: UserProfile) {
    if (!db) throw new Error("Firebase not configured");
    const invitationRef = doc(db, 'circle-invitations', invitationId);
    const invitationSnap = await getDoc(invitationRef);

    if (!invitationSnap.exists() || invitationSnap.data().toUserId !== user.uid) {
        throw new Error("Invitation not found or you are not the recipient.");
    }
    
    const { circleId, circleName, fromUser } = invitationSnap.data();
    const circleRef = doc(db, "circles", circleId);

    const batch = writeBatch(db);
    
    batch.update(circleRef, {
        memberIds: arrayUnion(user.uid),
        [`members.${user.uid}`]: user
    });
    
    batch.delete(invitationRef);
    
    const notificationsQuery = query(collection(db, 'notifications'), where('relatedId', '==', invitationId));
    const notificationsSnapshot = await getDocs(notificationsQuery);
    notificationsSnapshot.forEach(doc => batch.delete(doc.ref));

    await batch.commit();

    await createNotification({
        userId: fromUser.uid,
        fromUser: user,
        type: 'circle-join',
        message: `${user.displayName} has joined your circle "${circleName}".`,
        link: `/spend-circle/${circleId}`,
    });
}

export async function rejectCircleInvitation(invitationId: string) {
    if (!db) throw new Error("Firebase not configured");
    const batch = writeBatch(db);
    
    const invitationRef = doc(db, 'circle-invitations', invitationId);
    batch.delete(invitationRef);

    const notificationsQuery = query(collection(db, 'notifications'), where('relatedId', '==', invitationId));
    const notificationsSnapshot = await getDocs(notificationsQuery);
    notificationsSnapshot.forEach(doc => batch.delete(doc.ref));

    await batch.commit();
}

export async function deleteCircle(circleId: string, ownerId: string) {
    if (!db) throw new Error("Firebase not configured");
    
    const circleRef = doc(db, "circles", circleId);
    const circleSnap = await getDoc(circleRef);

    if (!circleSnap.exists()) {
        throw new Error("Circle not found.");
    }
    if (circleSnap.data().ownerId !== ownerId) {
        throw new Error("You are not the owner of this circle.");
    }
    
    const circleData = circleSnap.data() as Circle;
    const batch = writeBatch(db);
    
    await deleteDebtsForCircle(circleId, batch);
    
    const invitationsQuery = query(collection(db, 'circle-invitations'), where('circleId', '==', circleId));
    const invitationsSnapshot = await getDocs(invitationsQuery);
    invitationsSnapshot.forEach(doc => batch.delete(doc.ref));

    batch.delete(circleRef);

    await batch.commit();
    
    const ownerProfile = circleData.members[ownerId] || { displayName: 'The owner', uid: ownerId, email: '', photoURL: null };
    const notificationPromises = circleData.memberIds
        .filter(id => id !== ownerId)
        .map(memberId => 
            createNotification({
                userId: memberId,
                fromUser: ownerProfile,
                type: 'circle-deleted',
                message: `${ownerProfile.displayName} has deleted the circle "${circleData.name}".`,
                link: '/spend-circle'
            })
        );
        
    await Promise.all(notificationPromises);
}
