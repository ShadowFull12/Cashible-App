
"use client";

import React, { useMemo } from 'react';
import { useData } from '@/hooks/use-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Package, IndianRupee, History, Users } from 'lucide-react';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format } from 'date-fns';

export default function SalesScribeDashboard() {
  const { sales, products, customers, transactions, isLoading } = useData();

  const salesData = useMemo(() => {
    // Total Revenue is the sum of all money that has come in from sales.
    // It's the sum of all "Income" category transactions that are related to a sale.
    const totalRevenue = transactions
        .filter(t => t.category === 'Income' && t.relatedSaleId)
        .reduce((sum, s) => sum + Math.abs(s.amount), 0);
    
    // Total value of all sales created, regardless of payment status
    const totalSalesValue = sales.reduce((sum, s) => sum + s.amount, 0);

    const netIncome = totalRevenue - transactions.filter(t=> t.amount > 0 && t.category !== 'Sale').reduce((sum, t) => sum + t.amount, 0);
    
    const productSalesCount = sales.reduce((acc, s) => {
        s.saleDetails?.items.forEach(item => {
            acc[item.name] = (acc[item.name] || 0) + item.quantity;
        });
        return acc;
    }, {} as Record<string, number>);

    const topSellingProducts = Object.entries(productSalesCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, quantity]) => ({ name, quantity }));
    
    // Chart should show actual income over time, not just sale value
    const incomeOverTime = transactions
        .filter(t => t.type === 'income' && t.category === 'Income')
        .reduce((acc, s) => {
            const day = format(s.date, 'yyyy-MM-dd');
            acc[day] = (acc[day] || 0) + Math.abs(s.amount);
            return acc;
        }, {} as Record<string, number>);

    const chartData = Object.entries(incomeOverTime)
        .map(([date, total]) => ({ date: format(new Date(date), 'dd MMM'), total }))
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-30); 

    return {
        totalRevenue,
        totalSalesValue,
        netIncome,
        topSellingProducts,
        chartData,
        totalSalesCount: sales.length,
    };
  }, [sales, products, customers, transactions]);
  
  if (isLoading) {
    return <SalesScribeDashboardSkeleton />;
  }

  return (
    <div className="grid gap-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue (Paid)</CardTitle>
                    <TrendingUp className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{salesData.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground">Actual income received from sales.</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Sales Value</CardTitle>
                    <IndianRupee className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{salesData.totalSalesValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground">Value of all sales including debt.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                    <Package className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{products.length}</div>
                    <p className="text-xs text-muted-foreground">Number of unique products listed.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                    <Users className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{customers.length}</div>
                    <p className="text-xs text-muted-foreground">Number of unique customers.</p>
                </CardContent>
            </Card>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Income Over Time</CardTitle>
                    <CardDescription>Your sales income for the last 30 days.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <RechartsBarChart data={salesData.chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} formatter={(value: number) => `₹${value.toLocaleString()}`}/>
                            <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </RechartsBarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
            <Card>
                 <CardHeader>
                    <CardTitle>Top Selling Products</CardTitle>
                    <CardDescription>Your most popular products by quantity sold.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {salesData.topSellingProducts.length > 0 ? salesData.topSellingProducts.map(p => (
                        <div key={p.name} className="flex justify-between items-center text-sm">
                            <span className="font-medium truncate pr-4">{p.name}</span>
                            <span className="font-bold">{p.quantity} sold</span>
                        </div>
                    )) : <p className="text-sm text-muted-foreground text-center py-8">No product sales recorded yet.</p>}
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

function SalesScribeDashboardSkeleton() {
    return (
        <div className="grid gap-6 animate-pulse">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-full mt-2" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-full mt-2" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-full mt-2" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-full mt-2" /></CardContent></Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2"><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></CardContent></Card>
            </div>
        </div>
    )
}
