
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { spendingInsights, SpendingInsightsInput } from "@/ai/flows/spending-insights";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Loader2, TrendingUp, Trophy, CalendarDays, Download } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip, BarChart, XAxis, YAxis, Bar, CartesianGrid, LineChart, Line } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useData } from "@/hooks/use-data";
import { format, startOfMonth, endOfMonth, differenceInDays, isWithinInterval, getYear, getMonth, set } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Transaction } from "@/lib/data";


const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF5733', '#3b82f6', '#ec4899'];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function InsightSection({ transactions, timePeriodLabel }: { transactions: Transaction[], timePeriodLabel: string }) {
  const [insights, setInsights] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isLoading: dataIsLoading } = useData();

  const isLoading = dataIsLoading || isGenerating;

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
        .slice(-12) // show last 12 months for "All Time"
        .map(([month, total]) => ({ month: format(new Date(month), 'MMM yy'), total }));
  }, [positiveTransactions]);

  const spendingByDay = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyMap = days.reduce((acc, day) => { acc[day] = 0; return acc; }, {} as {[key: string]: number});
    
    positiveTransactions.forEach(t => {
        const dayOfWeek = days[t.date.getDay()];
        dailyMap[dayOfWeek] += t.amount;
    });
    
    return days.map(day => ({ name: day, total: dailyMap[day] }));
  }, [positiveTransactions]);
  
  const insightMetrics = useMemo(() => {
    if (transactions.length === 0) return { topCategory: 'N/A', avgDaily: 0 };
    
    const topCategory = categoryData[0]?.name || 'N/A';
    const totalDays = positiveTransactions.length > 0
        ? differenceInDays(
            Math.max(...positiveTransactions.map(t => t.date.getTime())),
            Math.min(...positiveTransactions.map(t => t.date.getTime()))
        ) + 1
        : 1;

    const totalSpent = positiveTransactions.reduce((sum, t) => sum + t.amount, 0);
    const avgDaily = totalSpent / Math.max(1, totalDays);
    
    return { topCategory, avgDaily: Math.round(avgDaily) };
  }, [transactions, categoryData, positiveTransactions]);

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
        timePeriod: timePeriodLabel,
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

  const parseMarkdown = (text: string) => {
    const html = text
      .replace(/^## (.*$)/gim, '<h3 class="text-lg font-semibold text-primary mt-4 mb-2">$1</h3>')
      .replace(/^# (.*$)/gim, '<h2 class="text-xl font-bold text-primary mt-6 mb-2">$1</h2>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/(?:^\* (.*$)\n?)+/gim, (match) => {
        const listItems = match.trim().split('\n').map(item =>
          `<li class="ml-5 list-disc">${item.substring(2).trim()}</li>`
        ).join('');
        return `<ul class="space-y-1 mt-2">${listItems}</ul>`;
      })
      .replace(/\n/g, '<br />')
      .replace(/<br \s*\/?>\s*<br \s*\/?>/g, '<br />');

    return html;
  };
  
  return (
    <div className="grid gap-6 md:gap-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="lg:col-span-2" data-chart-ref="true" data-chart-title="Spending by Category">
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>A breakdown of your expenses for the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[300px] w-full" /> : categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
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
                <p className="text-xs text-muted-foreground">Your highest spending area</p>
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
                <p className="text-xs text-muted-foreground">Across the selected period</p>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card data-chart-ref="true" data-chart-title="Spending by Day of Week">
          <CardHeader>
            <CardTitle>Spending by Day of Week</CardTitle>
            <CardDescription>See which days you typically spend the most.</CardDescription>
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-[300px] w-full" /> : transactions.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={spendingByDay}>
                   <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                  <RechartsTooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (<div className="h-[300px] flex items-center justify-center text-muted-foreground">Not enough data to display.</div>)}
          </CardContent>
        </Card>
         <Card data-chart-ref="true" data-chart-title="Spending Trend">
          <CardHeader>
            <CardTitle>Spending Trend</CardTitle>
            <CardDescription>Your total spending over time.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[300px] w-full" /> : monthlySpending.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                 <LineChart data={monthlySpending}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                    <RechartsTooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                    <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" />
                </LineChart>
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
            <Button onClick={handleGenerateInsights} disabled={isGenerating || dataIsLoading || transactions.length === 0}>
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
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: parseMarkdown(insights) }}
                    />
                  </AlertDescription>
                </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


export default function InsightsPage() {
  const { transactions, isLoading } = useData();
  const { user } = useAuth();
  
  const [view, setView] = useState<'current' | 'all' | 'custom'>('current');
  const [isDownloading, setIsDownloading] = useState(false);

  const availableYears = useMemo(() => {
    if (transactions.length === 0) return [getYear(new Date())];
    const years = new Set(transactions.map(t => getYear(t.date)));
    return Array.from(years).sort((a,b) => b - a);
  }, [transactions]);
  
  const [customYear, setCustomYear] = useState<number>(availableYears[0]);
  const [customMonth, setCustomMonth] = useState<number>(getMonth(new Date()));

  useEffect(() => {
    setCustomYear(availableYears[0]);
  }, [availableYears]);

  const { periodTransactions, periodLabel } = useMemo(() => {
    const now = new Date();
    switch(view) {
        case 'current':
            const currentMonthInterval = { start: startOfMonth(now), end: endOfMonth(now) };
            return {
                periodTransactions: transactions.filter(t => isWithinInterval(t.date, currentMonthInterval)),
                periodLabel: `for ${format(now, 'MMMM yyyy')}`
            };
        case 'all':
            return {
                periodTransactions: transactions,
                periodLabel: "of all time"
            };
        case 'custom':
            const customDate = set(new Date(), { year: customYear, month: customMonth });
            const customMonthInterval = { start: startOfMonth(customDate), end: endOfMonth(customDate) };
             return {
                periodTransactions: transactions.filter(t => isWithinInterval(t.date, customMonthInterval)),
                periodLabel: `for ${format(customDate, 'MMMM yyyy')}`
            };
        default:
             return { periodTransactions: [], periodLabel: ""};
    }
  }, [view, transactions, customMonth, customYear]);
  
  const handleDownloadPDF = async () => {
    if(isDownloading) return;
    setIsDownloading(true);

    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const userDisplayName = user?.displayName || 'User';

    const positiveTxns = periodTransactions.filter(t => t.amount > 0);
    const negativeTxns = periodTransactions.filter(t => t.amount < 0);
    const totalExpenses = positiveTxns.reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = negativeTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const netExpenses = totalExpenses - totalIncome;

    let y = 20;
    const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
    const PAGE_MARGIN = 15;

    const checkPageBreak = (currentY: number, elementHeight: number) => {
        if (currentY + elementHeight > PAGE_HEIGHT - PAGE_MARGIN) {
            doc.addPage();
            return PAGE_MARGIN;
        }
        return currentY;
    };
    
    // --- PDF CONTENT ---
    // Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('SpendWise Monthly Report', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${periodLabel} for ${userDisplayName}`, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
    y += 15;

    // Summary Section
    y = checkPageBreak(y, 20);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('Monthly Summary', 14, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      body: [
        ['Total Expenses:', `Rs. ${totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`],
        ['Total Income:', `Rs. ${totalIncome.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`],
      ],
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 11 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Transactions Table
    y = checkPageBreak(y, 15);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('Expense Transactions', 14, y);
    y += 8;
    if (positiveTxns.length > 0) {
        autoTable(doc, {
            startY: y,
            head: [['Date', 'Description', 'Category', 'Amount (Rs.)']],
            body: positiveTxns.map(t => [
                format(t.date, 'dd MMM, yyyy'),
                t.description,
                t.category,
                t.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})
            ]),
            theme: 'grid',
            headStyles: { fillColor: [34, 197, 94] },
            styles: { font: 'helvetica', fontSize: 10 },
            columnStyles: { 3: { halign: 'right' } }
        });
        y = (doc as any).lastAutoTable.finalY + 15;
    } else {
        y = checkPageBreak(y, 10);
        doc.setFontSize(10).setFont('helvetica', 'italic').text("No expense transactions for this period.", 14, y);
        y += 10;
    }

    // Charts & Graphs
    const activeTabContent = document.querySelector('[role="tabpanel"][data-state="active"]');
    if (!activeTabContent) {
        toast.error("Could not find report content. Please ensure you are on the correct tab.");
        setIsDownloading(false);
        return;
    }

    const chartElements = activeTabContent.querySelectorAll('[data-chart-ref]');
    if (chartElements.length > 0) {
        y = checkPageBreak(y, 20); // check space for header
        if (y === PAGE_MARGIN) { // if new page was added
             doc.setFontSize(18); doc.setFont('helvetica', 'bold');
             doc.text('Visual Analysis', 14, y);
             y += 10;
        } else {
            doc.addPage(); y = PAGE_MARGIN;
            doc.setFontSize(18); doc.setFont('helvetica', 'bold');
            doc.text('Visual Analysis', 14, y);
            y += 10;
        }
        
        let xPos = 14;
        let maxHeightInRow = 0;
        let initialYForRow = y;

        for (let i = 0; i < chartElements.length; i++) {
            const element = chartElements[i] as HTMLElement;
            const title = element.getAttribute('data-chart-title') || 'Chart';
            
            let currentY = initialYForRow;
            currentY = checkPageBreak(currentY, 10);
            if (currentY === PAGE_MARGIN && i > 0) { // New page was added mid-row
                initialYForRow = PAGE_MARGIN;
                xPos = 14;
            }

            doc.setFontSize(14).setFont('helvetica', 'bold').text(title, xPos, currentY);

            const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = 85; // Fixed width for side-by-side charts
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            maxHeightInRow = Math.max(maxHeightInRow, pdfHeight);

            currentY = checkPageBreak(currentY, pdfHeight + 10); // +10 for title
            doc.addImage(imgData, 'PNG', xPos, currentY + 10, pdfWidth, pdfHeight);

            if ((i + 1) % 2 === 0) { // After every second chart
                xPos = 14; // Reset x for next row
                initialYForRow += maxHeightInRow + 25; // Move y down for next row
                maxHeightInRow = 0; // Reset max height
            } else {
                xPos += pdfWidth + 10; // Move x for next chart in row
            }
        }
        y = initialYForRow + (chartElements.length % 2 !== 0 ? maxHeightInRow + 15 : 0);
    }


    // Final Calculation
    y = checkPageBreak(y, 30); // check space for final calculation
    doc.setLineWidth(0.5);
    doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y);
    y += 15;
    
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    
    const finalLabel = 'Net Expenses';
    const finalAmount = `Rs. ${netExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    doc.text(finalLabel, 14, y);
    doc.text(finalAmount, doc.internal.pageSize.getWidth() - 14, y, { align: 'right' });
    y += 10;
    
    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
        doc.text(`SpendWise Report Generated on ${format(new Date(), 'PPP')}`, 14, doc.internal.pageSize.height - 10);
    }

    doc.save(`SpendWise-Report-${periodLabel.replace(/ /g, '-')}.pdf`);
    setIsDownloading(false);
  };
  
  return (
    <div className="grid gap-6">
        <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-full">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <TabsList>
                    <TabsTrigger value="current">This Month</TabsTrigger>
                    <TabsTrigger value="all">All Time</TabsTrigger>
                    <TabsTrigger value="custom">By Month</TabsTrigger>
                </TabsList>
                {view === 'custom' && (
                    <div className="flex gap-2">
                        <Select value={String(customMonth)} onValueChange={(v) => setCustomMonth(Number(v))}>
                            <SelectTrigger className="w-[180px]"> <SelectValue placeholder="Select month" /> </SelectTrigger>
                            <SelectContent>
                                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={String(customYear)} onValueChange={(v) => setCustomYear(Number(v))}>
                             <SelectTrigger className="w-[120px]"> <SelectValue placeholder="Select year" /> </SelectTrigger>
                             <SelectContent>
                                {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                             </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
            <TabsContent value="current"><InsightSection transactions={periodTransactions} timePeriodLabel={periodLabel}/></TabsContent>
            <TabsContent value="all"><InsightSection transactions={periodTransactions} timePeriodLabel={periodLabel}/></TabsContent>
            <TabsContent value="custom"><InsightSection transactions={periodTransactions} timePeriodLabel={periodLabel}/></TabsContent>
        </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="text-primary" />
            Download Report
          </CardTitle>
          <CardDescription>
            Get a detailed PDF summary of your income and expenses for the selected period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleDownloadPDF} disabled={isLoading || isDownloading || transactions.length === 0}>
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isDownloading ? 'Generating PDF...' : `Download Report for ${periodLabel}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
