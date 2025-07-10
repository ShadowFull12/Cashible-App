
"use client";

import React, { useState } from 'react';
import type { Circle, Transaction, Settlement, UserProfile } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { HandCoins, Receipt, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/use-auth';
import { removeTransactionFromCircle } from '@/services/transactionService';
import { toast } from 'sonner';

interface HistoryTabProps {
    circle: Circle;
    transactions: Transaction[];
    settlements: Settlement[];
    isOwner: boolean;
}

type HistoryItem = (Transaction & { type: 'transaction' }) | (Settlement & { type: 'settlement' });

export function HistoryTab({ circle, transactions, settlements, isOwner }: HistoryTabProps) {
    const { user } = useAuth();
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

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

    const handleDeleteFromCircle = async (transaction: Transaction) => {
        if (!user || !isOwner) return;
        setIsDeleting(transaction.id!);
        try {
            const ownerProfile = circle.members[user.uid];
            if (!ownerProfile) throw new Error("Could not verify owner profile.");

            await removeTransactionFromCircle(transaction.id!, circle, ownerProfile);
            toast.success("Transaction removed from circle.");
        } catch (error: any) {
            toast.error("Failed to remove transaction.", { description: error.message });
        } finally {
            setIsDeleting(null);
        }
    };

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
                            <div key={item.id} className="flex flex-col sm:flex-row items-start justify-between gap-2 p-3 border rounded-lg">
                                <div className="flex items-start gap-4 flex-grow">
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
                                                <div className="text-xs text-muted-foreground flex items-center flex-wrap gap-x-4 gap-y-1 mt-1">
                                                    <span>{format(item.date, 'PPP')}</span>
                                                    <Badge variant="outline"><Receipt className="mr-1 size-3"/> {item.category}</Badge>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-sm">
                                                    <span className="font-bold">{payer.displayName}</span> paid back <span className="font-bold">{item.toUser.displayName}</span>
                                                </p>
                                                <div className="text-xs text-muted-foreground flex items-center flex-wrap gap-x-4 gap-y-1 mt-1">
                                                    <span>{format(item.createdAt, 'PPP')}</span>
                                                    <Badge variant="outline" className="text-green-600 border-green-600/50"><HandCoins className="mr-1 size-3"/> Settlement</Badge>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center self-end sm:self-center">
                                    {item.type === 'transaction' ? (
                                        <p className="font-bold text-lg">₹{item.amount.toFixed(2)}</p>
                                    ) : (
                                        <p className="font-bold text-lg text-green-600">₹{item.amount.toFixed(2)}</p>
                                    )}
                                    {isOwner && item.type === 'transaction' && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="ml-2" disabled={isDeleting === item.id}>
                                                    {isDeleting === item.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Remove from Circle?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will remove "{item.description}" from the circle's history and recalculate balances. The expense will remain in the user's personal history. This cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteFromCircle(item)}>Remove</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
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
