
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { SidebarNav } from "./sidebar-nav";
import { UserNav } from "./user-nav";
import { Logo } from "../logo";
import { Button } from "../ui/button";
import { PlusCircle, LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddExpenseDialog } from "../add-expense-dialog";
import { useData } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { BottomNav } from "./bottom-nav";
import { InitialBudgetModal } from "../initial-budget-modal";
import { SetUsernameModal } from "../set-username-modal";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isBudgetModalOpen, setIsBudgetModalOpen] = React.useState(false);
  const { 
    refreshData, 
    newExpenseDefaultDate, 
    setNewExpenseDefaultDate,
    isAddExpenseOpen,
    setIsAddExpenseOpen,
    newExpenseDefaultCircleId,
   } = useData();
  const { user, userData, loading: authLoading, logout, isSettingUsername, completeInitialSetup } = useAuth();
  const isMobile = useIsMobile();
  const router = useRouter();
  const userInitial = user?.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : user?.email
    ? user.email.charAt(0).toUpperCase()
    : "U";

  React.useEffect(() => {
    if (!authLoading && userData && userData.budgetIsSet === false && !isSettingUsername) {
      setIsBudgetModalOpen(true);
    }
  }, [userData, authLoading, isSettingUsername]);

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
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Failed to log out");
    }
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Logo className="size-8" />
            <h1 className="text-xl font-semibold font-headline text-sidebar-foreground">
              SpendWise
            </h1>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={user?.photoURL || undefined}
                      alt={user?.displayName || "User"}
                    />
                    <AvatarFallback>{userInitial}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="truncate text-sm font-medium leading-none">
                      {user?.displayName || "User"}
                    </p>
                    <p className="truncate text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <Link href="/settings">
                    <DropdownMenuItem>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Profile & Settings</span>
                    </DropdownMenuItem>
                  </Link>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="hidden sm:flex">
            <Button onClick={() => setIsAddExpenseOpen(true)}>
              <PlusCircle className="mr-2 size-4" />
              Add Expense
            </Button>
          </div>
        </header>
        <main className="mb-16 flex-1 p-4 sm:p-6 lg:p-8 md:mb-0">
          {children}
        </main>
        {isMobile && (
          <BottomNav onAddExpenseClick={() => setIsAddExpenseOpen(true)} />
        )}
      </SidebarInset>
      <AddExpenseDialog
        open={isAddExpenseOpen}
        onOpenChange={handleOpenChange}
        onExpenseAdded={handleExpenseAdded}
        transactionToEdit={null}
        defaultDate={newExpenseDefaultDate}
        defaultCircleId={newExpenseDefaultCircleId}
      />
       <SetUsernameModal 
          open={isSettingUsername}
          onUsernameSet={completeInitialSetup}
      />
      <InitialBudgetModal
        open={isBudgetModalOpen}
        onOpenChange={setIsBudgetModalOpen}
        onBudgetSet={handleBudgetSet}
      />
    </SidebarProvider>
  );
}
