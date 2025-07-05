"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, History, Lightbulb, CalendarDays, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/history", icon: History, label: "History" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/insights", icon: Lightbulb, label: "Insights" },
];

interface BottomNavProps {
    onAddExpenseClick: () => void;
}

export function BottomNav({ onAddExpenseClick }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur-sm md:hidden">
      <div className="relative mx-auto flex h-16 max-w-md items-center justify-around">
        {navItems.slice(0, 2).map((item) => (
          <Link href={item.href} key={item.href} className="flex-1">
            <div
              className={cn(
                "flex h-full flex-col items-center justify-center gap-1 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="size-5" />
              <span className="text-xs">{item.label}</span>
            </div>
          </Link>
        ))}
        
        <div className="relative -top-6">
            <Button
                size="icon"
                className="h-14 w-14 rounded-full shadow-lg"
                onClick={onAddExpenseClick}
            >
                <Plus className="size-6" />
            </Button>
        </div>

        {navItems.slice(2).map((item) => (
          <Link href={item.href} key={item.href} className="flex-1">
            <div
              className={cn(
                "flex h-full flex-col items-center justify-center gap-1 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="size-5" />
               <span className="text-xs">{item.label}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
