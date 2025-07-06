"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getCircleById, addMembersToCircle } from '@/services/circleService';
import { getDebtsForCircle, settleDebt } from '@/services/debtService';
import type { Circle, Debt, UserProfile } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ArrowRight, Users, VenetianMask, Check, Loader2, List, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { toast } from 'sonner';
import { InviteToCircleDialog } from '@/components/invite-to-circle-dialog';

type SimplifiedDebt = {
    from: UserProfile;
    to: UserProfile;
    amount: number;
}

export default function CircleDetailPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const circleId = params.id as string;

    const [circle, setCircle] = useState<Circle | null>(null);
    const [debts, setDebts] = useState<Debt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [settlingDebtId, setSettlingDebtId] = useState<string | null>(null);
    const [isInviteOpen, setIsInviteOpen] = useState(false);

    const fetchCircleData = useCallback(async () => {
        if (!circleId || !user) return;
        setIsLoading(true);
        try {
            const circleData = await getCircleById(circleId);
            
            if (!circleData || !circleData.memberIds.includes(user.uid)) {
                router.push('/spend-circle');
                return;
            }

            const debtsData = await getDebtsForCircle(circleId);
            
            setCircle(circleData);
            setDebts(debtsData);

        } catch (error) {
            console.error("Failed to fetch circle details:", error);
            router.push('/spend-circle');
        } finally {
            setIsLoading(false);
        }
    }, [circleId, user, router]);

    useEffect(() => {
        fetchCircleData();
    }, [fetchCircleData]);

    const handleSettleDebt = async (debtId: string) => {
        setSettlingDebtId(debtId);
        try {
            await settleDebt(debtId);
            toast.success("Debt marked as settled!");
            await fetchCircleData();
        } catch (error) {
            toast.error("Failed to settle debt.");
        } finally {
            setSettlingDebtId(null);
        }
    }

    const simplifiedDebts = useMemo((): SimplifiedDebt[] => {
        if (!circle || debts.length === 0) return [];
        const unsettledDebts = debts.filter(d => !d.isSettled);
        if (unsettledDebts.length === 0) return [];

        const balances = new Map<string, number>();
        Object.keys(circle.members).forEach(uid => balances.set(uid, 0));

        unsettledDebts.forEach(debt => {
            balances.set(debt.debtorId, (balances.get(debt.debtorId) || 0) - debt.amount);
            balances.set(debt.creditorId, (balances.get(debt.creditorId) || 0) + debt.amount);
        });

        const debtors = Array.from(balances.entries()).filter(([, balance]) => balance < 0).map(([uid, balance]) => ({ uid, balance: -balance }));
        const creditors = Array.from(balances.entries()).filter(([, balance]) => balance > 0).map(([uid, balance]) => ({ uid, balance }));
        
        const settlements: SimplifiedDebt[] = [];
        
        let i = 0, j = 0;
        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            const amount = Math.min(debtor.balance, creditor.balance);

            if (amount > 0.01) { 
                 settlements.push({
                    from: circle.members[debtor.uid],
                    to: circle.members[creditor.uid],
                    amount: amount
                });
            }

            debtor.balance -= amount;
            creditor.balance -= amount;

            if (debtor.balance < 0.01) i++;
            if (creditor.balance < 0.01) j++;
        }

        return settlements;
    }, [circle, debts]);
    
    const individualDebts = useMemo(() => debts.filter(d => !d.isSettled), [debts]);

    if (isLoading) return <CircleDetailSkeleton />;
    if (!circle) return null;

    return (
        <>
        <div className="space-y-6">
            <Link href="/spend-circle" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" /> Back to Circles
            </Link>
            
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold font-headline">{circle.name}</h1>
                <div className="flex -space-x-2 overflow-hidden">
                    {Object.values(circle.members).map(member => (
                        <Avatar key={member.uid} className="inline-block h-8 w-8 rounded-full ring-2 ring-background">
                            <AvatarImage src={member.photoURL || undefined} />
                            <AvatarFallback>{member.displayName.charAt(0)}</AvatarFallback>
                        </Avatar>
                    ))}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><VenetianMask /> Simplified Settlement</CardTitle>
                        <CardDescription>The easiest way to settle all group debts. Settle individual debts below.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {simplifiedDebts.length > 0 ? (
                            simplifiedDebts.map((debt, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8"><AvatarImage src={debt.from.photoURL || undefined}/><AvatarFallback>{debt.from.displayName.charAt(0)}</AvatarFallback></Avatar>
                                        <p className="font-medium text-sm">{debt.from.displayName}</p>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <ArrowRight className="size-5 text-primary"/>
                                        <span className="text-xs font-bold text-primary">₹{debt.amount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className="font-medium text-sm">{debt.to.displayName}</p>
                                        <Avatar className="h-8 w-8"><AvatarImage src={debt.to.photoURL || undefined}/><AvatarFallback>{debt.to.displayName.charAt(0)}</AvatarFallback></Avatar>
                                    </div>
                                </div>
                            ))
                        ) : (
                             <div className="text-center text-sm text-muted-foreground py-6">
                                <p className="font-semibold">All Settled Up!</p>
                                <p>There are no outstanding debts in this circle.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users /> Members</CardTitle>
                        <CardDescription>{Object.keys(circle.members).length} people in this circle.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {Object.values(circle.members).map(member => (
                            <div key={member.uid} className="flex items-center justify-between p-2">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={member.photoURL || undefined} />
                                        <AvatarFallback>{member.displayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium">{member.displayName}</p>
                                        <p className="text-xs text-muted-foreground">{member.email}</p>
                                    </div>
                                </div>
                                {member.uid === circle.ownerId && <Badge variant="secondary">Owner</Badge>}
                                {member.uid === user?.uid && <Badge>You</Badge>}
                            </div>
                        ))}
                         <Button variant="outline" className="w-full mt-4" onClick={() => setIsInviteOpen(true)} disabled={user?.uid !== circle.ownerId}>
                            <UserPlus className="mr-2" /> Invite Friends
                         </Button>
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><List /> Outstanding Debts</CardTitle>
                    <CardDescription>A list of all individual unsettled transactions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {individualDebts.length > 0 ? (
                        individualDebts.map(debt => (
                            <div key={debt.id} className="flex items-center justify-between p-3 rounded-lg border">
                                <div className="flex items-center gap-4">
                                     <Avatar className="h-10 w-10"><AvatarImage src={debt.debtor.photoURL || undefined}/><AvatarFallback>{debt.debtor.displayName.charAt(0)}</AvatarFallback></Avatar>
                                     <div>
                                        <p className="text-sm">
                                            <span className="font-bold">{debt.debtor.displayName}</span> owes <span className="font-bold">{debt.creditor.displayName}</span>
                                        </p>
                                        <p className="font-bold text-lg text-primary">₹{debt.amount.toFixed(2)}</p>
                                        <p className="text-xs text-muted-foreground">For: {debt.transactionDescription}</p>
                                     </div>
                                </div>
                                {user?.uid === debt.creditorId && (
                                     <Button size="sm" onClick={() => handleSettleDebt(debt.id)} disabled={settlingDebtId === debt.id}>
                                        {settlingDebtId === debt.id ? <Loader2 className="animate-spin" /> : <Check />}
                                        Mark as Settled
                                     </Button>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-sm text-muted-foreground py-6">
                            <p className="font-semibold">No individual debts to settle.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
        {circle && <InviteToCircleDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} circle={circle} onInviteSent={fetchCircleData} />}
        </>
    );
}

function CircleDetailSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <Skeleton className="h-6 w-40" />
            <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-60" />
                <div className="flex -space-x-2 overflow-hidden">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
                    <CardContent className="space-y-3">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-10 w-full mt-4" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
                    <CardContent className="space-y-3">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </CardContent>
                </Card>
            </div>
            <Card>
                <CardHeader><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4 w-1/3 mt-2" /></CardHeader>
                <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
        </div>
    );
}
