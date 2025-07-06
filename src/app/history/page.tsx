
"use client";

import { useState, useMemo, useCallback } from "react";
import { HandCoins, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/hooks/use-data";
import { deleteTransaction } from "@/services/transactionService";
import { Skeleton } from "@/components/ui/skeleton";
import type { Transaction } from "@/lib/data";
import { AddExpenseDialog } from "@/components/add-expense-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function HistoryPage() {
  const { transactions, categories, isLoading, refreshData, settlements } = useData();
  const [filterDescription, setFilterDescription] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [editingTransaction, setEditingTransaction] = React.useState<Transaction | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set(transactions.map(t => t.date.getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);
  
  const categoryColors = useMemo(() => {
    return categories.reduce((acc, cat) => {
        acc[cat.name] = cat.color;
        return acc;
    }, {} as {[key: string]: string});
  }, [categories]);

  const filteredExpenses = useMemo(() => {
    return transactions.filter(t => {
      if (t.amount <= 0) return false;
      const descriptionMatch = (t.description || "").toLowerCase().includes(filterDescription.toLowerCase());
      const categoryMatch = filterCategory === 'all' || t.category === filterCategory;
      const monthMatch = filterMonth === 'all' || t.date.getMonth().toString() === filterMonth;
      const yearMatch = t.date.getFullYear().toString() === filterYear;
      return descriptionMatch && categoryMatch && monthMatch && yearMatch;
    });
  }, [transactions, filterDescription, filterCategory, filterMonth, filterYear]);
  
  const filteredIncome = useMemo(() => {
      return settlements.filter(s => {
          if (s.status !== 'confirmed') return false;
          const date = s.processedAt || s.createdAt;
          const monthMatch = filterMonth === 'all' || date.getMonth().toString() === filterMonth;
          const yearMatch = date.getFullYear().toString() === filterYear;
          return monthMatch && yearMatch;
      });
  }, [settlements, filterMonth, filterYear]);

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      toast.success("Transaction deleted");
      await refreshData();
    } catch (error) {
      toast.error("Failed to delete transaction");
    }
  };
  
  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  }

  const handleUpdate = useCallback(() => {
      refreshData();
      setEditingTransaction(null);
  }, [refreshData])

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Activity History</CardTitle>
        <CardDescription>A detailed list of all your past expenses and income.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:flex lg:flex-wrap">
            <Input 
              placeholder="Filter by description..." 
              className="w-full lg:max-w-sm"
              value={filterDescription}
              onChange={(e) => setFilterDescription(e.target.value)}
            />
            <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full lg:w-[180px]">
                    <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-full lg:w-[180px]">
                    <SelectValue placeholder="Filter by month" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {MONTHS.map((month, index) => (
                        <SelectItem key={month} value={index.toString()}>{month}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-full lg:w-[180px]">
                    <SelectValue placeholder="Filter by year" />
                </SelectTrigger>
                <SelectContent>
                    {availableYears.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <Tabs defaultValue="expenses" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
            </TabsList>
            <TabsContent value="expenses" className="mt-4">
                <div className="relative w-full">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Transaction</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-[10px]"></TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        Array.from({length: 5}).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                        </TableRow>
                        ))
                    ) : filteredExpenses.length > 0 ? (
                        filteredExpenses.map((t) => (
                        <TableRow key={t.id}>
                        <TableCell>
                            <div className="font-medium">{t.description}</div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className="flex items-center gap-2" style={{borderColor: categoryColors[t.category]}}>
                            <span className={`inline-block h-2 w-2 rounded-full`} style={{backgroundColor: categoryColors[t.category]}}></span>
                            {t.category}
                            </Badge>
                        </TableCell>
                        <TableCell>{format(t.date, "PPP")}</TableCell>
                        <TableCell className="text-right">₹{t.amount.toLocaleString()}</TableCell>
                        <TableCell>
                            <AlertDialog>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="size-4" />
                                    </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEdit(t)}>Edit</DropdownMenuItem>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem className="text-red-500">Delete</DropdownMenuItem>
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
                                    <AlertDialogAction onClick={() => handleDelete(t.id!)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                        </TableRow>
                    ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">
                                No expenses found for the selected filters.
                            </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
                </div>
            </TabsContent>
            <TabsContent value="income" className="mt-4">
                 <div className="relative w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Details</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({length: 3}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredIncome.length > 0 ? (
                            filteredIncome.map(s => (
                                <TableRow key={s.id}>
                                    <TableCell className="font-medium">
                                        Payment from {s.fromUser.displayName}
                                    </TableCell>
                                    <TableCell>{format(s.processedAt || s.createdAt, "PPP")}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="text-green-600">
                                            <HandCoins className="mr-1 size-3" /> Settlement
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-green-500 font-bold">
                                        +₹{s.amount.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24">
                                    No income recorded for the selected filters.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                  </Table>
                </div>
            </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
     {editingTransaction && (
         <AddExpenseDialog
                open={!!editingTransaction}
                onOpenChange={() => setEditingTransaction(null)}
                onExpenseAdded={handleUpdate}
                transactionToEdit={editingTransaction}
            />
    )}
    </>
  );
}
