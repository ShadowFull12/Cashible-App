
"use client";

import { useState, useMemo, useEffect, ReactNode } from "react";
import { HandCoins, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/hooks/use-data";
import { Skeleton } from "@/components/ui/skeleton";
import type { Transaction } from "@/lib/data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TransactionActions } from "@/components/transaction-actions";
import { useIsMobile } from "@/hooks/use-mobile";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type SortableKeys = keyof Pick<Transaction, 'description' | 'category' | 'date' | 'amount'>;

type SortConfig = {
  key: SortableKeys;
  direction: 'ascending' | 'descending';
} | null;

interface SortableHeaderProps {
  children: ReactNode;
  columnKey: SortableKeys;
  sortConfig: SortConfig;
  requestSort: (key: SortableKeys) => void;
  className?: string;
}

const SortableHeader = ({ children, columnKey, sortConfig, requestSort, className }: SortableHeaderProps) => {
  const isSorted = sortConfig?.key === columnKey;
  const icon = isSorted ? (sortConfig?.direction === 'ascending' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />) : null;

  return (
    <TableHead className={cn("cursor-pointer hover:bg-muted/50 transition-colors", className)} onClick={() => requestSort(columnKey)}>
      <div className="flex items-center gap-2">
        {children}
        {icon}
      </div>
    </TableHead>
  );
};

export default function HistoryPage() {
  const { transactions, categories, isLoading, refreshData } = useData();
  const [filterDescription, setFilterDescription] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [expenseSortConfig, setExpenseSortConfig] = useState<SortConfig>(null);
  const [incomeSortConfig, setIncomeSortConfig] = useState<SortConfig>(null);

  const [isClient, setIsClient] = useState(false);
  const isMobile = useIsMobile();
  useEffect(() => {
    setIsClient(true);
  }, []);

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
  
  const requestExpenseSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (expenseSortConfig && expenseSortConfig.key === key) {
        if(expenseSortConfig.direction === 'ascending') {
            direction = 'descending';
        } else {
            setExpenseSortConfig(null);
            return;
        }
    }
    setExpenseSortConfig({ key, direction });
  };

  const requestIncomeSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (incomeSortConfig && incomeSortConfig.key === key) {
        if(incomeSortConfig.direction === 'ascending') {
            direction = 'descending';
        } else {
            setIncomeSortConfig(null);
            return;
        }
    }
    setIncomeSortConfig({ key, direction });
  };


  const filteredExpenses = useMemo(() => {
    let sortableItems = transactions.filter(t => {
      if (t.amount <= 0) return false;
      const descriptionMatch = (t.description || "").toLowerCase().includes(filterDescription.toLowerCase());
      const categoryMatch = filterCategory === 'all' || t.category === filterCategory;
      const monthMatch = filterMonth === 'all' || t.date.getMonth().toString() === filterMonth;
      const yearMatch = t.date.getFullYear().toString() === filterYear;
      return descriptionMatch && categoryMatch && monthMatch && yearMatch;
    });

    if (expenseSortConfig !== null) {
        sortableItems.sort((a, b) => {
            if (a[expenseSortConfig.key] < b[expenseSortConfig.key]) {
                return expenseSortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (a[expenseSortConfig.key] > b[expenseSortConfig.key]) {
                return expenseSortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    } else {
        sortableItems.sort((a,b) => b.date.getTime() - a.date.getTime());
    }

    return sortableItems;
  }, [transactions, filterDescription, filterCategory, filterMonth, filterYear, expenseSortConfig]);
  
  const filteredIncome = useMemo(() => {
      let sortableItems = transactions.filter(t => {
          if (t.amount >= 0) return false;
          const monthMatch = filterMonth === 'all' || t.date.getMonth().toString() === filterMonth;
          const yearMatch = t.date.getFullYear().toString() === filterYear;
          return monthMatch && yearMatch;
      });

      if (incomeSortConfig !== null) {
          sortableItems.sort((a, b) => {
              if (a[incomeSortConfig.key] < b[incomeSortConfig.key]) {
                  return incomeSortConfig.direction === 'ascending' ? -1 : 1;
              }
              if (a[incomeSortConfig.key] > b[incomeSortConfig.key]) {
                  return incomeSortConfig.direction === 'ascending' ? 1 : -1;
              }
              return 0;
          });
      } else {
          sortableItems.sort((a,b) => b.date.getTime() - a.date.getTime());
      }
      return sortableItems;
  }, [transactions, filterMonth, filterYear, incomeSortConfig]);

  const renderDesktopExpenses = () => (
    <div className="relative w-full overflow-x-auto">
        <Table>
            <TableHeader>
            <TableRow>
                <SortableHeader columnKey="description" sortConfig={expenseSortConfig} requestSort={requestExpenseSort}>Transaction</SortableHeader>
                <SortableHeader columnKey="category" sortConfig={expenseSortConfig} requestSort={requestExpenseSort}>Category</SortableHeader>
                <SortableHeader columnKey="date" sortConfig={expenseSortConfig} requestSort={requestExpenseSort}>Date</SortableHeader>
                <SortableHeader columnKey="amount" sortConfig={expenseSortConfig} requestSort={requestExpenseSort} className="text-right">Amount</SortableHeader>
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
                    <TransactionActions transaction={t} onDelete={refreshData} onUpdate={refreshData} />
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
  );

  const renderMobileExpenses = () => (
    <div className="space-y-3">
        {isLoading ? (
             Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : filteredExpenses.length > 0 ? (
            filteredExpenses.map(t => (
                <Card key={t.id} className="p-4">
                    <div className="flex justify-between items-start">
                        <div className="flex-grow space-y-1">
                            <p className="font-medium">{t.description}</p>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" style={{borderColor: categoryColors[t.category]}}>
                                    {t.category}
                                </Badge>
                                <p className="text-xs text-muted-foreground">{format(t.date, "P")}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <p className="font-bold text-lg">₹{t.amount.toLocaleString()}</p>
                            <TransactionActions transaction={t} onDelete={refreshData} onUpdate={refreshData} />
                        </div>
                    </div>
                </Card>
            ))
        ) : (
            <div className="text-center h-24 flex items-center justify-center">
                <p>No expenses found for the selected filters.</p>
            </div>
        )}
    </div>
  );

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
               {isClient ? (isMobile ? renderMobileExpenses() : renderDesktopExpenses()) : <Skeleton className="h-64 w-full" />}
            </TabsContent>
            <TabsContent value="income" className="mt-4">
                 <div className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader columnKey="description" sortConfig={incomeSortConfig} requestSort={requestIncomeSort}>Details</SortableHeader>
                        <SortableHeader columnKey="date" sortConfig={incomeSortConfig} requestSort={requestIncomeSort}>Date</SortableHeader>
                        <SortableHeader columnKey="amount" sortConfig={incomeSortConfig} requestSort={requestIncomeSort} className="text-right">Amount</SortableHeader>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({length: 3}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredIncome.length > 0 ? (
                            filteredIncome.map(t => (
                                <TableRow key={t.id}>
                                    <TableCell className="font-medium">
                                        {t.description}
                                    </TableCell>
                                    <TableCell>{format(t.date, "PPP")}</TableCell>
                                    <TableCell className="text-right text-green-500 font-bold">
                                        +₹{Math.abs(t.amount).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center h-24">
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
    </>
  );
}
