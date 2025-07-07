
"use client";

import { usePathname, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { DataProvider } from "@/hooks/use-data";
import { SplashScreen } from "../splash-screen";

export function RootLayoutClient({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, userData } = useAuth();

  const isAuthPage = pathname === "/" || pathname === "/signup";

  useEffect(() => {
    // This effect acts as a global guard.
    // It ensures unauthenticated users are always on an auth page.
    if (loading) return;

    if (!user && !isAuthPage) {
      router.push("/");
    }
  }, [user, loading, isAuthPage, router]);

  useEffect(() => {
    if (userData?.primaryColor) {
      document.documentElement.style.setProperty('--primary', userData.primaryColor);
      document.documentElement.style.setProperty('--ring', userData.primaryColor);
    }
  }, [userData?.primaryColor]);


  if (loading) {
    return (
      <SplashScreen />
    );
  }

  // If we are on an auth page, just render the children (login/signup form)
  if (isAuthPage) {
     return <>{children}</>;
  }

  // If we are on a protected page but have no user, return null to avoid flicker
  // while the guard in useEffect redirects.
  if (!user) {
    return null;
  }

  // If user is authenticated and not on an auth page, render the full app layout
  return (
    <DataProvider>
      <AppLayout>{children}</AppLayout>
    </DataProvider>
  );
}
