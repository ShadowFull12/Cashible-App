
"use client";

import React, { useState, useMemo } from 'react';
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useData } from "@/hooks/use-data";
import { UserProfile, FriendRequest as FriendRequestData, Circle } from '@/lib/data';
import { searchUsersByEmail } from '@/services/userService';
import { sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend } from '@/services/friendService';
import { Loader2, UserPlus, UserCheck, UserX, Clock, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CreateCircleDialog } from '@/components/create-circle-dialog';


function AddFriendTab() {
    const { user } = useAuth();
    const { friends, friendRequests, refreshData } = useData();
    const [searchEmail, setSearchEmail] = useState("");
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState<{[key: string]: boolean}>({});

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchEmail) return;
        setIsLoading(true);
        try {
            const results = await searchUsersByEmail(searchEmail);
            setSearchResults(results.filter(u => u.uid !== user?.uid)); // Exclude self
        } catch (error) {
            toast.error("Failed to search for users.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendRequest = async (toUser: UserProfile) => {
        if (!user || !user.displayName) return;
        setIsSending(prev => ({...prev, [toUser.uid]: true}));
        try {
            const fromUser = {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email!,
                photoURL: user.photoURL || '',
            };
            await sendFriendRequest(fromUser, toUser.uid);
            toast.success(`Friend request sent to ${toUser.displayName}`);
            await refreshData();
        } catch (error: any) {
            toast.error(error.message || "Failed to send friend request.");
        } finally {
            setIsSending(prev => ({...prev, [toUser.uid]: false}));
        }
    }
    
    const getButtonState = (targetUser: UserProfile) => {
        const isFriend = friends.some(f => f.uid === targetUser.uid);
        if (isFriend) return { text: "Already Friends", disabled: true, icon: <UserCheck className="mr-2"/> };

        const pendingRequest = friendRequests.find(req => 
            (req.fromUser.uid === user?.uid && req.toUserId === targetUser.uid && req.status === 'pending') ||
            (req.fromUser.uid === targetUser.uid && req.toUserId === user?.uid && req.status === 'pending')
        );
        if (pendingRequest) return { text: "Request Pending", disabled: true, icon: <Clock className="mr-2"/> };

        return { text: "Add Friend", disabled: false, icon: <UserPlus className="mr-2"/> };
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Find New Friends</h3>
                <p className="text-sm text-muted-foreground">Search for users by their exact email address to add them to your circle.</p>
            </div>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
                <Input
                    type="email"
                    placeholder="friend@example.com"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !searchEmail}>
                    {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
                </Button>
            </form>
            <div className="space-y-4">
                <h4 className="font-medium">Search Results</h4>
                {isLoading && <Skeleton className="h-20 w-full" />}
                {!isLoading && searchResults.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No users found. Try another email.</p>}
                {!isLoading && searchResults.map(foundUser => {
                    const buttonState = getButtonState(foundUser);
                    return (
                        <div key={foundUser.uid} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-4">
                                <Avatar><AvatarImage src={foundUser.photoURL || undefined} /><AvatarFallback>{foundUser.displayName.charAt(0)}</AvatarFallback></Avatar>
                                <div>
                                    <p className="font-semibold">{foundUser.displayName}</p>
                                    <p className="text-sm text-muted-foreground">{foundUser.email}</p>
                                </div>
                            </div>
                            <Button size="sm" onClick={() => handleSendRequest(foundUser)} disabled={buttonState.disabled || isSending[foundUser.uid]}>
                                {isSending[foundUser.uid] ? <Loader2 className="mr-2 animate-spin"/> : buttonState.icon}
                                {buttonState.text}
                            </Button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function RequestsTab() {
    const { user } = useAuth();
    const { friendRequests, isLoading, refreshData } = useData();
    const [isProcessing, setIsProcessing] = useState<{[key: string]: boolean}>({});

    const incomingRequests = useMemo(() => {
        return friendRequests.filter(req => req.toUserId === user?.uid && req.status === 'pending');
    }, [friendRequests, user]);
    
    const handleAccept = async (request: FriendRequestData) => {
        setIsProcessing(prev => ({...prev, [request.id]: true}));
        try {
            await acceptFriendRequest(request.id, user!, request.fromUser);
            toast.success(`${request.fromUser.displayName} is now your friend!`);
            await refreshData();
        } catch (error) {
            toast.error("Failed to accept request.");
        } finally {
            setIsProcessing(prev => ({...prev, [request.id]: false}));
        }
    }

    const handleDecline = async (requestId: string) => {
        setIsProcessing(prev => ({...prev, [requestId]: true}));
        try {
            await rejectFriendRequest(requestId);
            toast.info("Friend request declined.");
            await refreshData();
        } catch (error) {
            toast.error("Failed to decline request.");
        } finally {
            setIsProcessing(prev => ({...prev, [requestId]: false}));
        }
    }

    if (isLoading) return <Skeleton className="h-40 w-full" />;

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Incoming Friend Requests</h3>
            {incomingRequests.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">You have no new friend requests.</p>}
            {incomingRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-4">
                        <Avatar><AvatarImage src={req.fromUser.photoURL || undefined} /><AvatarFallback>{req.fromUser.displayName.charAt(0)}</AvatarFallback></Avatar>
                        <div>
                            <p className="font-semibold">{req.fromUser.displayName}</p>
                            <p className="text-sm text-muted-foreground">{req.fromUser.email}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                         <Button size="sm" onClick={() => handleAccept(req)} disabled={isProcessing[req.id]}>
                            {isProcessing[req.id] ? <Loader2 className="animate-spin" /> : <UserCheck />}
                         </Button>
                         <Button size="sm" variant="destructive" onClick={() => handleDecline(req.id)} disabled={isProcessing[req.id]}>
                            {isProcessing[req.id] ? <Loader2 className="animate-spin" /> : <UserX />}
                         </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}

function FriendsTab() {
    const { friends, isLoading, refreshData } = useData();
    const { user } = useAuth();

    const handleRemoveFriend = async (friendToRemove: UserProfile) => {
        if (!user) return;
        try {
            await removeFriend(user.uid, friendToRemove.uid);
            toast.success(`${friendToRemove.displayName} has been removed from your friends.`);
            await refreshData();
        } catch (error) {
            toast.error("Failed to remove friend.");
        }
    }

    if (isLoading) return <Skeleton className="h-40 w-full" />;
    
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">My Friends ({friends.length})</h3>
             {friends.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">You haven't added any friends yet. Use the 'Add Friend' tab to start your circle!</p>}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {friends.map(friend => (
                     <div key={friend.uid} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-4">
                            <Avatar><AvatarImage src={friend.photoURL || undefined} /><AvatarFallback>{friend.displayName.charAt(0)}</AvatarFallback></Avatar>
                            <div>
                                <p className="font-semibold">{friend.displayName}</p>
                                <p className="text-sm text-muted-foreground">{friend.email}</p>
                            </div>
                        </div>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive"><UserX /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Remove {friend.displayName}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will remove them from your friends list. You can add them again later.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemoveFriend(friend)}>Remove</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                ))}
             </div>
        </div>
    );
}

function CirclesTab() {
    const { circles, isLoading } = useData();
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    if (isLoading) {
        return <Skeleton className="h-40 w-full" />;
    }

    return (
        <>
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">My Circles ({circles.length})</h3>
                <Button onClick={() => setIsCreateOpen(true)}>Create Circle</Button>
            </div>
            {circles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                    You're not part of any circles yet. Create one to start splitting expenses with groups!
                </p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {circles.map(circle => (
                        <Card key={circle.id}>
                            <CardHeader>
                                <CardTitle>{circle.name}</CardTitle>
                                <CardDescription>{Object.keys(circle.members).length} members</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex -space-x-2 overflow-hidden">
                                    {Object.values(circle.members).slice(0, 5).map(member => (
                                        <Avatar key={member.uid} className="inline-block h-8 w-8 rounded-full ring-2 ring-background">
                                            <AvatarImage src={member.photoURL || undefined} />
                                            <AvatarFallback>{member.displayName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    ))}
                                    {Object.keys(circle.members).length > 5 && (
                                        <Avatar className="inline-block h-8 w-8 rounded-full ring-2 ring-background">
                                            <AvatarFallback>+{Object.keys(circle.members).length - 5}</AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
        <CreateCircleDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
        </>
    );
}

export default function SpendCirclePage() {
    return (
        <div className="grid gap-6">
            <h1 className="text-3xl font-bold font-headline">Spend Circle</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Manage Your Social Circle</CardTitle>
                    <CardDescription>Add friends, create circles, and prepare for splitting expenses.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Tabs defaultValue="friends">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="friends">My Friends</TabsTrigger>
                            <TabsTrigger value="requests">Requests</TabsTrigger>
                            <TabsTrigger value="circles">My Circles</TabsTrigger>
                            <TabsTrigger value="add">Add Friend</TabsTrigger>
                        </TabsList>
                        <TabsContent value="friends" className="mt-6">
                            <FriendsTab />
                        </TabsContent>
                        <TabsContent value="requests" className="mt-6">
                            <RequestsTab />
                        </TabsContent>
                         <TabsContent value="circles" className="mt-6">
                            <CirclesTab />
                        </TabsContent>
                         <TabsContent value="add" className="mt-6">
                            <AddFriendTab />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}
