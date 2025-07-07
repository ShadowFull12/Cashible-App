
"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";

const formSchema = z.object({
  email: z.string().min(1, { message: "Email or Username is required." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export default function LoginPage() {
  const { user, signInWithEmail, loading: authLoading } = useAuth();
  const router = useRouter();
  const isFirebaseConfigured = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
        router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsEmailLoading(true);
    try {
      await signInWithEmail(values.email, values.password);
      router.push('/dashboard');
    } catch (error: any) {
      toast.error("Login Failed", { description: error.message || "Please check your credentials." });
    } finally {
        setIsEmailLoading(false);
    }
  }
  
  if (authLoading || user) {
      return (
          <div className="flex min-h-screen items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
          </div>
      );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background p-4">
      <div className="absolute -top-1/4 left-0 h-1/2 w-1/2 animate-[spin_20s_linear_infinite] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-1/4 right-0 h-1/2 w-1/2 animate-[spin_20s_linear_infinite_reverse] rounded-full bg-accent/10 blur-3xl" />

      <Card className="relative w-full max-w-md border-border/20 bg-background/60 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-24 duration-1000 ease-out">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 animate-in fade-in-0 slide-in-from-top-12 delay-300 duration-700">
             <Logo />
          </div>
          <div className="space-y-1 animate-in fade-in-0 slide-in-from-top-16 delay-500 duration-700">
            <CardTitle className="text-3xl font-bold font-headline">Welcome Back</CardTitle>
            <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="animate-in fade-in-0 slide-in-from-bottom-16 delay-700 duration-700">
          {!isFirebaseConfigured && (
            <Alert variant="destructive" className="mb-4 text-left">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Configuration Missing</AlertTitle>
              <AlertDescription>
                Your Firebase API key is not configured. Please create a <code>.env.local</code> file with your project credentials and restart the server.
              </AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="email">Email or Username</Label>
                    <FormControl>
                      <Input id="email" placeholder="m@example.com or jane_doe" {...field} disabled={!isFirebaseConfigured || isEmailLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center">
                      <Label htmlFor="password">Password</Label>
                      <Link href="#" className="ml-auto inline-block text-sm underline">
                        Forgot your password?
                      </Link>
                    </div>
                    <FormControl>
                      <Input id="password" type="password" {...field} disabled={!isFirebaseConfigured || isEmailLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isEmailLoading || !isFirebaseConfigured}>
                {isEmailLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Login
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
