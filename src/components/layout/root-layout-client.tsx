"use client";

import { usePathname } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Toaster } from "@/components/ui/toaster";

export function RootLayoutClient({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/" || pathname === "/signup";

  return (
    <>
      {isAuthPage ? (
        <>
          {children}
        </>
      ) : (
        <AppLayout>
          {children}
        </AppLayout>
      )}
      <Toaster />
    </>
  );
}
