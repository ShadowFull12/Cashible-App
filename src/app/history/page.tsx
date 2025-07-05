"use client";

import { useState, useMemo } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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

export default function HistoryPage() {
  const { transactions, categories, isLoading, refreshData } = useData();
  const [filterDescription, setFilterDescription] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  const categoryColors = useMemo(() => {
    return categories.reduce((acc, cat) => {
        acc[cat.name] = cat.color;
        return acc;
    }, {} as {[key: string]: string});
  }, [categories]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const descriptionMatch = (t.description || "").toLowerCase().includes(filterDescription.toLowerCase());
      const categoryMatch = filterCategory === 'all' || t.category === filterCategory;
      return descriptionMatch && categoryMatch;
    });
  }, [transactions, filterDescription, filterCategory]);

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      toast.success("Transaction deleted");
      await refreshData();
    } catch (error) {
      toast.error("Failed to delete transaction");
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>A detailed list of all your past transactions.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-4">
            <Input 
              placeholder="Filter by description..." 
              className="max-w-sm"
              value={filterDescription}
              onChange={(e) => setFilterDescription(e.target.value)}
            />
            <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
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
            ) : filteredTransactions.length > 0 ? (
              filteredTransactions.map((t) => (
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
                          <DropdownMenuItem disabled>Edit</DropdownMenuItem>
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
                        No transactions found.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
