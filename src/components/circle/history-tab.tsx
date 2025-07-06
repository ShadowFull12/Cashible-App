
"use client";

import React from 'react';
import type { Circle, Transaction, Settlement, UserProfile } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { HandCoins, Receipt } from 'lucide-react';
import { Badge } from '../ui/badge';

interface HistoryTabProps {
    circle: Circle;
    transactions: Transaction[];
    settlements: Settlement[];
}

type HistoryItem = (Transaction & { type: 'transaction' }) | (Settlement & { type: 'settlement' });

export function HistoryTab({ circle, transactions, settlements }: HistoryTabProps) {

    const historyItems: HistoryItem[] = React.useMemo(() => {
        const items: HistoryItem[] = [];
        
        transactions.forEach(tx => {
            // A transaction must be a split and have details to be included in circle history
            if (tx.isSplit && tx.splitDetails) { 
                items.push({ ...tx, type: 'transaction' });
            }
        });
        
        settlements.forEach(s => {
            if (s.status === 'confirmed') {
                items.push({ ...s, type: 'settlement' });
            }
        });
        
        return items.sort((a, b) => {
            const dateA = a.type === 'transaction' ? a.date.getTime() : a.createdAt.getTime();
            const dateB = b.type === 'transaction' ? b.date.getTime() : b.createdAt.getTime();
            return dateB - dateA;
        });

    }, [transactions, settlements]);

    const getPayer = (item: HistoryItem): UserProfile | undefined => {
        if (item.type === 'transaction') {
            // With the check in historyItems, splitDetails is guaranteed to exist here.
            return circle.members[item.splitDetails!.payerId];
        }
        return item.fromUser;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Circle History</CardTitle>
                <CardDescription>A log of all expenses and settlements in this circle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {historyItems.length === 0 ? (
                    <div className="text-center text-muted-foreground py-10">
                        No activity in this circle yet. Add a split expense to get started!
                    </div>
                ) : (
                    historyItems.map(item => {
                        const payer = getPayer(item);
                        if (!payer) return null;

                        return (
                            <div key={item.id} className="flex items-start gap-4 p-3 border rounded-lg">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={payer.photoURL || undefined} />
                                    <AvatarFallback>{payer.displayName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-grow">
                                    {item.type === 'transaction' ? (
                                        <>
                                            <p className="text-sm">
                                                <span className="font-bold">{payer.displayName}</span> paid for <span className="font-bold">"{item.description}"</span>
                                            </p>
                                            <p className="font-bold text-lg">₹{item.amount.toFixed(2)}</p>
                                            <div className="text-xs text-muted-foreground flex items-center gap-4 mt-1">
                                                <span>{format(item.date, 'PPP')}</span>
                                                <Badge variant="outline"><Receipt className="mr-1 size-3"/> {item.category}</Badge>
                                            </div>
                                        </>
                                    ) : (
                                         <>
                                            <p className="text-sm">
                                                <span className="font-bold">{payer.displayName}</span> paid back <span className="font-bold">{item.toUser.displayName}</span>
                                            </p>
                                            <p className="font-bold text-lg text-green-600">₹{item.amount.toFixed(2)}</p>
                                             <div className="text-xs text-muted-foreground flex items-center gap-4 mt-1">
                                                <span>{format(item.createdAt, 'PPP')}</span>
                                                <Badge variant="outline" className="text-green-600 border-green-600/50"><HandCoins className="mr-1 size-3"/> Settlement</Badge>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </CardContent>
        </Card>
    );
}
