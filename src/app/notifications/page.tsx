
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/hooks/use-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, UserPlus, CircleDollarSign, BellRing, Loader2, UserCheck, UserX, X } from 'lucide-react';
import type { Notification, UserProfile } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { acceptFriendRequest, rejectFriendRequest } from '@/services/friendService';
import { deleteNotification } from '@/services/notificationService';


const iconMap = {
    'friend-request': UserPlus,
    'circle-invite': BellRing,
    'debt-settlement-request': CircleDollarSign,
    'debt-settlement-confirmed': Check,
};

export default function NotificationsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { notifications, isLoading, markAsRead, markAllAsRead, unreadNotificationCount, friendRequests, refreshData } = useData();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read) {
            await markAsRead(notification.id);
        }
        // Don't navigate for actionable requests, let the buttons handle it
        const isPendingFriendRequest = notification.type === 'friend-request' && 
            friendRequests.some(req => 
                req.fromUser.uid === notification.fromUser.uid && 
                req.toUserId === user?.uid && 
                req.status === 'pending'
            );

        if (isPendingFriendRequest) {
            return;
        }
        router.push(notification.link);
    };

    const handleAccept = async (requestId: string, fromUser: UserProfile) => {
        if (!user) return;
        setProcessingId(requestId);
        try {
            await acceptFriendRequest(requestId, user, fromUser);
            toast.success(`You are now friends with ${fromUser.displayName}!`);
            await refreshData(); // Refresh friends list
        } catch (error) {
            toast.error("Failed to accept request.");
            console.error(error);
        } finally {
            setProcessingId(null);
        }
    };
    
    const handleDecline = async (requestId: string) => {
        setProcessingId(requestId);
        try {
            await rejectFriendRequest(requestId);
            toast.info("Friend request declined.");
            // No need to refresh, listeners will handle it
        } catch (error) {
            toast.error("Failed to decline request.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeleteNotification = async (notificationId: string) => {
        try {
            await deleteNotification(notificationId);
            toast.success("Notification dismissed.");
        } catch(e) {
            toast.error("Failed to dismiss notification.");
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
                {isLoading && (
                    <>
                        <NotificationSkeleton />
                        <NotificationSkeleton />
                        <NotificationSkeleton />
                    </>
                )}
                {!isLoading && notifications.length === 0 && (
                    <div className="text-center text-muted-foreground py-10">
                        <p>You have no notifications.</p>
                        <p className="text-sm">We'll let you know when something happens!</p>
                    </div>
                )}
                {!isLoading && notifications.map(notification => {
                    const Icon = iconMap[notification.type] || Bell;
                    const matchingFriendRequest = notification.type === 'friend-request'
                        ? friendRequests.find(req => 
                            req.fromUser.uid === notification.fromUser.uid &&
                            req.toUserId === user?.uid &&
                            req.status === 'pending'
                          )
                        : undefined;
                    const isProcessing = processingId === matchingFriendRequest?.id;

                    return (
                        <div
                            key={notification.id}
                            className={cn(
                                "group relative flex items-start gap-3 p-3 rounded-lg border transition-colors",
                                !notification.read && "bg-muted/30 border-primary/20",
                                !matchingFriendRequest && "hover:bg-muted/50"
                            )}
                        >
                            <div className="flex-grow flex items-start gap-3" onClick={() => handleNotificationClick(notification)}>
                                {!notification.read && (
                                    <div className="h-2 w-2 rounded-full bg-primary mt-2.5 flex-shrink-0" />
                                )}
                                <div className={cn("flex-shrink-0 pt-1", notification.read && "ml-4")}>
                                <Icon className="size-6 text-muted-foreground" />
                                </div>
                                <div className="flex-grow cursor-pointer">
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
                                            <Button 
                                                size="sm" 
                                                onClick={(e) => { e.stopPropagation(); handleAccept(matchingFriendRequest.id, notification.fromUser); }} 
                                                disabled={isProcessing}
                                            >
                                                {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <UserCheck className="mr-2 size-4"/>}
                                                Accept
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                onClick={(e) => { e.stopPropagation(); handleDecline(matchingFriendRequest.id); }} 
                                                disabled={isProcessing}
                                            >
                                                {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <UserX className="mr-2 size-4"/>}
                                                Decline
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteNotification(notification.id);
                                }}
                                className="absolute top-1 right-1 h-7 w-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                                aria-label="Dismiss notification"
                            >
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
