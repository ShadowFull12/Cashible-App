
import { db } from "@/lib/firebase";
import { 
    collection, addDoc, getDocs, query, where, doc, updateDoc, Timestamp, writeBatch, deleteDoc, getDoc, or, onSnapshot, Unsubscribe
} from "firebase/firestore";
import type { UserProfile, FriendRequest } from "@/lib/data";
import type { User } from 'firebase/auth';
import { createNotification } from './notificationService';

const friendRequestsRef = collection(db, "friend-requests");
const friendshipsRef = collection(db, "friendships");

// 1. Send a friend request
export async function sendFriendRequest(fromUser: UserProfile, toUserId: string) {
    if (!db) throw new Error("Firebase is not configured.");

    // Check if a PENDING request already exists between these users
    const q = query(friendRequestsRef, 
        where("status", "==", "pending"),
        or(
            where("fromUser.uid", "==", toUserId),
            where("toUserId", "==", toUserId)
        )
    );

    const querySnapshot = await getDocs(q);
    const existingRequest = querySnapshot.docs.find(d => {
        const data = d.data();
        return (data.fromUser.uid === fromUser.uid || data.toUserId === fromUser.uid);
    });

    if (existingRequest) {
        throw new Error("A friend request is already pending with this user.");
    }

    // Check if they are already friends
    const friendsQuery = query(friendshipsRef, where('userIds', 'array-contains', fromUser.uid));
    const friendsSnapshot = await getDocs(friendsQuery);
    const isAlreadyFriend = friendsSnapshot.docs.some(doc => doc.data().userIds.includes(toUserId));

    if (isAlreadyFriend) {
        throw new Error("You are already friends with this user.");
    }

    const newRequestRef = await addDoc(friendRequestsRef, {
        fromUser,
        toUserId,
        status: 'pending',
        createdAt: Timestamp.now()
    });

    await createNotification({
        userId: toUserId,
        fromUser: fromUser,
        type: 'friend-request',
        message: `${fromUser.displayName} sent you a friend request.`,
        link: '/notifications',
    });
}

// 2. Get friend requests for the current user (real-time listener)
export function getFriendRequestsListener(userId: string, callback: (requests: FriendRequest[]) => void): Unsubscribe {
    if (!db) return () => {};
    
    // We listen for any request where the status is pending and the current user is involved.
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
            },
            [fromUser.uid]: {
                displayName: fromUser.displayName,
                email: fromUser.email,
                photoURL: fromUser.photoURL || null
            }
        },
        createdAt: Timestamp.now()
    });

    // Delete the original friend request document now that it's been accepted.
    batch.delete(requestDocRef);

    await batch.commit();
}

// 4. Reject a friend request
export async function rejectFriendRequest(requestId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    const requestDocRef = doc(db, "friend-requests", requestId);
    // Instead of just updating status, we delete the rejected request to keep the collection clean.
    await deleteDoc(requestDocRef);
}

// 5. Get a user's friends
export async function getFriends(userId: string): Promise<UserProfile[]> {
    if (!db) return [];
    const q = query(friendshipsRef, where('userIds', 'array-contains', userId));
    const querySnapshot = await getDocs(q);

    const friends: UserProfile[] = [];
    querySnapshot.forEach(doc => {
        const data = doc.data();
        const friendId = data.userIds.find((id: string) => id !== userId);
        if (friendId) {
            const friendData = data.users[friendId];
            friends.push({
                uid: friendId,
                displayName: friendData.displayName,
                email: friendData.email,
                photoURL: friendData.photoURL,
            });
        }
    });

    return friends;
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

    await batch.commit();
}
