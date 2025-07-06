
"use client";

import { useState, useMemo } from "react";
import { spendingInsights, SpendingInsightsInput } from "@/ai/flows/spending-insights";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Loader2, TrendingUp, Trophy, CalendarDays } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, XAxis, YAxis, Bar } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useData } from "@/hooks/use-data";
import { format, startOfMonth, endOfMonth, differenceInDays, isWithinInterval } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF5733', '#3b82f6', '#ec4899'];

export default function InsightsPage() {
  const { transactions, isLoading, settlements } = useData();
  const { user } = useAuth();
  const [insights, setInsights] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const positiveTransactions = useMemo(() => transactions.filter(t => t.amount > 0), [transactions]);

  const categoryData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    positiveTransactions.forEach(t => {
      categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + t.amount);
    });
    return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [positiveTransactions]);
  
  const monthlySpending = useMemo(() => {
    if (!positiveTransactions || positiveTransactions.length === 0) return [];
    const monthMap = new Map<string, number>();
    positiveTransactions.forEach(t => {
      const monthKey = format(t.date, 'yyyy-MM');
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + t.amount);
    });
    
    return Array.from(monthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6) // show last 6 months
        .map(([month, total]) => ({ month: format(new Date(month), 'MMM yy'), total }));
  }, [positiveTransactions]);

  const spendingByDay = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyMap = days.reduce((acc, day) => {
        acc[day] = 0;
        return acc;
    }, {} as {[key: string]: number});
    
    positiveTransactions.forEach(t => {
        const dayOfWeek = days[t.date.getDay()];
        dailyMap[dayOfWeek] += t.amount;
    });
    
    return days.map(day => ({ name: day, total: dailyMap[day] }));
  }, [positiveTransactions]);
  
  const insightMetrics = useMemo(() => {
    if (transactions.length === 0 && settlements.length === 0) return { topCategory: 'N/A', avgDaily: 0, totalSpent: 0 };
    
    const now = new Date();
    const firstDay = startOfMonth(now);
    const lastDay = endOfMonth(now);
    const currentMonthInterval = { start: firstDay, end: lastDay };

    const thisMonthExpenses = transactions
        .filter(t => t.amount > 0 && isWithinInterval(t.date, currentMonthInterval))
        .reduce((sum, t) => sum + t.amount, 0);
    
    const thisMonthIncome = settlements
        .filter(s => s.status === 'confirmed' && s.toUserId === user?.uid && s.processedAt && isWithinInterval(s.processedAt, currentMonthInterval))
        .reduce((sum, s) => sum + s.amount, 0);

    const netSpent = thisMonthExpenses - thisMonthIncome;
    
    const topCategory = categoryData[0]?.name || 'N/A';
    
    const daysInMonthSoFar = differenceInDays(now, firstDay) + 1;
    const avgDaily = daysInMonthSoFar > 0 ? netSpent / daysInMonthSoFar : 0;
    
    return { topCategory, avgDaily: Math.round(avgDaily), totalSpent: netSpent };
  }, [transactions, settlements, user?.uid, categoryData]);


  const handleGenerateInsights = async () => {
    setIsGenerating(true);
    setError(null);
    setInsights(null);
    try {
      const input: SpendingInsightsInput = { 
        spendingData: JSON.stringify(categoryData),
        monthlySpending: JSON.stringify(monthlySpending),
        spendingByDay: JSON.stringify(spendingByDay),
        topCategory: insightMetrics.topCategory,
        averageDailySpending: insightMetrics.avgDaily,
        transactionCount: transactions.length,
      };
      const result = await spendingInsights(input);
      setInsights(result.insights);
    } catch (err) {
      setError("Failed to generate insights. Please try again later.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid gap-6 md:gap-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>A breakdown of your expenses for the current period.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[300px] w-full" /> : categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (<div className="h-[300px] flex items-center justify-center text-muted-foreground">No spending data available.</div>)}
          </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Top Category</CardTitle>
                <Trophy className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-12 w-3/4" /> : (
                  <div className="text-2xl font-bold">{insightMetrics.topCategory}</div>
                )}
                <p className="text-xs text-muted-foreground">Your highest spending area this month</p>
            </CardContent>
        </Card>
        <Card>
             <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg. Daily Spend</CardTitle>
                <CalendarDays className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                 {isLoading ? <Skeleton className="h-12 w-1/2" /> : (
                    <div className="text-2xl font-bold">₹{insightMetrics.avgDaily.toLocaleString()}</div>
                 )}
                <p className="text-xs text-muted-foreground">Based on your net spending this month</p>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spending by Day of Week</CardTitle>
            <CardDescription>See which days you typically spend the most.</CardDescription>
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-[300px] w-full" /> : transactions.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={spendingByDay}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (<div className="h-[300px] flex items-center justify-center text-muted-foreground">Not enough data to display.</div>)}
          </CardContent>
        </Card>
         <Card>
          <CardHeader>
            <CardTitle>Monthly Spending Trend</CardTitle>
            <CardDescription>Your total spending over the last 6 months.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[300px] w-full" /> : monthlySpending.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlySpending}>
                  <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : ( <div className="h-[300px] flex items-center justify-center text-muted-foreground">Not enough data for monthly trends.</div> )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="text-primary" />
            AI-Powered Insights
          </CardTitle>
          <CardDescription>
            Get personalized insights and suggestions on your spending habits from our AI advisor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-start gap-4">
            <Button onClick={handleGenerateInsights} disabled={isGenerating || isLoading || transactions.length === 0}>
              {isGenerating ? (<> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating... </>) : ( "Generate Insights" )}
            </Button>
            {isGenerating && (
              <div className="w-full space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
              </div>
            )}
            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {insights && (
              <Alert className="mt-4 w-full">
                <AlertTitle>Your Financial Analysis</AlertTitle>
                <AlertDescription>
                  <div className="prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: insights.replace(/\n/g, '<br />') }} />
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
