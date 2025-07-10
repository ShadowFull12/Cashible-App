
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, History, Lightbulb, Users, Plus, Calendar, Bell, Settings, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { useData } from "@/hooks/use-data";
import { Badge } from "../ui/badge";
import { useAuth } from "@/hooks/use-auth";

const personalNavItems = [
  { href: "/dashboard", icon: LayoutDashboard },
  { href: "/history", icon: History },
  { href: "/calendar", icon: Calendar },
  { href: "/spend-circle", icon: Users },
  { href: "/insights", icon: Lightbulb },
  { href: "/notifications", icon: Bell },
];

const businessNavItems = [
  { href: "/dashboard", icon: LayoutDashboard },
  { href: "/history", icon: History },
  { href: "/calendar", icon: Calendar },
  { href: "/spend-circle", icon: Users },
  { href: "/sales-scribe", icon: Briefcase },
  { href: "/notifications", icon: Bell },
];


interface BottomNavProps {
    onAddExpenseClick: () => void;
}

export function BottomNav({ onAddExpenseClick }: BottomNavProps) {
  const pathname = usePathname();
  const { userData } = useAuth();
  const { unreadNotificationCount } = useData();

  const navItems = userData?.accountType === 'business' ? businessNavItems : personalNavItems;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur-sm md:hidden">
      <div className="relative mx-auto grid h-16 grid-cols-7 max-w-lg items-center justify-around">
        {navItems.slice(0, 3).map((item) => (
          <Link href={item.href} key={item.href} className="flex-1 relative flex flex-col items-center justify-center h-full">
            <div
              className={cn(
                "flex items-center justify-center text-sm font-medium transition-colors w-full h-full",
                pathname.startsWith(item.href)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
                <item.icon className="size-6" />
            </div>
          </Link>
        ))}
        
        <div className="relative flex justify-center">
            <Button
                size="icon"
                className="h-14 w-14 rounded-full shadow-lg -translate-y-4"
                onClick={onAddExpenseClick}
            >
                <Plus className="size-6" />
            </Button>
        </div>

        {navItems.slice(3).map((item) => (
          <Link href={item.href} key={item.href} className="flex-1 relative flex flex-col items-center justify-center h-full">
            <div
              className={cn(
                "flex items-center justify-center text-sm font-medium transition-colors w-full h-full",
                pathname.startsWith(item.href)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
                <div className="relative">
                 <item.icon className="size-6" />
                 {item.href === '/notifications' && unreadNotificationCount > 0 && (
                    <Badge className="absolute -top-1 -right-2 h-4 w-4 justify-center rounded-full p-0 text-xs">
                        {unreadNotificationCount}
                    </Badge>
                 )}
                </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
