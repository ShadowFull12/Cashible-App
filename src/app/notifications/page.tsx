
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/hooks/use-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, UserPlus, CircleDollarSign, BellRing, Loader2, UserCheck, UserX, X, FilePlus, CheckCircle2, XCircle, ClipboardCheck, ClipboardX, HandCoins, Wallet, Trash2 } from 'lucide-react';
import type { Notification, UserProfile } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { acceptFriendRequest, rejectFriendRequest } from '@/services/friendService';
import { deleteNotification } from '@/services/notificationService';
import { acceptExpenseClaim, rejectExpenseClaim } from '@/services/expenseClaimService';
import { acceptSettlement, rejectSettlement, logSettlementAsExpense, logSettlementAsIncome } from '@/services/debtService';
import { deleteTransaction } from '@/services/transactionService';

const iconMap: {[key: string]: React.ElementType} = {
    'friend-request': UserPlus,
    'expense-claim-request': FilePlus,
    'expense-claim-accepted': CheckCircle2,
    'expense-claim-rejected': XCircle,
    'settlement-request': HandCoins,
    'settlement-expense-pending': Wallet,
    'settlement-income-pending': Wallet,
    'settlement-rejected': XCircle,
    'circle-member-joined': UserCheck,
    'circle-expense-removed-by-owner': Trash2,
    // Legacy types
    'debt-settlement-request': CircleDollarSign,
    'debt-settlement-confirmed': Check,
    'debt-settlement-rejected': XCircle,
    'settlement-confirmed': HandCoins,
    'settlement-payment-received': Wallet,
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

        const isActionable = notification.type === 'friend-request' ||
                             notification.type === 'expense-claim-request' ||
                             notification.type === 'settlement-request' ||
                             notification.type === 'settlement-expense-pending' ||
                             notification.type === 'settlement-income-pending' ||
                             notification.type === 'circle-expense-removed-by-owner';
        
        if (isActionable) {
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

    const handleAcceptClaim = async (notification: Notification) => {
        if (!notification.relatedId) return;
        setProcessingId(notification.id);
        try {
            await acceptExpenseClaim(notification.relatedId);
            toast.success("Expense claim accepted and logged.");
            await refreshData();
        } catch (error: any) {
            toast.error("Failed to accept claim.", { description: error.message });
        } finally {
            setProcessingId(null);
        }
    }

    const handleDeclineClaim = async (notification: Notification) => {
        if (!notification.relatedId) return;
        setProcessingId(notification.id);
        try {
            await rejectExpenseClaim(notification.relatedId);
            toast.info("Expense claim declined.");
        } catch (error: any) {
            toast.error("Failed to decline claim.", { description: error.message });
        } finally {
            setProcessingId(null);
        }
    }

    const handleAcceptSettlement = async (notification: Notification) => {
        if (!notification.relatedId) return;
        setProcessingId(notification.id);
        try {
            await acceptSettlement(notification.relatedId);
            toast.success("Settlement confirmed and logged!");
        } catch (error: any) {
            toast.error("Failed to confirm settlement.", { description: error.message });
        } finally {
            setProcessingId(null);
        }
    }

    const handleDeclineSettlement = async (notification: Notification) => {
        if (!notification.relatedId) return;
        setProcessingId(notification.id);
        try {
            await rejectSettlement(notification.relatedId);
            toast.info("Settlement rejected.");
        } catch (error: any) {
            toast.error("Failed to reject settlement.", { description: error.message });
        } finally {
            setProcessingId(null);
        }
    }

    const handleLogSettlement = async (notification: Notification) => {
        if (!notification.relatedId) return;
        setProcessingId(notification.id);
        try {
            await logSettlementAsExpense(notification.relatedId, notification.id);
            toast.success("Settlement logged as a personal expense.");
        } catch (error: any) {
            toast.error("Failed to log settlement.", { description: error.message });
        } finally {
            setProcessingId(null);
        }
    }

    const handleLogIncome = async (notification: Notification) => {
        if (!notification.relatedId || !user) return;
        setProcessingId(notification.id);
        try {
            await logSettlementAsIncome(notification.relatedId, notification.id);
            toast.success("Income logged successfully.");
        } catch (error: any) {
            toast.error("Failed to log income.", { description: error.message });
        } finally {
            setProcessingId(null);
        }
    }

    const handleDeleteFromHistory = async (notification: Notification) => {
        if (!notification.relatedId) return;
        setProcessingId(notification.id);
        try {
            await deleteTransaction(notification.relatedId);
            await deleteNotification(notification.id);
            toast.success("Expense deleted from your personal history.");
        } catch (e: any) {
            toast.error("Failed to delete expense", { description: e.message });
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><Bell /> Notifications</CardTitle>
                    <CardDescription>All your recent account activity.</CardDescription>
                </div>
                <Button variant="outline" onClick={markAllAsRead} disabled={unreadNotificationCount === 0} className="w-full sm:w-auto">
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
                    
                    const isFriendRequest = notification.type === 'friend-request';
                    const matchingFriendRequest = isFriendRequest
                        ? friendRequests.find(req => req.fromUser.uid === notification.fromUser.uid && req.toUserId === user?.uid && req.status === 'pending')
                        : undefined;
                    
                    const isClaimRequest = notification.type === 'expense-claim-request';
                    const isSettlementRequest = notification.type === 'settlement-request';
                    const isSettlementExpensePending = notification.type === 'settlement-expense-pending';
                    const isSettlementIncomePending = notification.type === 'settlement-income-pending';
                    const isExpenseRemovedByOwner = notification.type === 'circle-expense-removed-by-owner';
                    
                    const isActionable = !!matchingFriendRequest || isClaimRequest || isSettlementRequest || isSettlementExpensePending || isSettlementIncomePending || isExpenseRemovedByOwner;
                    const isProcessing = (matchingFriendRequest && processingId === matchingFriendRequest.id) || processingId === notification.id;

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
                                    
                                    {!!matchingFriendRequest && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleAcceptFriend(matchingFriendRequest!.id, notification.fromUser); }} disabled={isProcessing}>
                                                {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <UserCheck className="mr-2 size-4"/>} Accept
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleDeclineFriend(matchingFriendRequest!.id); }} disabled={isProcessing}>
                                                {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <UserX className="mr-2 size-4"/>} Decline
                                            </Button>
                                        </div>
                                    )}

                                    {isClaimRequest && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleAcceptClaim(notification); }} disabled={isProcessing}>
                                                {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <ClipboardCheck className="mr-2 size-4"/>} Accept & Log
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleDeclineClaim(notification); }} disabled={isProcessing}>
                                                {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <ClipboardX className="mr-2 size-4"/>} Decline
                                            </Button>
                                        </div>
                                    )}

                                     {isSettlementRequest && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleAcceptSettlement(notification); }} disabled={isProcessing}>
                                                {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <Check className="mr-2 size-4"/>} Confirm
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleDeclineSettlement(notification); }} disabled={isProcessing}>
                                                {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <X className="mr-2 size-4"/>} Decline
                                            </Button>
                                        </div>
                                    )}

                                    {isSettlementExpensePending && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleLogSettlement(notification); }} disabled={isProcessing}>
                                                {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <ClipboardCheck className="mr-2 size-4"/>} Log as Expense
                                            </Button>
                                        </div>
                                    )}

                                    {isSettlementIncomePending && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleLogIncome(notification); }} disabled={isProcessing}>
                                                {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <Wallet className="mr-2 size-4"/>} Log as Income
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {isExpenseRemovedByOwner && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleDeleteFromHistory(notification); }} disabled={isProcessing}>
                                                {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin"/> : <Trash2 className="mr-2 size-4"/>} Delete from My History
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
