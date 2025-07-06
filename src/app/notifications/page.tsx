
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/hooks/use-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, UserPlus, CircleDollarSign, BellRing, Loader2, UserCheck, UserX, X, DoorOpen, DoorClosed } from 'lucide-react';
import type { Notification, UserProfile } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { acceptFriendRequest, rejectFriendRequest } from '@/services/friendService';
import { acceptCircleInvitation, rejectCircleInvitation } from '@/services/circleService';
import { deleteNotification } from '@/services/notificationService';


const iconMap: {[key: string]: React.ElementType} = {
    'friend-request': UserPlus,
    'circle-invitation': BellRing,
    'circle-join': UserCheck,
    'debt-settlement-request': CircleDollarSign,
    'debt-settlement-confirmed': Check,
    'circle-deleted': Bell,
};

export default function NotificationsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { notifications, isLoading, markAsRead, markAllAsRead, unreadNotificationCount, friendRequests, circleInvitations, refreshData } = useData();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read) {
            await markAsRead(notification.id);
        }

        const isPendingFriendRequest = notification.type === 'friend-request' && 
            friendRequests.some(req => 
                req.fromUser.uid === notification.fromUser.uid && 
                req.toUserId === user?.uid && 
                req.status === 'pending'
            );
        
        const isPendingCircleInvite = notification.type === 'circle-invitation' &&
            circleInvitations.some(inv => inv.id === notification.relatedId && inv.status === 'pending');

        if (isPendingFriendRequest || isPendingCircleInvite) {
            return;
        }
        
        if (notification.link) {
            router.push(notification.link);
        }
    };

    const handleAcceptFriend = async (requestId: string, fromUser: UserProfile) => {
        if (!user) return;
        setProcessingId(requestId);
        try {
            await acceptFriendRequest(requestId, user, fromUser);
            toast.success(`You are now friends with ${fromUser.displayName}!`);
            await refreshData();
        } catch (error) {
            toast.error("Failed to accept request.");
            console.error(error);
        } finally {
            setProcessingId(null);
        }
    };
    
    const handleDeclineFriend = async (requestId: string) => {
        setProcessingId(requestId);
        try {
            await rejectFriendRequest(requestId);
            toast.info("Friend request declined.");
        } catch (error) {
            toast.error("Failed to decline request.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleAcceptInvitation = async (invitationId: string) => {
        if (!user) return;
        setProcessingId(invitationId);
        try {
            await acceptCircleInvitation(invitationId, {
                uid: user.uid,
                displayName: user.displayName || 'User',
                email: user.email || '',
                photoURL: user.photoURL || null
            });
            toast.success(`You have joined the circle!`);
            await refreshData();
        } catch (error) {
            toast.error("Failed to accept invitation.");
            console.error(error);
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeclineInvitation = async (invitationId: string) => {
        setProcessingId(invitationId);
        try {
            await rejectCircleInvitation(invitationId);
            toast.info("Circle invitation declined.");
        } catch (error) {
            toast.error("Failed to decline invitation.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeleteNotification = async (notification: Notification) => {
        let idToProcess = notification.id;
        try {
            if (notification.type === 'friend-request') {
                const matchingFriendRequest = friendRequests.find(req => req.fromUser.uid === notification.fromUser.uid && req.toUserId === user?.uid && req.status === 'pending');
                if (matchingFriendRequest) {
                    idToProcess = matchingFriendRequest.id;
                    setProcessingId(idToProcess);
                    await rejectFriendRequest(matchingFriendRequest.id);
                }
            } else if (notification.type === 'circle-invitation') {
                const matchingInvite = circleInvitations.find(inv => inv.id === notification.relatedId && inv.status === 'pending');
                if (matchingInvite) {
                    idToProcess = matchingInvite.id;
                    setProcessingId(idToProcess);
                    await rejectCircleInvitation(matchingInvite.id);
                }
            } else {
                 setProcessingId(idToProcess);
                 await deleteNotification(notification.id);
            }
            
            toast.success("Notification dismissed.");
        } catch (e: any) {
            toast.error("Failed to dismiss notification.", { description: e.message });
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><Bell /> Notifications</CardTitle>
                    <CardDescription>All your recent account activity.</CardDescription>
                </div>
                <Button variant="outline" onClick={markAllAsRead} disabled={unreadNotificationCount === 0}>
                    Mark all as read
                </Button>
            </CardHeader>
            <CardContent className="space-y-3">
                {isLoading && Array.from({ length: 3 }).map((_, i) => <NotificationSkeleton key={i} />)}
                {!isLoading && notifications.length === 0 && (
                    <div className="text-center text-muted-foreground py-10">
                        <p>You have no notifications.</p>
                        <p className="text-sm">We'll let you know when something happens!</p>
                    </div>
                )}
                {!isLoading && notifications.map(notification => {
                    const Icon = iconMap[notification.type] || Bell;
                    
                    const matchingFriendRequest = notification.type === 'friend-request'
                        ? friendRequests.find(req => req.fromUser.uid === notification.fromUser.uid && req.toUserId === user?.uid && req.status === 'pending')
                        : undefined;

                    const matchingCircleInvitation = notification.type === 'circle-invitation'
                        ? circleInvitations.find(inv => inv.id === notification.relatedId && inv.status === 'pending')
                        : undefined;
                    
                    const isActionable = matchingFriendRequest || matchingCircleInvitation;
                    const isProcessing = processingId === matchingFriendRequest?.id || processingId === notification.id || processingId === matchingCircleInvitation?.id;

                    return (
                        <div
                            key={notification.id}
                            className={cn(
                                "group relative flex items-start gap-3 p-3 rounded-lg border transition-colors",
                                !notification.read && "bg-muted/30 border-primary/20",
                                !isActionable && "hover:bg-muted/50"
                            )}
                        >
                            <div className="flex-grow flex items-start gap-3" onClick={() => handleNotificationClick(notification)}>
                                {!notification.read && ( <div className="h-2 w-2 rounded-full bg-primary mt-2.5 flex-shrink-0" /> )}
                                <div className={cn("flex-shrink-0 pt-1", notification.read && "ml-4")}>
                                    <Icon className="size-6 text-muted-foreground" />
                                </div>
                                <div className={cn("flex-grow", isActionable ? "" : "cursor-pointer")}>
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={notification.fromUser.photoURL || undefined} />
                                            <AvatarFallback>{notification.fromUser.displayName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <p className="text-sm">{notification.message}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                                    </p>
                                    
                                    {matchingFriendRequest && (
                                        <div className="flex gap-2 mt-2">
                                            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleAcceptFriend(matchingFriendRequest.id, notification.fromUser); }} disabled={isProcessing}>
                                                {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <UserCheck className="mr-2 size-4"/>} Accept
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleDeclineFriend(matchingFriendRequest.id); }} disabled={isProcessing}>
                                                {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <UserX className="mr-2 size-4"/>} Decline
                                            </Button>
                                        </div>
                                    )}

                                    {matchingCircleInvitation && (
                                        <div className="flex gap-2 mt-2">
                                            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleAcceptInvitation(matchingCircleInvitation.id); }} disabled={isProcessing}>
                                                {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <DoorOpen className="mr-2 size-4"/>} Accept
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleDeclineInvitation(matchingCircleInvitation.id); }} disabled={isProcessing}>
                                                {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <DoorClosed className="mr-2 size-4"/>} Decline
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteNotification(notification); }} disabled={isProcessing} className="absolute top-1 right-1 h-7 w-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive" aria-label="Dismiss notification">
                                <X className="size-4" />
                            </Button>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

function NotificationSkeleton() {
    return (
        <div className="flex items-start gap-4 p-3 rounded-lg border">
            <Skeleton className="h-6 w-6 rounded-full" />
            <div className="flex-grow space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
            </div>
        </div>
    );
}
