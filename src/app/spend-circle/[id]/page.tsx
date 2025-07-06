
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getCircleById } from '@/services/circleService';
import { getDebtsForCircle } from '@/services/debtService';
import type { Circle, Debt, UserProfile } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ArrowRight, Users, VenetianMask } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

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

    useEffect(() => {
        if (!circleId || !user) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [circleData, debtsData] = await Promise.all([
                    getCircleById(circleId),
                    getDebtsForCircle(circleId)
                ]);

                if (circleData && circleData.memberIds.includes(user.uid)) {
                    setCircle(circleData);
                    setDebts(debtsData);
                } else {
                    // Not a member or circle doesn't exist
                    router.push('/spend-circle');
                }
            } catch (error) {
                console.error("Failed to fetch circle details:", error);
                router.push('/spend-circle');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [circleId, user, router]);

    const simplifiedDebts = useMemo((): SimplifiedDebt[] => {
        if (!circle || debts.length === 0) return [];

        const balances = new Map<string, number>();
        Object.keys(circle.members).forEach(uid => balances.set(uid, 0));

        debts.forEach(debt => {
            balances.set(debt.debtorId, (balances.get(debt.debtorId) || 0) - debt.amount);
            balances.set(debt.creditorId, (balances.get(debt.creditorId) || 0) + debt.amount);
        });

        const debtors = Array.from(balances.entries()).filter(([, balance]) => balance < 0).map(([uid, balance]) => ({ uid, balance }));
        const creditors = Array.from(balances.entries()).filter(([, balance]) => balance > 0).map(([uid, balance]) => ({ uid, balance }));
        
        const settlements: SimplifiedDebt[] = [];

        while (debtors.length > 0 && creditors.length > 0) {
            const debtor = debtors[0];
            const creditor = creditors[0];
            const amount = Math.min(-debtor.balance, creditor.balance);

            settlements.push({
                from: circle.members[debtor.uid],
                to: circle.members[creditor.uid],
                amount: amount
            });

            debtor.balance += amount;
            creditor.balance -= amount;

            if (Math.abs(debtor.balance) < 0.01) debtors.shift();
            if (Math.abs(creditor.balance) < 0.01) creditors.shift();
        }

        return settlements;
    }, [circle, debts]);

    if (isLoading) {
        return <CircleDetailSkeleton />;
    }

    if (!circle) {
        return null; // or a not found page
    }

    return (
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

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><VenetianMask /> Balance Sheet</CardTitle>
                        <CardDescription>The simplest way to settle up all debts in the group.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {simplifiedDebts.length > 0 ? (
                            simplifiedDebts.map((debt, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8"><AvatarImage src={debt.from.photoURL}/><AvatarFallback>{debt.from.displayName.charAt(0)}</AvatarFallback></Avatar>
                                        <p className="font-medium text-sm">{debt.from.displayName}</p>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <ArrowRight className="size-5 text-primary"/>
                                        <span className="text-xs font-bold text-primary">₹{debt.amount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className="font-medium text-sm">{debt.to.displayName}</p>
                                        <Avatar className="h-8 w-8"><AvatarImage src={debt.to.photoURL}/><AvatarFallback>{debt.to.displayName.charAt(0)}</AvatarFallback></Avatar>
                                    </div>
                                </div>
                            ))
                        ) : (
                             <div className="text-center text-sm text-muted-foreground py-6">
                                <p className="font-semibold">All Settled Up!</p>
                                <p>There are no outstanding debts in this circle.</p>
                            </div>
                        )}
                         <Button className="w-full mt-4" disabled>Settle Up (Coming Soon)</Button>
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
                         <Button variant="outline" className="w-full mt-4" disabled>Invite Friends (Coming Soon)</Button>
                    </CardContent>
                </Card>
            </div>
        </div>
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
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
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
        </div>
    );
}

