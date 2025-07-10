
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '@/hooks/use-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Check, User, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { settleCustomerDebt } from '@/services/transactionService';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import type { Customer } from '@/lib/data';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';

function SettleDebtDialog({ customer, onSettled }: { customer: Customer, onSettled: () => void }) {
    const [amount, setAmount] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const maxAmount = customer.totalDebt;

    const handleSettle = async () => {
        const settlementAmount = parseFloat(amount);
        if (isNaN(settlementAmount) || settlementAmount <= 0 || settlementAmount > maxAmount) {
            toast.error("Invalid amount", { description: `Please enter a number between 0.01 and ${maxAmount.toFixed(2)}.`});
            return;
        }
        setIsLoading(true);
        try {
            await settleCustomerDebt(customer.id!, settlementAmount);
            toast.success(`₹${settlementAmount.toFixed(2)} payment recorded for ${customer.name}.`);
            onSettled();
        } catch (error: any) {
            toast.error("Failed to settle debt.", { description: error.message });
        } finally {
            setIsLoading(false);
        }
    }
    
    return (
         <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Settle Debt for {customer.name}</AlertDialogTitle>
                <AlertDialogDescription>
                    Record a payment from this customer. Their total outstanding debt is <strong>₹{customer.totalDebt.toFixed(2)}</strong>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
                <Label htmlFor="payment-amount">Payment Amount</Label>
                <Input 
                    id="payment-amount"
                    type="number"
                    placeholder={`Max ₹${maxAmount.toFixed(2)}`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSettle} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 animate-spin" />}
                    Record Payment
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    )
}


export default function CustomersPage() {
    const { customers, isLoading, refreshData } = useData();
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const isMobile = useIsMobile();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const sortedCustomers = useMemo(() => {
        return [...customers].sort((a,b) => b.totalDebt - a.totalDebt);
    }, [customers]);
    
    const handleDebtSettled = () => {
        refreshData();
        setSelectedCustomer(null);
    }

    const renderDesktopTable = () => (
        <div className="relative w-full overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Customer Name</TableHead>
                        <TableHead className="text-right">Amount Owed</TableHead>
                        <TableHead className="text-right w-[150px]">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading && Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-28 ml-auto" /></TableCell>
                        </TableRow>
                    ))}
                    {!isLoading && sortedCustomers.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center">
                                No outstanding customer debts. Well done!
                            </TableCell>
                        </TableRow>
                    )}
                    {!isLoading && sortedCustomers.map((customer) => (
                        <TableRow key={customer.id}>
                            <TableCell className="font-medium flex items-center gap-2">
                                <User className="text-muted-foreground" /> {customer.name}
                            </TableCell>
                            <TableCell className="text-right font-bold text-destructive">₹{customer.totalDebt.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="outline" onClick={() => setSelectedCustomer(customer)}>
                                            <Check className="mr-2 size-4" />
                                            Settle Debt
                                        </Button>
                                    </AlertDialogTrigger>
                                    {selectedCustomer && selectedCustomer.id === customer.id && (
                                       <SettleDebtDialog customer={selectedCustomer} onSettled={handleDebtSettled} />
                                    )}
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );

    const renderMobileCards = () => (
        <div className="space-y-3">
             {isLoading && Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-4 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-8 w-full" />
                </Card>
            ))}
            {!isLoading && sortedCustomers.length === 0 && (
                <div className="text-center text-muted-foreground py-10">
                    No outstanding customer debts. Well done!
                </div>
            )}
            {!isLoading && sortedCustomers.map((customer) => (
                <Card key={customer.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                        <p className="font-semibold flex items-center gap-2"><User className="text-muted-foreground" /> {customer.name}</p>
                        <p className="font-bold text-destructive text-lg">₹{customer.totalDebt.toFixed(2)}</p>
                    </div>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button size="sm" className="w-full" variant="outline" onClick={() => setSelectedCustomer(customer)}>
                                <Check className="mr-2 size-4" />
                                Settle Debt
                            </Button>
                        </AlertDialogTrigger>
                        {selectedCustomer && selectedCustomer.id === customer.id && (
                           <SettleDebtDialog customer={selectedCustomer} onSettled={handleDebtSettled} />
                        )}
                    </AlertDialog>
                </Card>
            ))}
        </div>
    );
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Customer Debts</CardTitle>
                <CardDescription>A list of customers with outstanding payments for their sales.</CardDescription>
            </CardHeader>
            <CardContent>
                {isClient ? (isMobile ? renderMobileCards() : renderDesktopTable()) : <Skeleton className="h-40 w-full" />}
            </CardContent>
        </Card>
    );
}
