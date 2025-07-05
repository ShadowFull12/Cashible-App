"use client";

import { useState } from "react";
import { MoreHorizontal, PlusCircle } from "lucide-react";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const allTransactions = [
    { id: 1, name: "Spotify Premium", category: "Entertainment", amount: 119, date: "2024-07-15" },
    { id: 2, name: "BigBazaar Groceries", category: "Groceries", amount: 2450, date: "2024-07-14" },
    { id: 3, name: "Electricity Bill", category: "Utilities", amount: 850, date: "2024-07-12" },
    { id: 4, name: "Zomato Order", category: "Food", amount: 349, date: "2024-07-11" },
    { id: 5, name: "Movie Tickets", category: "Entertainment", amount: 650, date: "2024-07-10" },
    { id: 6, name: "Monthly Rent", category: "Housing", amount: 15000, date: "2024-07-05" },
    { id: 7, name: "Fuel", category: "Transport", amount: 1000, date: "2024-07-02" },
    { id: 8, name: "Amazon Purchase", category: "Shopping", amount: 1299, date: "2024-06-28" },
];

const categoryColors: { [key: string]: string } = {
  Entertainment: "bg-purple-500",
  Groceries: "bg-green-500",
  Utilities: "bg-yellow-500",
  Food: "bg-red-500",
  Housing: "bg-blue-500",
  Transport: "bg-orange-500",
  Shopping: "bg-pink-500",
};

export default function HistoryPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>A detailed list of all your past transactions.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-4">
            <Input placeholder="Filter by name..." className="max-w-sm" />
            <Select>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="entertainment">Entertainment</SelectItem>
                    <SelectItem value="groceries">Groceries</SelectItem>
                    <SelectItem value="utilities">Utilities</SelectItem>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="housing">Housing</SelectItem>
                    <SelectItem value="transport">Transport</SelectItem>
                    <SelectItem value="shopping">Shopping</SelectItem>
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
            {allTransactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="font-medium">{t.name}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${categoryColors[t.category]}`}></span>
                    {t.category}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(t.date).toLocaleDateString("en-IN", { day: 'numeric', month: 'long', year: 'numeric' })}</TableCell>
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
                        <DropdownMenuItem>Edit</DropdownMenuItem>
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
                        <AlertDialogAction>Delete</AlertDialogAction>
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
  );
}
