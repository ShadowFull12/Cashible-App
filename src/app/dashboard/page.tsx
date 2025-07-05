"use client";

import { AlertTriangle, IndianRupee, MoreHorizontal, PlusCircle, Wallet } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
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

const dailySpending = [
  { date: "01", total: Math.floor(Math.random() * 1000) + 200 },
  { date: "02", total: Math.floor(Math.random() * 1000) + 200 },
  { date: "03", total: Math.floor(Math.random() * 1000) + 200 },
  { date: "04", total: Math.floor(Math.random() * 1000) + 200 },
  { date: "05", total: Math.floor(Math.random() * 1000) + 200 },
  { date: "06", total: Math.floor(Math.random() * 1000) + 200 },
  { date: "07", total: Math.floor(Math.random() * 1000) + 200 },
  { date: "08", total: Math.floor(Math.random() * 1000) + 200 },
  { date: "09", total: Math.floor(Math.random() * 1000) + 200 },
  { date: "10", total: Math.floor(Math.random() * 1000) + 200 },
];

const transactions = [
  { id: 1, name: "Spotify", category: "Entertainment", amount: 119, date: "2 days ago" },
  { id: 2, name: "BigBazaar", category: "Groceries", amount: 2450, date: "3 days ago" },
  { id: 3, name: "Electricity Bill", category: "Utilities", amount: 850, date: "5 days ago" },
  { id: 4, name: "Zomato", category: "Food", amount: 349, date: "6 days ago" },
];

const categoryColors: { [key: string]: string } = {
  Entertainment: "bg-purple-500",
  Groceries: "bg-green-500",
  Utilities: "bg-yellow-500",
  Food: "bg-red-500",
};

export default function DashboardPage() {
  const budget = 50000;
  const spent = 28750;
  const remaining = budget - spent;
  const progress = (spent / budget) * 100;

  return (
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
            <CardTitle className="text-sm font-medium">Money Spent</CardTitle>
            <IndianRupee className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{spent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+₹5,230 from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Money Remaining</CardTitle>
            <AlertTriangle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{remaining.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">You are on track!</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Budget Overview</CardTitle>
            <CardDescription>You've spent {progress.toFixed(0)}% of your budget.</CardDescription>
        </CardHeader>
        <CardContent>
            <Progress value={progress} className="h-3"/>
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
              <BarChart data={dailySpending}>
                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Your most recent expenses.</CardDescription>
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
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-sm text-muted-foreground">{t.date}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${categoryColors[t.category]}`}></span>
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
                              This action cannot be undone. This will permanently delete this transaction from your records.
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
      </div>
    </div>
  );
}
