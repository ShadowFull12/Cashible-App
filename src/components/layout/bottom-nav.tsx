
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, History, Lightbulb, Users, Plus, Calendar, Bell, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { useData } from "@/hooks/use-data";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/history", icon: History, label: "History" },
  { href: "/spend-circle", icon: Users, label: "Circle" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/insights", icon: Lightbulb, label: "Insights" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
];

interface BottomNavProps {
    onAddExpenseClick: () => void;
}

export function BottomNav({ onAddExpenseClick }: BottomNavProps) {
  const pathname = usePathname();
  const { unreadNotificationCount, hasNewNotification, clearNewNotification } = useData();

  const handleNavClick = (href: string) => {
    if(href === '/notifications') {
      clearNewNotification();
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur-sm md:hidden">
      <div className="relative mx-auto grid h-16 grid-cols-7 max-w-md items-center justify-around">
        {navItems.slice(0, 3).map((item) => (
          <Link href={item.href} key={item.href} className="flex-1 relative" onClick={() => handleNavClick(item.href)}>
            <div
              className={cn(
                "flex h-full items-center justify-center text-sm font-medium transition-colors",
                pathname.startsWith(item.href)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn("relative rounded-full p-2", item.href === '/notifications' && hasNewNotification && "animate-notification-glow")}>
                <item.icon className="size-6" />
                 {item.href === '/notifications' && unreadNotificationCount > 0 && (
                  <div className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                      {unreadNotificationCount}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
        
        <div className="relative flex justify-center -top-4">
            <Button
                size="icon"
                className="h-14 w-14 rounded-full shadow-lg"
                onClick={onAddExpenseClick}
            >
                <Plus className="size-6" />
            </Button>
        </div>

        {navItems.slice(3).map((item) => (
          <Link href={item.href} key={item.href} className="flex-1 relative" onClick={() => handleNavClick(item.href)}>
            <div
              className={cn(
                "flex h-full items-center justify-center text-sm font-medium transition-colors",
                pathname.startsWith(item.href)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn("relative rounded-full p-2", item.href === '/notifications' && hasNewNotification && "animate-notification-glow")}>
                <item.icon className="size-6" />
                 {item.href === '/notifications' && unreadNotificationCount > 0 && (
                  <div className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                      {unreadNotificationCount}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
