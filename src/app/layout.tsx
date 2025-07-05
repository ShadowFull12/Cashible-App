import type { Metadata } from "next";
import "./globals.css";
import { RootLayoutClient } from "@/components/layout/root-layout-client";

export const metadata: Metadata = {
  title: "SpendWise",
  description: "Track your monthly expenses with ease.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body">
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
