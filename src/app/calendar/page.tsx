
"use client"

import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useData } from "@/hooks/use-data"
import type { Transaction } from "@/lib/data"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TransactionActions } from "@/components/transaction-actions"
import { useIsMobile } from "@/hooks/use-mobile"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"


export default function CalendarPage() {
  const { transactions, categories, setNewExpenseDefaultDate, refreshData } = useData();
  const [date, setDate] = React.useState<Date | undefined>(new Date());

  const [isClient, setIsClient] = React.useState(false);
  const isMobile = useIsMobile();
  React.useEffect(() => {
    setIsClient(true);
  }, []);
  
  React.useEffect(() => {
    if (date) {
      setNewExpenseDefaultDate(date);
    }
    return () => {
      setNewExpenseDefaultDate(null);
    }
  }, [date, setNewExpenseDefaultDate]);
  
  const dailyTransactions = React.useMemo(() => {
    const dayMap = new Map<string, { categories: Set<string>, transactions: Transaction[], hasIncome: boolean, hasExpense: boolean }>();
    transactions.forEach(t => {
      const dayStr = format(t.date, 'yyyy-MM-dd');
      if (!dayMap.has(dayStr)) {
        dayMap.set(dayStr, { categories: new Set(), transactions: [], hasIncome: false, hasExpense: false });
      }
      const dayData = dayMap.get(dayStr)!;
      dayData.transactions.push(t);
      if (t.amount > 0) {
        dayData.categories.add(t.category);
        dayData.hasExpense = true;
      } else {
        dayData.hasIncome = true;
      }
    });
    
    return Array.from(dayMap.entries()).map(([dayStr, data]) => ({
      date: new Date(dayStr),
      categories: Array.from(data.categories),
      transactions: data.transactions.sort((a,b) => b.date.getTime() - a.date.getTime()),
      hasIncome: data.hasIncome,
      hasExpense: data.hasExpense,
    }));
  }, [transactions]);

  const categoryColors = React.useMemo(() => {
    return categories.reduce((acc, cat) => {
        acc[cat.name] = cat.color;
        return acc;
    }, {} as {[key: string]: string});
  }, [categories]);
  
  const selectedDayTransactions = React.useMemo(() => {
      if (!date) return [];
      const dayMatch = dailyTransactions.find(d => 
        d.date.getDate() === date.getDate() &&
        d.date.getMonth() === date.getMonth() &&
        d.date.getFullYear() === date.getFullYear()
      );
      return dayMatch ? dayMatch.transactions : [];
  }, [date, dailyTransactions]);

  const renderDesktopTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Description</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="w-[10px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {selectedDayTransactions.map(t => (
          <TableRow key={t.id}>
            <TableCell className="font-medium">{t.description}</TableCell>
            <TableCell>
              <Badge variant="outline" style={{borderColor: t.amount > 0 ? categoryColors[t.category] : 'hsl(var(--primary))'}}>
                {t.category}
              </Badge>
            </TableCell>
            <TableCell className={cn("text-right font-bold", t.amount < 0 && 'text-green-500')}>
                {t.amount < 0 && '+'}{t.amount < 0 ? `₹${Math.abs(t.amount).toLocaleString()}` : `₹${t.amount.toLocaleString()}`}
            </TableCell>
              <TableCell>
                  <TransactionActions transaction={t} onDelete={refreshData} onUpdate={refreshData} />
              </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const renderMobileCards = () => (
    <div className="space-y-3">
      {selectedDayTransactions.map(t => (
        <Card key={t.id} className="p-4">
            <div className="flex justify-between items-start">
                <div className="flex-grow space-y-1">
                    <p className="font-medium">{t.description}</p>
                    <Badge variant="outline" style={{borderColor: t.amount > 0 ? categoryColors[t.category] : 'hsl(var(--primary))'}}>
                        {t.category}
                    </Badge>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <p className={cn("font-bold text-lg", t.amount < 0 && 'text-green-500')}>
                        {t.amount < 0 && '+'}{t.amount < 0 ? `₹${Math.abs(t.amount).toLocaleString()}` : `₹${t.amount.toLocaleString()}`}
                    </p>
                    <TransactionActions transaction={t} onDelete={refreshData} onUpdate={refreshData} />
                </div>
            </div>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="grid gap-6">
    <Card>
        <CardHeader>
            <CardTitle>Expense Calendar</CardTitle>
            <CardDescription>View your daily expenses at a glance. Dots indicate days with spending.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
        <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border"
            components={{
              DayContent: ({ date }) => {
                const dayMatch = dailyTransactions.find(d => 
                    d.date.getDate() === date.getDate() &&
                    d.date.getMonth() === date.getMonth() &&
                    d.date.getFullYear() === date.getFullYear()
                );
                
                const dayContent = (
                  <div className="relative h-full w-full flex items-center justify-center">
                     <p>{date.getDate()}</p>
                    {dayMatch && (
                      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                         {dayMatch.hasExpense && <span className={`h-1.5 w-1.5 rounded-full bg-destructive`}></span>}
                         {dayMatch.hasIncome && <span className={`h-1.5 w-1.5 rounded-full bg-green-500`}></span>}
                      </div>
                    )}
                  </div>
                );

                if (dayMatch) {
                    return (
                        <Popover>
                            <PopoverTrigger asChild>
                                <div className="h-full w-full cursor-pointer">{dayContent}</div>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                               <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Transactions for {format(date, "PPP")}</h4>
                                    <div className="text-sm text-muted-foreground space-y-1">
                                        {dayMatch.transactions.map(t => (
                                            <div key={t.id} className="flex justify-between items-center">
                                                <span>
                                                    <Badge variant="outline" className="mr-2" style={{borderColor: t.amount > 0 ? categoryColors[t.category] : 'hsl(var(--primary))'}}>
                                                        {t.category}
                                                    </Badge>
                                                    {t.description}
                                                </span>
                                                <span className={cn("font-medium", t.amount < 0 && 'text-green-500')}>
                                                    {t.amount < 0 ? '+' : ''}₹{Math.abs(t.amount).toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                               </div>
                            </PopoverContent>
                        </Popover>
                    )
                }

                return dayContent;
              }
            }}
        />
        </CardContent>
    </Card>

    {selectedDayTransactions.length > 0 && (
      <Card>
        <CardHeader>
          <CardTitle>Transactions for {date ? format(date, "PPP") : ''}</CardTitle>
          <CardDescription>A detailed list of your income and expenses for the selected day.</CardDescription>
        </CardHeader>
        <CardContent>
          {isClient ? (isMobile ? renderMobileCards() : renderDesktopTable()) : <Skeleton className="h-40 w-full"/>}
        </CardContent>
      </Card>
    )}
    </div>
  )
}
