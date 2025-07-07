
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import type { Circle, Transaction, Settlement } from '@/lib/data';
import { useAuth } from '@/hooks/use-auth';
import { getCircleTransactionsListener, getCircleSettlementsListener } from '@/services/transactionService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, MessageSquare, AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/badge';

interface CircleCardProps {
    circle: Circle;
}

export function CircleCard({ circle }: CircleCardProps) {
    const { user: currentUser } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [settlements, setSettlements] = useState<Settlement[]>([]);

    useEffect(() => {
        if (!circle.id) return;
        const unsubTx = getCircleTransactionsListener(circle.id, setTransactions);
        const unsubSettlements = getCircleSettlementsListener(circle.id, setSettlements);
        return () => {
            unsubTx();
            unsubSettlements();
        };
    }, [circle.id]);
    
    const userDebt = useMemo(() => {
        if (!currentUser) return 0;
        
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
                balances.set(s.fromUserId, (balances.get(s.fromUserId) || 0) + s.amount);
                balances.set(s.toUserId, (balances.get(s.toUserId) || 0) - s.amount);
            }
        });
        
        const debtors = Array.from(balances.entries())
            .filter(([, balance]) => balance < -0.01)
            .map(([uid, balance]) => ({ uid, balance: -balance }));
            
        const creditors = Array.from(balances.entries())
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
        
        const totalOwedByUser = simplifiedDebts
            .filter(d => d.from === currentUser.uid)
            .reduce((sum, d) => sum + d.amount, 0);

        return totalOwedByUser;

    }, [currentUser, circle.members, transactions, settlements]);

    const hasUnreadMessages = useMemo(() => {
        if (!currentUser || !circle.lastMessageAt) return false;
        const lastReadTime = circle.lastRead?.[currentUser.uid];
        if (!lastReadTime) return true; // Never read
        return circle.lastMessageAt > lastReadTime;
    }, [currentUser, circle]);

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>{circle.name}</CardTitle>
                        <CardDescription>{Object.keys(circle.members).length} members</CardDescription>
                    </div>
                    {hasUnreadMessages && (
                        <Badge variant="destructive" className="flex items-center gap-1"><MessageSquare className="size-3"/> New</Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="flex-grow">
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
            <CardContent className="flex items-center justify-between">
                <Link href={`/spend-circle/${circle.id}`} className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                    View Details <ArrowRight className="size-4" />
                </Link>
                {userDebt > 0 && (
                     <Badge variant="outline" className="text-destructive border-destructive/50">
                        <AlertTriangle className="mr-1 size-3"/>
                        You owe ₹{userDebt.toFixed(2)}
                     </Badge>
                )}
            </CardContent>
        </Card>
    );
}
