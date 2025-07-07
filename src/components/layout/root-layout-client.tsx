
"use client";

import { usePathname, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { DataProvider, useData } from "@/hooks/use-data";
import { SplashScreen } from "../splash-screen";


function AppBootstrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, userData } = useAuth();
  const { isLoading: dataLoading } = useData();

  const isAuthPage = pathname === "/" || pathname === "/signup";

  useEffect(() => {
    // This effect acts as a global guard.
    // It ensures unauthenticated users are always on an auth page.
    if (authLoading) return;

    if (!user && !isAuthPage) {
      router.push("/");
    }
  }, [user, authLoading, isAuthPage, router]);

  useEffect(() => {
    if (userData?.primaryColor) {
      document.documentElement.style.setProperty('--primary', userData.primaryColor);
      document.documentElement.style.setProperty('--ring', userData.primaryColor);
    }
  }, [userData?.primaryColor]);

  // Show splash screen only during the initial auth check.
  const showSplash = authLoading;

  if (showSplash) {
    return <SplashScreen />;
  }

  // If we are on an auth page, just render the children (login/signup form)
  if (isAuthPage) {
     return <>{children}</>;
  }

  // If we are on a protected page but have no user, the guard will redirect.
  // We can show a splash screen in the meantime to avoid flicker.
  if (!user) {
    return <SplashScreen />;
  }

  // If user is authenticated and not on an auth page, render the full app layout
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
