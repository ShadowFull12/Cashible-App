
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getCircleById, leaveCircle } from '@/services/circleService';
import { getDebtsForCircle, deleteDebtById } from '@/services/debtService';
import type { Circle, Debt, UserProfile, DebtSettlementStatus } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ArrowRight, Users, VenetianMask, Check, Loader2, List, AlertCircle, Clock, CheckCircle2, XCircle, Trash2, LogOut, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { AddMemberDialog } from '@/components/add-member-dialog';


type SimplifiedDebt = {
    from: UserProfile;
    to: UserProfile;
    amount: number;
}

type ProcessingState = {
    debtId: string;
    action: 'settle' | 'confirm' | 'reject' | 'log' | 'cancel' | 'delete';
} | null;

export default function CircleDetailPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const circleId = params.id as string;

    const [circle, setCircle] = useState<Circle | null>(null);
    const [debts, setDebts] = useState<Debt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingState, setProcessingState] = useState<ProcessingState>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

    const fetchCircleData = useCallback(async () => {
        if (!circleId || !user) return;
        setIsLoading(true);
        setFetchError(null);
        try {
            const circleData = await getCircleById(circleId);
            
            if (!circleData || !circleData.memberIds.includes(user.uid)) {
                router.push('/spend-circle');
                toast.error("You are not a member of this circle or it no longer exists.");
                return;
            }

            const debtsData = await getDebtsForCircle(circleId, user.uid);
            
            setCircle(circleData);
            setDebts(debtsData);

        } catch (error: any) {
            console.error("Failed to fetch circle details:", error);
            if ((error as any).code === 'failed-precondition') {
                 toast.error("Query failed: A database index is required.", {
                    description: "Please check the browser's developer console (F12) for a link to create the required Firestore index, then refresh the page.",
                    duration: 10000
                 });
                 setFetchError("A database index is required to view this data. The link to create it can be found in your browser's developer console (press F12).");
            } else if ((error as any).code === 'permission-denied') {
                toast.error("Permission Denied.", {
                    description: "You do not have permission to view this data. Please check Firestore security rules.",
                    duration: 10000
                });
                setFetchError("You do not have permission to view this circle's debt information.");
            } else {
                toast.error("Could not load circle details.");
                setFetchError("An unexpected error occurred while loading circle data.");
            }
        } finally {
            setIsLoading(false);
        }
    }, [circleId, user, router]);

    useEffect(() => {
        fetchCircleData();
    }, [fetchCircleData]);

    const simplifiedDebts = useMemo((): SimplifiedDebt[] => {
        if (!circle || debts.length === 0) return [];
    
        const unsettledDebts = debts.filter(d => d.settlementStatus === 'unsettled');
        if (unsettledDebts.length === 0) return [];
    
        const balances = new Map<string, number>();
    
        const profiles = new Map<string, UserProfile>();
        unsettledDebts.forEach(debt => {
            if (debt.debtor) profiles.set(debt.debtor.uid, debt.debtor);
            if (debt.creditor) profiles.set(debt.creditor.uid, debt.creditor);
        });
    
        unsettledDebts.forEach(debt => {
            if (!balances.has(debt.debtorId)) balances.set(debt.debtorId, 0);
            if (!balances.has(debt.creditorId)) balances.set(debt.creditorId, 0);
    
            balances.set(debt.debtorId, (balances.get(debt.debtorId)!) - debt.amount);
            balances.set(debt.creditorId, (balances.get(debt.creditorId)!) + debt.amount);
        });
    
        const debtors = Array.from(balances.entries())
            .filter(([, balance]) => balance < -0.01)
            .map(([uid, balance]) => ({ uid, balance: -balance }));
            
        const creditors = Array.from(balances.entries())
            .filter(([, balance]) => balance > 0.01)
            .map(([uid, balance]) => ({ uid, balance }));
        
        const settlements: SimplifiedDebt[] = [];
        
        let i = 0, j = 0;
        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            const amount = Math.min(debtor.balance, creditor.balance);
    
            const fromProfile = profiles.get(debtor.uid);
            const toProfile = profiles.get(creditor.uid);
    
            if (amount > 0.01 && fromProfile && toProfile) { 
                 settlements.push({
                    from: fromProfile,
                    to: toProfile,
                    amount: amount
                });
            }
    
            debtor.balance -= amount;
            creditor.balance -= amount;
    
            if (debtor.balance < 0.01) i++;
            if (creditor.balance < 0.01) j++;
        }
    
        return settlements;
    }, [debts]);
    
    const individualDebts = useMemo(() => debts.filter(d => d.settlementStatus !== 'logged'), [debts]);
    
    const handleAction = async (action: () => Promise<any>, debtId: string, actionName: ProcessingState['action'], successMessage: string, errorMessage: string) => {
        setProcessingState({ debtId, action: actionName });
        try {
            await action();
            toast.success(successMessage);
            await fetchCircleData();
        } catch (error) {
            toast.error(errorMessage);
            console.error(error);
        } finally {
            setProcessingState(null);
        }
    }

    const handleLeaveCircle = async () => {
        if (!circle || !user) return;
        try {
            await leaveCircle(circle.id, user.uid);
            toast.success(`You have left the circle "${circle.name}".`);
            router.push('/spend-circle');
        } catch (error: any) {
            toast.error("Failed to leave circle.", { description: error.message });
        }
    }

    const handleDeleteDebt = async (debtId: string) => {
        if (!circle || !user || user.uid !== circle.ownerId) return;
        await handleAction(() => deleteDebtById(debtId, circle.id, user.uid), debtId, 'delete', "Debt record deleted.", "Failed to delete debt.");
    }

    if (isLoading) return <CircleDetailSkeleton />;
    if (fetchError) {
        return (
            <div className="space-y-6">
                 <Link href="/spend-circle" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="size-4" /> Back to Circles
                </Link>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Circle</AlertTitle>
                    <AlertDescription>{fetchError}</AlertDescription>
                </Alert>
            </div>
        )
    }
    if (!circle) return null;

    const renderDebtActions = (debt: Debt) => {
        const isDebtor = user?.uid === debt.debtorId;
        const isCreditor = user?.uid === debt.creditorId;
        const isProcessing = processingState?.debtId === debt.id;

        if (isDebtor) {
            switch(debt.settlementStatus) {
                case 'unsettled':
                    return <Button size="sm" disabled={isProcessing} onClick={() => handleAction(() => initiateSettlement(debt), debt.id, 'settle', "Payment marked as sent", "Failed to mark payment")}>
                        {isProcessing && processingState.action === 'settle' ? <Loader2 className="animate-spin" /> : <Check />} I've Paid
                        </Button>;
                case 'pending_confirmation':
                    return <Button size="sm" variant="ghost" disabled={isProcessing} onClick={() => handleAction(() => cancelSettlement(debt.id), debt.id, 'cancel', "Settlement cancelled", "Failed to cancel")}>
                        {isProcessing && processingState.action === 'cancel' ? <Loader2 className="animate-spin" /> : <XCircle className="text-muted-foreground"/>} Cancel
                        </Button>;
                case 'confirmed':
                     return <Button size="sm" variant="secondary" disabled={isProcessing} onClick={() => handleAction(() => logSettledDebtAsExpense(debt), debt.id, 'log', "Expense logged!", "Failed to log expense")}>
                        {isProcessing && processingState.action === 'log' ? <Loader2 className="animate-spin" /> : <List />} Log as Expense
                        </Button>;
                default: return null;
            }
        }
        
        if (isCreditor) {
            switch(debt.settlementStatus) {
                case 'pending_confirmation':
                    return <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={isProcessing} onClick={() => handleAction(() => rejectSettlement(debt.id), debt.id, 'reject', "Payment rejected", "Failed to reject")}>
                            {isProcessing && processingState.action === 'reject' ? <Loader2 className="animate-spin" /> : <XCircle />} Reject
                        </Button>
                        <Button size="sm" disabled={isProcessing} onClick={() => handleAction(() => confirmSettlement(debt), debt.id, 'confirm', "Payment confirmed!", "Failed to confirm payment")}>
                             {isProcessing && processingState.action === 'confirm' ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Accept
                        </Button>
                    </div>
                 default: return null;
            }
        }

        return null;
    }

    const getStatusBadge = (status: DebtSettlementStatus) => {
        switch(status) {
            case 'pending_confirmation':
                return <Badge variant="outline" className="text-yellow-500 border-yellow-500/50"><Clock className="mr-1"/>Pending</Badge>
            case 'confirmed':
                return <Badge variant="outline" className="text-green-500 border-green-500/50"><Check className="mr-1"/>Confirmed</Badge>
            default:
                return <Badge variant="secondary">Unsettled</Badge>
        }
    }


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
                            simplifiedDebts.map((debt, index) => {
                                if (!debt.from || !debt.to) return null;
                                return (
                                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8"><AvatarImage src={debt.from.photoURL || undefined}/><AvatarFallback>{debt.from.displayName?.charAt(0) || '?'}</AvatarFallback></Avatar>
                                            <p className="font-medium text-sm">{debt.from.displayName}</p>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <ArrowRight className="size-5 text-primary"/>
                                            <span className="text-xs font-bold text-primary">₹{debt.amount.toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <p className="font-medium text-sm">{debt.to.displayName}</p>
                                            <Avatar className="h-8 w-8"><AvatarImage src={debt.to.photoURL || undefined}/><AvatarFallback>{debt.to.displayName?.charAt(0) || '?'}</AvatarFallback></Avatar>
                                        </div>
                                    </div>
                                )
                            })
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
                         <div className="mt-4 space-y-2">
                            {user?.uid === circle.ownerId && (
                                <Button className="w-full" onClick={() => setIsAddMemberOpen(true)}>
                                    <UserPlus className="mr-2"/> Add Members
                                </Button>
                            )}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="w-full"><LogOut className="mr-2"/>Leave Circle</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Leave "{circle.name}"?</AlertDialogTitle><AlertDialogDescription>You will be removed from this circle. If you are the last member, the circle and all its debts will be permanently deleted.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleLeaveCircle}>Confirm & Leave</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><List /> Outstanding Debts</CardTitle>
                    <CardDescription>A list of all individual unsettled transactions and their statuses.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {individualDebts.length > 0 ? (
                        individualDebts.map(debt => {
                            if (!debt.debtor || !debt.creditor) return null;
                            const isProcessingDebt = processingState?.debtId === debt.id;
                            
                            return (
                                <div key={debt.id} className="flex items-center justify-between p-3 rounded-lg border">
                                    <div className="flex items-center gap-4">
                                         <Avatar className="h-10 w-10"><AvatarImage src={debt.debtor.photoURL || undefined}/><AvatarFallback>{debt.debtor.displayName?.charAt(0) || '?'}</AvatarFallback></Avatar>
                                         <div>
                                            <p className="text-sm">
                                                <span className="font-bold">{debt.debtor.displayName || 'Unknown User'}</span> owes <span className="font-bold">{debt.creditor.displayName || 'Unknown User'}</span>
                                            </p>
                                            <p className="font-bold text-lg text-primary">₹{debt.amount.toFixed(2)}</p>
                                            <p className="text-xs text-muted-foreground">For: {debt.transactionDescription}</p>
                                         </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {getStatusBadge(debt.settlementStatus)}
                                        {renderDebtActions(debt)}
                                        {user?.uid === circle.ownerId && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive" disabled={isProcessingDebt}><Trash2 className="size-4" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Delete Debt Record?</AlertDialogTitle><AlertDialogDescription>This will permanently remove the debt record of ₹{debt.amount.toFixed(2)} from {debt.debtor.displayName} to {debt.creditor.displayName}. This is useful for correcting mistakes. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteDebt(debt.id)}>Confirm Delete</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        <div className="text-center text-sm text-muted-foreground py-6">
                            <p className="font-semibold">No individual debts to settle.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
        {isAddMemberOpen && circle && (
            <AddMemberDialog 
                open={isAddMemberOpen}
                onOpenChange={setIsAddMemberOpen}
                circle={circle}
                onMembersAdded={fetchCircleData}
            />
        )}
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
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
                    <CardContent className="space-y-3">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-10 w-full mt-4" />
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
