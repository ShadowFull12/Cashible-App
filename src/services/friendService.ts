
import { db } from "@/lib/firebase";
import { 
    collection, addDoc, getDocs, query, where, doc, updateDoc, Timestamp, writeBatch, deleteDoc, getDoc, or
} from "firebase/firestore";
import type { UserProfile, FriendRequest } from "@/lib/data";
import type { User } from 'firebase/auth';

const friendRequestsRef = collection(db, "friend-requests");
const friendshipsRef = collection(db, "friendships");

// 1. Send a friend request
export async function sendFriendRequest(fromUser: UserProfile, toUserId: string) {
    if (!db) throw new Error("Firebase is not configured.");

    // Check if a request already exists between these users
    const q = query(friendRequestsRef, 
        or(
            where("fromUser.uid", "==", fromUser.uid),
            where("toUserId", "==", fromUser.uid)
        )
    );

    const querySnapshot = await getDocs(q);
    const existingRequest = querySnapshot.docs.find(d => {
        const data = d.data();
        return (data.fromUser.uid === toUserId && data.toUserId === fromUser.uid) || (data.fromUser.uid === fromUser.uid && data.toUserId === toUserId)
    });

    if (existingRequest) {
        throw new Error("A friend request already exists between you and this user.");
    }

    // Check if they are already friends
    const friendsQuery = query(friendshipsRef, where('userIds', 'array-contains', fromUser.uid));
    const friendsSnapshot = await getDocs(friendsQuery);
    const isAlreadyFriend = friendsSnapshot.docs.some(doc => doc.data().userIds.includes(toUserId));

    if (isAlreadyFriend) {
        throw new Error("You are already friends with this user.");
    }

    await addDoc(friendRequestsRef, {
        fromUser,
        toUserId,
        status: 'pending',
        createdAt: Timestamp.now()
    });
}

// 2. Get friend requests for the current user
export async function getFriendRequests(userId: string): Promise<FriendRequest[]> {
    if (!db) return [];
    
    // Incoming requests
    const incomingQuery = query(friendRequestsRef, where("toUserId", "==", userId), where("status", "==", "pending"));
    // Outgoing requests
    const outgoingQuery = query(friendRequestsRef, where("fromUser.uid", "==", userId), where("status", "==", "pending"));

    const [incomingSnapshot, outgoingSnapshot] = await Promise.all([
        getDocs(incomingQuery),
        getDocs(outgoingQuery)
    ]);
    
    const requests: FriendRequest[] = [];

    const processSnapshot = (snapshot: any) => {
        snapshot.forEach((doc: any) => {
            const data = doc.data();
            requests.push({
                id: doc.id,
                ...data,
                createdAt: (data.createdAt as Timestamp).toDate(),
            } as FriendRequest);
        });
    }

    processSnapshot(incomingSnapshot);
    processSnapshot(outgoingSnapshot);

    return requests.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
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
                photoURL: currentUser.photoURL || '',
            },
            [fromUser.uid]: {
                displayName: fromUser.displayName,
                email: fromUser.email,
                photoURL: fromUser.photoURL || ''
            }
        },
        createdAt: Timestamp.now()
    });

    // Update request status
    batch.update(requestDocRef, { status: 'accepted' });

    await batch.commit();
}

// 4. Reject a friend request
export async function rejectFriendRequest(requestId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    const requestDocRef = doc(db, "friend-requests", requestId);
    await updateDoc(requestDocRef, { status: 'rejected' });
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
