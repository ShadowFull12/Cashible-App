"use client";

import * as React from "react";
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { SidebarNav } from "./sidebar-nav";
import { UserNav } from "./user-nav";
import { Logo } from "../logo";
import { Button } from "../ui/button";
import { PlusCircle } from "lucide-react";
import { AddExpenseDialog } from "../add-expense-dialog";
import { useData } from "@/hooks/use-data";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isAddExpenseOpen, setIsAddExpenseOpen] = React.useState(false);
  const { refreshData } = useData();

  const handleExpenseAdded = () => {
    refreshData();
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Logo className="size-8" />
            <h1 className="text-xl font-semibold font-headline text-sidebar-foreground">SpendWise</h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter>
          <UserNav />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:justify-end">
          <div className="sm:hidden">
            <SidebarTrigger />
          </div>
          <Button onClick={() => setIsAddExpenseOpen(true)}>
            <PlusCircle className="mr-2 size-4" />
            Add Expense
          </Button>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
      <AddExpenseDialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen} onExpenseAdded={handleExpenseAdded} />
    </SidebarProvider>
  );
}
