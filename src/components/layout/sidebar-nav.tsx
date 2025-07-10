
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuBadge } from "@/components/ui/sidebar";
import { LayoutDashboard, History, Lightbulb, Users, Settings, Calendar, Bell, Briefcase } from "lucide-react";
import { useData } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { useAuth } from "@/hooks/use-auth";

const baseNavItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/history", icon: History, label: "History" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/spend-circle", icon: Users, label: "Spend Circle" },
];

const personalNavItems = [
    ...baseNavItems,
    { href: "/insights", icon: Lightbulb, label: "Insights" },
];

const businessNavItems = [
    ...baseNavItems,
    { href: "/sales-scribe", icon: Briefcase, label: "SalesScribe", tag: "Beta" },
];

const bottomNavItems = [
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { userData } = useAuth();
  const { unreadNotificationCount, hasNewNotification, clearNewNotification } = useData();

  const handleNavClick = (href: string) => {
    if(href === '/notifications') {
      clearNewNotification();
    }
  }

  const mainNavItems = userData?.accountType === 'business' ? businessNavItems : personalNavItems;
  const navItems = [...mainNavItems, ...bottomNavItems];

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
              <span className="flex items-center gap-2">{item.label}
                 {item.tag && <Badge variant="outline" className="text-xs">{item.tag}</Badge>}
              </span>
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
