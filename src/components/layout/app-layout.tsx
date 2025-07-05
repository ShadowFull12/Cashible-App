
"use client";

import * as React from "react";
import Link from "next/link";
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { SidebarNav } from "./sidebar-nav";
import { UserNav } from "./user-nav";
import { Logo } from "../logo";
import { Button } from "../ui/button";
import { PlusCircle } from "lucide-react";
import { AddExpenseDialog } from "../add-expense-dialog";
import { useData } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { BottomNav } from "./bottom-nav";
import { InitialBudgetModal } from "../initial-budget-modal";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isAddExpenseOpen, setIsAddExpenseOpen] = React.useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = React.useState(false);
  const { refreshData, newExpenseDefaultDate, setNewExpenseDefaultDate } = useData();
  const { user, userData, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const userInitial = user?.displayName ? user.displayName.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U');

  React.useEffect(() => {
    if (!authLoading && userData && userData.budgetIsSet === false) {
      setIsBudgetModalOpen(true);
    }
  }, [userData, authLoading]);

  const handleExpenseAdded = () => {
    refreshData();
  };

  const handleBudgetSet = () => {
    refreshData();
    setIsBudgetModalOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setIsAddExpenseOpen(isOpen);
    if (!isOpen) {
      setNewExpenseDefaultDate(null);
    }
  }

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
        <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-background/80 px-4 backdrop-blur-sm sm:justify-end">
            <div className="flex w-full items-center justify-between sm:hidden">
              <SidebarTrigger />
              <Link href="/settings" aria-label="Go to settings">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || "User"} />
                    <AvatarFallback>{userInitial}</AvatarFallback>
                </Avatar>
              </Link>
            </div>
            <div className="hidden sm:flex">
              <Button onClick={() => setIsAddExpenseOpen(true)}>
                <PlusCircle className="mr-2 size-4" />
                Add Expense
              </Button>
            </div>
          </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 mb-16 md:mb-0">
          {children}
        </main>
        {isMobile && <BottomNav onAddExpenseClick={() => setIsAddExpenseOpen(true)} />}
      </SidebarInset>
      <AddExpenseDialog 
        open={isAddExpenseOpen} 
        onOpenChange={handleOpenChange} 
        onExpenseAdded={handleExpenseAdded}
        defaultDate={newExpenseDefaultDate}
      />
      <InitialBudgetModal open={isBudgetModalOpen} onOpenChange={setIsBudgetModalOpen} onBudgetSet={handleBudgetSet} />
    </SidebarProvider>
  );
}
