
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getCircleListener } from '@/services/circleService';
import type { Circle, UserProfile, Transaction, Settlement } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Users, AlertCircle, VenetianMask, History, SlidersHorizontal, MessageSquare, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OverviewTab } from '@/components/circle/overview-tab';
import { BalancesTab } from '@/components/circle/balances-tab';
import { HistoryTab } from '@/components/circle/history-tab';
import { ManageTab } from '@/components/circle/manage-tab';
import { ChatTab } from '@/components/circle/chat-tab';
import { getCircleTransactionsListener, getCircleSettlementsListener } from '@/services/transactionService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useData } from '@/hooks/use-data';

export default function CircleDetailPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const circleId = params.id as string;
    const { setNewExpenseDefaultCircleId } = useData();

    const [circle, setCircle] = useState<Circle | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const isOwner = useMemo(() => circle?.ownerId === user?.uid, [circle, user]);

    useEffect(() => {
        if (circleId) {
            setNewExpenseDefaultCircleId(circleId);
        }
        return () => {
            setNewExpenseDefaultCircleId(null);
        };
    }, [circleId, setNewExpenseDefaultCircleId]);

    useEffect(() => {
        if (!circleId || !user) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setFetchError(null);

        const unsubscribes: (() => void)[] = [];

        const circleUnsubscribe = getCircleListener(circleId, (circleData) => {
            if (circleData) {
                if (!circleData.memberIds.includes(user.uid)) {
                    toast.error("You are no longer a member of this circle or it does not exist.");
                    router.push('/spend-circle');
                    return; 
                }
                setCircle(circleData);
            } else {
                toast.error("This circle could not be found.");
                router.push('/spend-circle');
            }
            setIsLoading(false);
        });
        unsubscribes.push(circleUnsubscribe);

        const txUnsubscribe = getCircleTransactionsListener(circleId, setTransactions);
        unsubscribes.push(txUnsubscribe);

        const settlementUnsubscribe = getCircleSettlementsListener(circleId, setSettlements);
        unsubscribes.push(settlementUnsubscribe);

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [circleId, user, router]);


    if (isLoading) return <CircleDetailSkeleton />;
    
    if (fetchError || !circle) {
        return (
            <div className="space-y-6">
                 <Link href="/spend-circle" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="size-4" /> Back to Circles
                </Link>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Circle</AlertTitle>
                    <AlertDescription>{fetchError || "The circle could not be found or you are not a member."}</AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Link href="/spend-circle" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" /> Back to Circles
            </Link>
            
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                     <Avatar className="h-16 w-16 border-2 border-primary/20">
                        <AvatarImage src={circle.photoURL || undefined} alt={circle.name} />
                        <AvatarFallback className="text-xl">
                            {circle.name?.charAt(0).toUpperCase() || '?'}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-3xl font-bold font-headline">{circle.name}</h1>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="size-4" />
                            <span>{Object.keys(circle.members).length} members</span>
                        </div>
                    </div>
                </div>
                 <div className="flex items-center gap-4">
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
                </div>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="overview">
                        <VenetianMask className="h-5 w-5 md:mr-2" />
                        <span className="hidden md:inline">Overview</span>
                    </TabsTrigger>
                    <TabsTrigger value="balances">
                        <Users className="h-5 w-5 md:mr-2" />
                        <span className="hidden md:inline">Balances</span>
                    </TabsTrigger>
                    <TabsTrigger value="history">
                        <History className="h-5 w-5 md:mr-2" />
                        <span className="hidden md:inline">History</span>
                    </TabsTrigger>
                    <TabsTrigger value="manage">
                        <SlidersHorizontal className="h-5 w-5 md:mr-2" />
                        <span className="hidden md:inline">Manage</span>
                    </TabsTrigger>
                    <TabsTrigger value="chat">
                        <MessageSquare className="h-5 w-5 md:mr-2" />
                        <span className="hidden md:inline">Chat</span>
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-6">
                    <OverviewTab circle={circle} transactions={transactions} settlements={settlements} />
                </TabsContent>
                <TabsContent value="balances" className="mt-6">
                    <BalancesTab circle={circle} transactions={transactions} settlements={settlements} />
                </TabsContent>
                <TabsContent value="history" className="mt-6">
                    <HistoryTab circle={circle} transactions={transactions} settlements={settlements} />
                </TabsContent>
                <TabsContent value="manage" className="mt-6">
                    <ManageTab circle={circle} isOwner={isOwner} />
                </TabsContent>
                <TabsContent value="chat" className="mt-6">
                    <ChatTab circle={circle} />
                </TabsContent>
            </Tabs>

        </div>
    );
}

function CircleDetailSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <Skeleton className="h-6 w-40" />
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-5 w-24" />
                    </div>
                </div>
                <div className="flex -space-x-2 overflow-hidden">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>
            </div>
             <div className="w-full">
                <Skeleton className="h-10 w-full md:w-[480px] rounded-md" />
            </div>
            <Card>
                <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                <CardContent><Skeleton className="h-40 w-full" /></CardContent>
            </Card>
        </div>
    );
}
