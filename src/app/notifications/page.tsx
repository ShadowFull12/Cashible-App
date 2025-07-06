
"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/hooks/use-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, UserPlus, CircleDollarSign, BellRing } from 'lucide-react';
import type { Notification } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';

const iconMap = {
    'friend-request': UserPlus,
    'circle-invite': BellRing,
    'debt-settlement-request': CircleDollarSign,
    'debt-settlement-confirmed': Check,
};

export default function NotificationsPage() {
    const router = useRouter();
    const { notifications, isLoading, markAsRead, markAllAsRead, unreadNotificationCount } = useData();

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read) {
            await markAsRead(notification.id);
        }
        router.push(notification.link);
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
                    return (
                        <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={cn(
                                "flex items-start gap-4 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50",
                                !notification.read && "bg-muted/30 border-primary/20"
                            )}
                        >
                            {!notification.read && (
                                <div className="h-2 w-2 rounded-full bg-primary mt-2.5" />
                            )}
                            <div className={cn("flex-shrink-0 pt-1", notification.read && "ml-4")}>
                               <Icon className="size-6 text-muted-foreground" />
                            </div>
                            <div className="flex-grow">
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
                            </div>
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
