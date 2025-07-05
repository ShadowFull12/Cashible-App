"use client"

import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useData } from "@/hooks/use-data"
import type { Transaction } from "@/lib/data"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

interface ExpenseDay {
  date: Date;
  categories: string[];
  transactions: Transaction[];
}

export default function CalendarPage() {
  const { transactions, categories } = useData();
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  
  const expenseDays = React.useMemo(() => {
    const dayMap = new Map<string, { categories: Set<string>, transactions: Transaction[] }>();
    transactions.forEach(t => {
      const dayStr = format(t.date, 'yyyy-MM-dd');
      if (!dayMap.has(dayStr)) {
        dayMap.set(dayStr, { categories: new Set(), transactions: [] });
      }
      dayMap.get(dayStr)!.categories.add(t.category);
      dayMap.get(dayStr)!.transactions.push(t);
    });
    
    return Array.from(dayMap.entries()).map(([dayStr, data]) => ({
      date: new Date(dayStr),
      categories: Array.from(data.categories),
      transactions: data.transactions,
    }));
  }, [transactions]);

  const categoryColors = React.useMemo(() => {
    return categories.reduce((acc, cat) => {
        acc[cat.name] = cat.color;
        return acc;
    }, {} as {[key: string]: string});
  }, [categories]);

  return (
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
                const dayMatch = expenseDays.find(d => 
                    d.date.getDate() === date.getDate() &&
                    d.date.getMonth() === date.getMonth() &&
                    d.date.getFullYear() === date.getFullYear()
                );
                
                const dayContent = (
                  <div className="relative h-full w-full flex items-center justify-center">
                     <p>{date.getDate()}</p>
                    {dayMatch && (
                      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {dayMatch.categories.slice(0, 3).map(cat => (
                           <span key={cat} className={`h-1.5 w-1.5 rounded-full`} style={{backgroundColor: categoryColors[cat] || 'gray'}}></span>
                        ))}
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
                                    <h4 className="font-medium leading-none">Expenses for {format(date, "PPP")}</h4>
                                    <div className="text-sm text-muted-foreground space-y-1">
                                        {dayMatch.transactions.map(t => (
                                            <div key={t.id} className="flex justify-between items-center">
                                                <span>
                                                    <Badge variant="outline" className="mr-2" style={{borderColor: categoryColors[t.category]}}>
                                                        {t.category}
                                                    </Badge>
                                                    {t.name}
                                                </span>
                                                <span className="font-medium">₹{t.amount.toLocaleString()}</span>
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
  )
}
