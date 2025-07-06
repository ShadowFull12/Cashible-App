
"use client";

import { AlertTriangle, IndianRupee, MoreHorizontal, Wallet, Loader2 } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
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
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useData } from "@/hooks/use-data";
import React, { useMemo } from "react";
import { deleteTransaction } from "@/services/transactionService";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { AddExpenseDialog } from "@/components/add-expense-dialog";
import type { Transaction } from "@/lib/data";


export default function DashboardPage() {
  const { user, userData } = useAuth();
  const { transactions, categories, isLoading, refreshData, settlements } = useData();
  const [editingTransaction, setEditingTransaction] = React.useState<Transaction | null>(null);
  
  const categoryColors = useMemo(() => {
    return categories.reduce((acc, cat) => {
        acc[cat.name] = cat.color;
        return acc;
    }, {} as {[key: string]: string});
  }, [categories]);

  const handleDelete = async (id: string) => {
    try {
        await deleteTransaction(id);
        toast.success("Transaction deleted successfully");
        await refreshData();
    } catch (error) {
        toast.error("Failed to delete transaction");
    }
  };

  const budget = userData?.budget || 50000;

  const monthlyTotals = useMemo(() => {
    if (!user) return { expenses: 0, income: 0 };
    const now = new Date();
    const firstDay = startOfMonth(now);
    const lastDay = endOfMonth(now);
    const currentMonthInterval = { start: firstDay, end: lastDay };

    const expenses = transactions
        .filter(t => t.amount > 0 && isWithinInterval(t.date, currentMonthInterval))
        .reduce((sum, t) => sum + t.amount, 0);

    const income = settlements
        .filter(s => s.status === 'confirmed' && s.toUserId === user.uid && s.processedAt && isWithinInterval(s.processedAt, currentMonthInterval))
        .reduce((sum, s) => sum + s.amount, 0);

    return { expenses, income };
  }, [transactions, settlements, user]);

  const spent = monthlyTotals.expenses - monthlyTotals.income;
  const remaining = budget - spent;
  const progress = budget > 0 ? (spent / budget) * 100 : 0;
  
  const dailySpending = useMemo(() => {
    const dailyMap = new Map<string, number>();
    const last10Days = Array.from({ length: 10 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return format(d, 'dd');
    }).reverse();

    last10Days.forEach(day => dailyMap.set(day, 0));
    
    transactions.filter(t => t.amount > 0).forEach(t => {
        const day = format(t.date, 'dd');
        if(dailyMap.has(day)) {
            dailyMap.set(day, (dailyMap.get(day) || 0) + t.amount);
        }
    });

    return Array.from(dailyMap.entries()).map(([date, total]) => ({ date, total }));
  }, [transactions]);
  
  const getBudgetStatusText = () => {
    if (progress > 100) return `You're over budget by ₹${(spent - budget).toLocaleString()}.`;
    if (progress > 80) return "Warning: You're nearing your budget limit.";
    if (progress > 50) return "You've spent over half of your budget.";
    return "You're on track with your spending.";
  };

  const progressIndicatorClass = useMemo(() => {
    if (progress > 100) return "bg-destructive";
    if (progress > 80) return "bg-destructive";
    if (progress > 50) return "bg-chart-4";
    return "bg-chart-1";
  }, [progress]);


  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <>
    <div className="grid gap-6 md:gap-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Budget</CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{budget.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Your budget for this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Money Spent (This Month)</CardTitle>
            <IndianRupee className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{spent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">in total (expenses - income)</p>
          </CardContent>
        </Card>
        <Card className={cn(remaining < 0 && "border-destructive/50 text-destructive")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {remaining >= 0 ? 'Money Remaining' : 'Over Budget By'}
            </CardTitle>
            <AlertTriangle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{Math.abs(remaining).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
                {remaining >= 0 ? "Your remaining balance for the month." : "You have exceeded your budget."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Budget Overview</CardTitle>
            <CardDescription>A visual summary of your monthly spending against your budget.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex justify-between items-center mb-1 text-sm">
                <span>Spent: <span className="font-medium">₹{spent.toLocaleString()}</span></span>
                <span>{progress.toFixed(0)}%</span>
            </div>
            <Progress value={Math.min(progress, 100)} indicatorClassName={progressIndicatorClass} />
            <p className="text-xs text-muted-foreground mt-2">{getBudgetStatusText()}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Spending</CardTitle>
            <CardDescription>Your spending overview for the last 10 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailySpending}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Your 4 most recent expenses.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[10px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.filter(t => t.amount > 0).slice(0,4).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.description}</div>
                      <div className="text-sm text-muted-foreground">{format(t.date, "PPP")}</div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className="flex items-center gap-2" style={{borderColor: categoryColors[t.category]}}>
                            <span className={`inline-block h-2 w-2 rounded-full`} style={{backgroundColor: categoryColors[t.category]}}></span>
                            {t.category}
                        </Badge>
                    </TableCell>
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
                            <DropdownMenuItem onClick={() => setEditingTransaction(t)}>Edit</DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-red-500">Delete</DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete this transaction from your records.
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
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
    {editingTransaction && (
         <AddExpenseDialog
                open={!!editingTransaction}
                onOpenChange={() => setEditingTransaction(null)}
                onExpenseAdded={refreshData}
                transactionToEdit={editingTransaction}
            />
    )}
    </>
  );
}

function DashboardSkeleton() {
    return (
        <div className="grid gap-6 md:gap-8 animate-pulse">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-full mt-2" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-full mt-2" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-full mt-2" /></CardContent></Card>
            </div>
            <Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent><Skeleton className="h-3 w-full" /></CardContent></Card>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent><Skeleton className="h-[250px] w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent><Skeleton className="h-10 w-full mb-2" /><Skeleton className="h-10 w-full mb-2" /><Skeleton className="h-10 w-full mb-2" /><Skeleton className="h-10 w-full" /></CardContent></Card>
            </div>
        </div>
    )
}
