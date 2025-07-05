
"use client";

import { useState } from "react";
import { spendingInsights, SpendingInsightsInput } from "@/ai/flows/spending-insights";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const categoryData = [
  { name: 'Groceries', value: 8500 },
  { name: 'Entertainment', value: 4200 },
  { name: 'Utilities', value: 3100 },
  { name: 'Food', value: 5500 },
  { name: 'Shopping', value: 7800 },
  { name: 'Transport', value: 2500 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF5733'];

const mockSpendingData = JSON.stringify({
    period: "July 2024",
    totalSpent: 31600,
    transactions: [
        { category: "Groceries", amount: 8500 },
        { category: "Entertainment", amount: 4200 },
        { category: "Utilities", amount: 3100 },
        { category: "Food", amount: 5500 },
        { category: "Shopping", amount: 7800 },
        { category: "Transport", amount: 2500 },
    ]
}, null, 2);

export default function InsightsPage() {
  const [insights, setInsights] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateInsights = async () => {
    setIsLoading(true);
    setError(null);
    setInsights(null);
    try {
      const input: SpendingInsightsInput = { spendingData: mockSpendingData };
      const result = await spendingInsights(input);
      setInsights(result.insights);
    } catch (err) {
      setError("Failed to generate insights. Please try again later.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-6 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
          <CardDescription>A breakdown of your expenses by category for this month.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
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
            <Button onClick={handleGenerateInsights} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Insights"
              )}
            </Button>
            {isLoading && (
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
              <Alert className="mt-4">
                <AlertTitle>Your Financial Analysis</AlertTitle>
                <AlertDescription>
                  <pre className="whitespace-pre-wrap font-body text-sm">{insights}</pre>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
