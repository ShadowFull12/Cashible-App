
"use client";

import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AddExpenseDialog } from '@/components/add-expense-dialog';
import { deleteTransaction } from '@/services/transactionService';
import type { Transaction } from '@/lib/data';

export function TransactionActions({ transaction, onDelete, onUpdate }: { transaction: Transaction, onDelete: () => void, onUpdate: () => void }) {
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

    const handleDelete = async () => {
        try {
            await deleteTransaction(transaction.id!);
            toast.success("Transaction deleted successfully");
            onDelete();
        } catch (error) {
            toast.error("Failed to delete transaction");
        }
    };
    
    return (
        <>
            <AlertDialog>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditDialogOpen(true);
                            }}
                            disabled={!!transaction.isSplit}
                        >
                            Edit
                        </DropdownMenuItem>
                        <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-red-500" onSelect={(e) => e.preventDefault()}>Delete</DropdownMenuItem>
                        </AlertDialogTrigger>
                    </DropdownMenuContent>
                </DropdownMenu>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this transaction.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AddExpenseDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                onExpenseAdded={onUpdate}
                transactionToEdit={transaction}
            />
        </>
    );
}
