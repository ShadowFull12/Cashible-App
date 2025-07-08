
import { db } from "@/lib/firebase";
import { 
    collection, addDoc, getDocs, query, where, doc, updateDoc, Timestamp, writeBatch, deleteDoc, getDoc, or, onSnapshot, Unsubscribe, and, WriteBatch
} from "firebase/firestore";
import type { UserProfile, FriendRequest } from "@/lib/data";
import type { User } from 'firebase/auth';
import { createNotification, deleteNotificationByRelatedId } from './notificationService';

const friendRequestsRef = collection(db, "friend-requests");
const friendshipsRef = collection(db, "friendships");

// 1. Send a friend request
export async function sendFriendRequest(fromUser: UserProfile, toUserId: string) {
    if (!db) throw new Error("Firebase is not configured.");

    const q = query(friendRequestsRef, 
        and(
            where("status", "==", "pending"),
            or(
                and(
                    where('fromUser.uid', '==', fromUser.uid), 
                    where('toUserId', '==', toUserId)
                ),
                and(
                    where('fromUser.uid', '==', toUserId), 
                    where('toUserId', '==', fromUser.uid)
                )
            )
        )
    );

    const pendingSnapshot = await getDocs(q);

    if (!pendingSnapshot.empty) {
         throw new Error("A friend request is already pending between you two.");
    }
    
    const friendsQuery = query(friendshipsRef, where('userIds', 'array-contains', fromUser.uid));
    const friendsSnapshot = await getDocs(friendsQuery);
    const isAlreadyFriend = friendsSnapshot.docs.some(doc => doc.data().userIds.includes(toUserId));

    if (isAlreadyFriend) {
        throw new Error("You are already friends with this user.");
    }

    const newRequestRef = await addDoc(friendRequestsRef, {
        fromUser: {
            ...fromUser,
            photoURL: fromUser.photoURL || null,
        },
        toUserId,
        status: 'pending',
        createdAt: Timestamp.now()
    });

    await createNotification({
        userId: toUserId,
        fromUser: {
            ...fromUser,
            photoURL: fromUser.photoURL || null,
        },
        type: 'friend-request',
        message: `${fromUser.displayName} sent you a friend request.`,
        link: '/notifications',
        relatedId: newRequestRef.id,
    });
}

// 2. Get friend requests for the current user (real-time listener)
export function getFriendRequestsListener(userId: string, callback: (requests: FriendRequest[]) => void): Unsubscribe {
    if (!db) return () => {};
    
    const q = query(friendRequestsRef, 
        where("status", "==", "pending"),
        where("toUserId", "==", userId)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const requests: FriendRequest[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            requests.push({
                id: doc.id,
                ...data,
                fromUser: {
                    ...data.fromUser,
                    photoURL: data.fromUser.photoURL || null
                },
                createdAt: (data.createdAt as Timestamp).toDate(),
            } as FriendRequest);
        });
        callback(requests.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));
    }, (error) => {
        console.error("Error listening to friend requests:", error);
    });
    
    return unsubscribe;
}

// 3. Accept a friend request
export async function acceptFriendRequest(requestId: string, currentUser: User, fromUser: UserProfile) {
    if (!db) throw new Error("Firebase is not configured.");
    const requestDocRef = doc(db, "friend-requests", requestId);

    const batch = writeBatch(db);

    // Add friendship document
    const friendshipDocRef = doc(collection(db, "friendships"));
    batch.set(friendshipDocRef, {
        userIds: [currentUser.uid, fromUser.uid],
        users: {
            [currentUser.uid]: {
                displayName: currentUser.displayName,
                email: currentUser.email,
                photoURL: currentUser.photoURL || null,
                username: (await getDoc(doc(db, 'users', currentUser.uid))).data()?.username,
            },
            [fromUser.uid]: {
                displayName: fromUser.displayName,
                email: fromUser.email,
                photoURL: fromUser.photoURL || null,
                username: fromUser.username,
            }
        },
        createdAt: Timestamp.now()
    });

    // Delete the original friend request document now that it's been accepted.
    batch.delete(requestDocRef);

    // Find and delete the associated notification
    await deleteNotificationByRelatedId(requestId, batch);

    await batch.commit();
}

// 4. Reject a friend request
export async function rejectFriendRequest(requestId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    const requestDocRef = doc(db, "friend-requests", requestId);
    const batch = writeBatch(db);
    batch.delete(requestDocRef);
    await deleteNotificationByRelatedId(requestId, batch);
    await batch.commit();
}

// 5. Get a user's friends via a real-time listener
export function getFriendsListener(userId: string, callback: (friends: UserProfile[]) => void): Unsubscribe {
    if (!db) return () => {};
    
    const q = query(friendshipsRef, where('userIds', 'array-contains', userId));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const friends: UserProfile[] = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const friendId = data.userIds.find((id: string) => id !== userId);
            if (friendId && data.users[friendId]) {
                const friendData = data.users[friendId];
                friends.push({
                    uid: friendId,
                    displayName: friendData.displayName,
                    email: friendData.email,
                    photoURL: friendData.photoURL || null,
                    username: friendData.username,
                });
            }
        });
        callback(friends);
    }, (error) => {
        console.error("Error listening to friends:", error);
    });

    return unsubscribe;
}


// 6. Remove a friend
export async function removeFriend(currentUserId: string, friendId: string) {
    if (!db) throw new Error("Firebase is not configured.");

    const q = query(
        friendshipsRef, 
        where('userIds', 'in', [[currentUserId, friendId], [friendId, currentUserId]])
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
        throw new Error("Friendship not found.");
    }
    
    const batch = writeBatch(db);
    querySnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });

    // Also remove any pending friend requests between them
    const requestQuery = query(friendRequestsRef, 
        or(
            and(where('fromUser.uid', '==', currentUserId), where('toUserId', '==', friendId)),
            and(where('fromUser.uid', '==', friendId), where('toUserId', '==', currentUserId))
        )
    );
    const requestSnapshot = await getDocs(requestQuery);
    requestSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
}

// 7. Add friend request deletions to a batch
export async function addFriendRequestsDeletionsToBatch(userId: string, batch: WriteBatch) {
    if (!db) return;

    // Create two separate queries for requests sent and received
    const toUserQuery = query(friendRequestsRef, where("toUserId", "==", userId));
    const fromUserQuery = query(friendRequestsRef, where("fromUser.uid", "==", userId));
    
    const [toUserSnapshot, fromUserSnapshot] = await Promise.all([
        getDocs(toUserQuery),
        getDocs(fromUserQuery)
    ]);

    const docsToDelete = new Map<string, any>();
    toUserSnapshot.forEach(doc => docsToDelete.set(doc.id, doc.ref));
    fromUserSnapshot.forEach(doc => docsToDelete.set(doc.id, doc.ref));
    
    docsToDelete.forEach(ref => batch.delete(ref));
}
