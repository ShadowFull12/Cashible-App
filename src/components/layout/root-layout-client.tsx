
"use client";

import { usePathname, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { DataProvider } from "@/hooks/use-data";

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
    if (loading) return; // Wait until loading is complete

    if (!user && !isAuthPage) {
      router.push("/");
    }

    if (user && isAuthPage) {
      router.push("/dashboard");
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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user && !isAuthPage) {
    return null; // or a loading spinner, prevents flicker
  }
  
  if (user && isAuthPage) {
    return null; // or a loading spinner
  }

  return (
    <>
      {isAuthPage ? (
        <>{children}</>
      ) : (
        <DataProvider>
          <AppLayout>{children}</AppLayout>
        </DataProvider>
      )}
    </>
  );
}
