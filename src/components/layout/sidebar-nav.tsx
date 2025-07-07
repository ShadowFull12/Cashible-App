
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuBadge } from "@/components/ui/sidebar";
import { LayoutDashboard, History, Lightbulb, Users, Settings, Calendar, Bell } from "lucide-react";
import { useData } from "@/hooks/use-data";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/history", icon: History, label: "History" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/insights", icon: Lightbulb, label: "Insights" },
  { href: "/spend-circle", icon: Users, label: "Spend Circle" },
  { href: "/settings", icon: Settings, label: "Settings" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { unreadNotificationCount, hasNewNotification, clearNewNotification } = useData();

  const handleNavClick = (href: string) => {
    if(href === '/notifications') {
      clearNewNotification();
    }
  }

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} onClick={() => handleNavClick(item.href)}>
            <SidebarMenuButton 
              isActive={pathname.startsWith(item.href)} 
              tooltip={item.label}
              className={cn(item.href === '/notifications' && hasNewNotification && "animate-notification-glow")}
            >
              <item.icon />
              <span>{item.label}</span>
              {item.href === '/notifications' && unreadNotificationCount > 0 && (
                <SidebarMenuBadge>{unreadNotificationCount}</SidebarMenuBadge>
              )}
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
