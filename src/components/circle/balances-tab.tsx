
"use client";

import React, { useState, useMemo } from 'react';
import type { Circle, Transaction, Settlement, UserProfile } from '@/lib/data';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ArrowRight, HandCoins } from 'lucide-react';
import { Button } from '../ui/button';
import { SettleDebtDialog } from './settle-debt-dialog';

interface BalancesTabProps {
    circle: Circle;
    transactions: Transaction[];
    settlements: Settlement[];
}

interface Balance {
    user: UserProfile;
    amount: number;
}

export function BalancesTab({ circle, transactions, settlements }: BalancesTabProps) {
    const { user: currentUser } = useAuth();
    const [settlementInfo, setSettlementInfo] = useState<{ user: UserProfile, amount: number } | null>(null);

    const netBalances = useMemo(() => {
        const balances = new Map<string, number>();

        // Initialize balances for all members
        Object.values(circle.members).forEach(member => {
            balances.set(member.uid, 0);
        });

        // Process split expenses
        transactions.forEach(tx => {
            if (tx.isSplit && tx.splitDetails) {
                const payerId = tx.splitDetails.payerId;
                const total = tx.amount;

                // Credit the payer
                balances.set(payerId, (balances.get(payerId) || 0) + total);

                // Debit each member for their share
                tx.splitDetails.members.forEach(member => {
                    balances.set(member.uid, (balances.get(member.uid) || 0) - member.share);
                });
            }
        });
        
        // Process confirmed settlements
        settlements.forEach(s => {
            if (s.status === 'confirmed') {
                // Debit the sender (fromUser) because they paid money
                balances.set(s.fromUserId, (balances.get(s.fromUserId) || 0) - s.amount);
                // Credit the receiver (toUser) because they received money
                balances.set(s.toUserId, (balances.get(s.toUserId) || 0) + s.amount);
            }
        });
        
        return balances;

    }, [circle.members, transactions, settlements]);

    const { youOwe, owesYou } = useMemo(() => {
        if (!currentUser) return { youOwe: [], owesYou: [] };

        // Simplified debt calculation using a greedy algorithm
        const debtors = Array.from(netBalances.entries())
            .filter(([, balance]) => balance < -0.01)
            .map(([uid, balance]) => ({ uid, balance: -balance })); // balance is positive amount owed
            
        const creditors = Array.from(netBalances.entries())
            .filter(([, balance]) => balance > 0.01)
            .map(([uid, balance]) => ({ uid, balance }));

        const simplifiedDebts: {from: string, to: string, amount: number}[] = [];

        let i = 0, j = 0;
        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            const amount = Math.min(debtor.balance, creditor.balance);
    
            if (amount > 0.01) { 
                 simplifiedDebts.push({ from: debtor.uid, to: creditor.uid, amount });
            }
    
            debtor.balance -= amount;
            creditor.balance -= amount;
    
            if (debtor.balance < 0.01) i++;
            if (creditor.balance < 0.01) j++;
        }
        
        const youOweList: Balance[] = simplifiedDebts
            .filter(d => d.from === currentUser.uid)
            .map(d => ({ user: circle.members[d.to], amount: d.amount }));

        const owesYouList: Balance[] = simplifiedDebts
            .filter(d => d.to === currentUser.uid)
            .map(d => ({ user: circle.members[d.from], amount: d.amount }));


        return { youOwe: youOweList, owesYou: owesYouList };

    }, [netBalances, currentUser, circle.members]);


    if (!currentUser) return null;
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>You Owe</CardTitle>
                    <CardDescription>Total amounts you need to pay back.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {youOwe.length > 0 ? (
                        youOwe.map(debt => (
                            <div key={debt.user.uid} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={debt.user.photoURL || undefined} />
                                        <AvatarFallback>{debt.user.displayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold">{debt.user.displayName}</p>
                                        <p className="font-bold text-destructive">₹{debt.amount.toFixed(2)}</p>
                                    </div>
                                </div>
                                <Button size="sm" onClick={() => setSettlementInfo({ user: debt.user, amount: debt.amount })}>
                                    <HandCoins className="mr-2" /> Pay Back
                                </Button>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">You're all settled up in this circle.</p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Owes You</CardTitle>
                    <CardDescription>Total amounts others need to pay you back.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {owesYou.length > 0 ? (
                        owesYou.map(credit => (
                             <div key={credit.user.uid} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={credit.user.photoURL || undefined} />
                                        <AvatarFallback>{credit.user.displayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold">{credit.user.displayName}</p>
                                        <p className="font-bold text-green-500">₹{credit.amount.toFixed(2)}</p>
                                    </div>
                                </div>
                                {/* <Button size="sm" variant="outline">Remind</Button> */}
                            </div>
                        ))
                    ) : (
                         <p className="text-sm text-muted-foreground text-center py-4">No one owes you money in this circle.</p>
                    )}
                </CardContent>
            </Card>

            {settlementInfo && (
                <SettleDebtDialog
                    open={!!settlementInfo}
                    onOpenChange={() => setSettlementInfo(null)}
                    toUser={settlementInfo.user}
                    amountOwed={settlementInfo.amount}
                    circle={circle}
                    onSettlementRequested={() => {
                        setSettlementInfo(null);
                        // No need to manually refetch; the listener will handle it.
                    }}
                />
            )}
        </div>
    );
}
