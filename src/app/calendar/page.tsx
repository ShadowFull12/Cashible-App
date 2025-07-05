"use client"

import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const expenseDays = [
  { date: new Date(2024, 6, 2), categories: ['Food'] },
  { date: new Date(2024, 6, 5), categories: ['Transport', 'Shopping'] },
  { date: new Date(2024, 6, 10), categories: ['Entertainment'] },
  { date: new Date(2024, 6, 11), categories: ['Utilities'] },
  { date: new Date(2024, 6, 15), categories: ['Groceries'] },
  { date: new Date(2024, 6, 22), categories: ['Food', 'Entertainment'] },
  { date: new Date(2024, 6, 28), categories: ['Shopping'] },
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

export default function CalendarPage() {
  const [date, setDate] = React.useState<Date | undefined>(new Date())

  return (
    <Card>
        <CardHeader>
            <CardTitle>Expense Calendar</CardTitle>
            <CardDescription>View your daily expenses at a glance. Click on a date to add a new transaction.</CardDescription>
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
                if (dayMatch) {
                  return (
                    <div className="relative h-full w-full">
                       <p>{date.getDate()}</p>
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {dayMatch.categories.slice(0, 3).map(cat => (
                           <span key={cat} className={`h-1.5 w-1.5 rounded-full ${categoryColors[cat] || 'bg-gray-400'}`}></span>
                        ))}
                      </div>
                    </div>
                  );
                }
                return <p>{date.getDate()}</p>;
              }
            }}
        />
        </CardContent>
    </Card>
  )
}
