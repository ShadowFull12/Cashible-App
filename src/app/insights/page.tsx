
"use client";

import { useState, useMemo, useRef } from "react";
import { spendingInsights, SpendingInsightsInput } from "@/ai/flows/spending-insights";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Loader2, TrendingUp, Trophy, CalendarDays, Download } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, XAxis, YAxis, Bar } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useData } from "@/hooks/use-data";
import { format, startOfMonth, endOfMonth, differenceInDays, isWithinInterval } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import jsPDF from "jspdf";
import "jspdf-autotable";
import html2canvas from 'html2canvas';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF5733', '#3b82f6', '#ec4899'];

export default function InsightsPage() {
  const { transactions, isLoading } = useData();
  const { user } = useAuth();
  const [insights, setInsights] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const categoryChartRef = useRef<HTMLDivElement>(null);
  const dailySpendChartRef = useRef<HTMLDivElement>(null);
  const monthlyTrendChartRef = useRef<HTMLDivElement>(null);

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
    if (transactions.length === 0) return { topCategory: 'N/A', avgDaily: 0, netSpent: 0 };
    
    const now = new Date();
    const firstDay = startOfMonth(now);
    const lastDay = endOfMonth(now);
    const currentMonthInterval = { start: firstDay, end: lastDay };

    const netSpent = transactions
      .filter(t => isWithinInterval(t.date, currentMonthInterval))
      .reduce((sum, t) => sum + t.amount, 0);

    const topCategory = categoryData[0]?.name || 'N/A';
    
    const daysInMonthSoFar = differenceInDays(now, firstDay) + 1;
    const avgDaily = daysInMonthSoFar > 0 ? netSpent / daysInMonthSoFar : 0;
    
    return { topCategory, avgDaily: Math.round(avgDaily), netSpent };
  }, [transactions, categoryData]);

  const { totalMonthlyExpenses, totalMonthlyIncome, netSpending, currentMonthTransactions } = useMemo(() => {
    if (transactions.length === 0) {
      return { totalMonthlyExpenses: 0, totalMonthlyIncome: 0, netSpending: 0, currentMonthTransactions: [] };
    }
    const now = new Date();
    const firstDay = startOfMonth(now);
    const lastDay = endOfMonth(now);
    const currentMonthInterval = { start: firstDay, end: lastDay };

    const monthlyTxs = transactions.filter(t => isWithinInterval(t.date, currentMonthInterval));

    const expenses = monthlyTxs.filter(t => t.amount > 0);
    const income = monthlyTxs.filter(t => t.amount < 0);

    const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = income.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    return {
      totalMonthlyExpenses: totalExpenses,
      totalMonthlyIncome: totalIncome,
      netSpending: totalExpenses - totalIncome,
      currentMonthTransactions: expenses.sort((a, b) => a.date.getTime() - b.date.getTime())
    };
  }, [transactions]);


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

  const handleDownloadPDF = async () => {
    if(isDownloading) return;
    setIsDownloading(true);

    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const monthName = format(new Date(), 'MMMM yyyy');
    const userDisplayName = user?.displayName || 'User';

    let y = 20;
    const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
    const PAGE_MARGIN = 20;

    const checkPageBreak = (currentY: number, elementHeight: number) => {
        if (currentY + elementHeight > PAGE_HEIGHT - PAGE_MARGIN) {
            doc.addPage();
            return PAGE_MARGIN;
        }
        return currentY;
    };
    
    const addImageToPdf = async (doc: jsPDF, element: HTMLElement | null, yPos: number, title: string) => {
      if (!element) return yPos;
      
      const titleHeight = 10;
      yPos = checkPageBreak(yPos, titleHeight);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 14, yPos);
      yPos += titleHeight;
      
      try {
          const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2 });
          const imgData = canvas.toDataURL('image/png');
          const imgProps = doc.getImageProperties(imgData);
          const pdfWidth = (doc.internal.pageSize.getWidth() - 28) * 0.45; // 45% width for side-by-side
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          yPos = checkPageBreak(yPos, pdfHeight);

          return { yPos: yPos + pdfHeight + 10, imgData, pdfWidth, pdfHeight };
      } catch(e) {
          console.error("Error capturing chart for PDF:", e);
          yPos = checkPageBreak(yPos, 10);
          doc.setFont('helvetica', 'normal').setFontSize(10).text("Could not render chart.", 14, yPos);
          return { yPos: yPos + 10, imgData: null, pdfWidth: 0, pdfHeight: 0 };
      }
    };

    // --- PDF CONTENT ---
    // Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('SpendWise Monthly Report', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${monthName} for ${userDisplayName}`, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
    y += 15;

    // Summary Section
    y = checkPageBreak(y, 15);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Monthly Summary', 14, y);
    y += 8;
    (doc as any).autoTable({
      startY: y,
      body: [
        ['Total Expenses:', `Rs. ${totalMonthlyExpenses.toFixed(2)}`],
        ['Total Income:', `Rs. ${totalMonthlyIncome.toFixed(2)}`],
      ],
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 11 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Transactions Table
    y = checkPageBreak(y, 15);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Expense Transactions', 14, y);
    y += 8;
    (doc as any).autoTable({
        startY: y,
        head: [['Date', 'Description', 'Category', 'Amount (Rs.)']],
        body: currentMonthTransactions.map(t => [
            format(t.date, 'dd MMM, yyyy'),
            t.description,
            t.category,
            t.amount.toFixed(2)
        ]),
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94] },
        styles: { font: 'helvetica', fontSize: 10 },
        columnStyles: { 3: { halign: 'right' } }
    });
    y = (doc as any).lastAutoTable.finalY + 15;

    // Charts & Graphs
    doc.addPage();
    y = PAGE_MARGIN;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Visual Analysis', 14, y);
    y += 10;
    
    // Add charts, potentially adding new pages as needed
    const chart1 = await addImageToPdf(doc, categoryChartRef.current, y, 'Spending by Category');
    const chart2 = await addImageToPdf(doc, dailySpendChartRef.current, y, 'Spending by Day of Week');
    
    const chartHeight = Math.max(chart1.pdfHeight, chart2.pdfHeight);
    y = checkPageBreak(y, chartHeight);
    
    if(chart1.imgData) doc.addImage(chart1.imgData, 'PNG', 14, chart1.yPos, chart1.pdfWidth, chart1.pdfHeight);
    if(chart2.imgData) doc.addImage(chart2.imgData, 'PNG', doc.internal.pageSize.getWidth()/2 + 7, chart2.yPos, chart2.pdfWidth, chart2.pdfHeight);
    y += chartHeight + 15;

    const chart3 = await addImageToPdf(doc, monthlyTrendChartRef.current, y, 'Monthly Spending Trend');
     if(chart3.imgData) doc.addImage(chart3.imgData, 'PNG', 14, chart3.yPos, chart3.pdfWidth, chart3.pdfHeight);
    y = chart3.yPos + chart3.pdfHeight + 15;

    // Final Calculation
    y = checkPageBreak(y, 20);
    doc.setLineWidth(0.5);
    doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y);
    y += 15;
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    
    const finalLabel = 'Net Monthly Expenses';
    const finalAmount = `Rs. ${netSpending.toFixed(2)}`;
    const finalColor = netSpending >= 0 ? [220, 38, 38] : [22, 163, 74];

    doc.text(finalLabel, 14, y);
    doc.setTextColor(finalColor[0], finalColor[1], finalColor[2]);
    doc.text(finalAmount, doc.internal.pageSize.getWidth() - 14, y, { align: 'right' });
    doc.setTextColor(0, 0, 0); // Reset color
    y += 10;
    
    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
        doc.text(`Report generated by SpendWise on ${format(new Date(), 'PPP')}`, 14, doc.internal.pageSize.height - 10);
    }

    doc.save(`SpendWise-Report-${format(new Date(), 'yyyy-MM')}.pdf`);
    setIsDownloading(false);
  };

  return (
    <div className="grid gap-6 md:gap-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="lg:col-span-2" ref={categoryChartRef}>
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
        <Card ref={dailySpendChartRef}>
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
         <Card ref={monthlyTrendChartRef}>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="text-primary" />
            Download Monthly Report
          </CardTitle>
          <CardDescription>
            Get a detailed PDF summary of your income and expenses for the current month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleDownloadPDF} disabled={isLoading || isDownloading || transactions.length === 0}>
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isDownloading ? 'Generating PDF...' : 'Download Report as PDF'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
