
"use client";

import React, { useMemo } from 'react';
import type { Circle, Transaction, Settlement } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, Users, PiggyBank } from 'lucide-react';

interface OverviewTabProps {
    circle: Circle;
    transactions: Transaction[];
    settlements: Settlement[];
}

export function OverviewTab({ circle, transactions, settlements }: OverviewTabProps) {
    const totalSpent = useMemo(() => {
        return transactions.reduce((sum, tx) => tx.isSplit ? sum + tx.amount : sum, 0);
    }, [transactions]);
    
    const netBalances = useMemo(() => {
        const balances = new Map<string, number>();
        Object.values(circle.members).forEach(member => {
            balances.set(member.uid, 0);
        });

        transactions.forEach(tx => {
            if (tx.isSplit && tx.splitDetails) {
                balances.set(tx.splitDetails.payerId, (balances.get(tx.splitDetails.payerId) || 0) + tx.amount);
                tx.splitDetails.members.forEach(member => {
                    balances.set(member.uid, (balances.get(member.uid) || 0) - member.share);
                });
            }
        });
        
        settlements.forEach(s => {
            if (s.status === 'confirmed') {
                // fromUser paid toUser. fromUser's balance should increase (less debt). toUser's balance should decrease (less credit).
                balances.set(s.fromUserId, (balances.get(s.fromUserId) || 0) + s.amount);
                balances.set(s.toUserId, (balances.get(s.toUserId) || 0) - s.amount);
            }
        });
        
        return Array.from(balances.entries())
            .map(([uid, amount]) => ({ user: circle.members[uid], amount }))
            .sort((a,b) => b.amount - a.amount);

    }, [circle.members, transactions, settlements]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
                <CardHeader className="flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
                    <TrendingUp className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{totalSpent.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    <p className="text-xs text-muted-foreground">Across all members in this circle.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Members</CardTitle>
                    <Users className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{Object.keys(circle.members).length}</div>
                    <p className="text-xs text-muted-foreground">People sharing expenses.</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Settlements</CardTitle>
                    <PiggyBank className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{settlements.filter(s => s.status === 'confirmed').length}</div>
                    <p className="text-xs text-muted-foreground">Payments made between members.</p>
                </CardContent>
            </Card>

            <Card className="md:col-span-3">
                <CardHeader>
                    <CardTitle>Member Balances</CardTitle>
                    <CardDescription>A summary of who is a net creditor or debtor in the circle.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {netBalances.map(({ user, amount }) => (
                         <div key={user.uid} className="flex items-center justify-between p-2 border-b">
                            <p className="font-medium">{user.displayName}</p>
                            <p className={`font-bold ${Math.abs(amount) < 0.01 ? 'text-muted-foreground' : amount > 0 ? 'text-green-500' : 'text-destructive'}`}>
                                {amount >= 0.01 ? '+' : ''}₹{amount.toFixed(2)}
                            </p>
                         </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
