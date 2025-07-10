
"use client";

import { usePathname, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { DataProvider, useData } from "@/hooks/use-data";
import { SplashScreen } from "../splash-screen";


function AppBootstrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, userData } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isAuthPage = pathname === "/" || pathname === "/signup";

  useEffect(() => {
    // Guard effect: Redirects unauthenticated users from protected pages.
    if (!isMounted || authLoading) return; // Wait for client mount and auth check

    if (!user && !isAuthPage) {
      router.push("/");
    }
  }, [user, authLoading, isAuthPage, router, isMounted]);

  useEffect(() => {
    // Theme effect
    if (userData?.primaryColor) {
      document.documentElement.style.setProperty('--primary', userData.primaryColor);
      document.documentElement.style.setProperty('--ring', userData.primaryColor);
    }
  }, [userData?.primaryColor]);

  // On server-side and initial client-side render, always show the splash screen
  // to ensure the render trees match and prevent a hydration error.
  if (!isMounted || authLoading) {
    return <SplashScreen />;
  }

  // After hydration, we can safely render based on the auth state.
  if (isAuthPage) {
    // The login/signup pages have their own logic to redirect authenticated users.
    return <>{children}</>;
  }

  // For protected pages, if there's no user, show a splash screen while the
  // guard effect redirects them.
  if (!user) {
    return <SplashScreen />;
  }
  
  // Authenticated user on a protected page.
  return <AppLayout>{children}</AppLayout>;
}


export function RootLayoutClient({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <DataProvider>
      <AppBootstrapper>{children}</AppBootstrapper>
    </DataProvider>
  );
}
