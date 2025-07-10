
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
  displayName: z.string().min(2, { message: "Display name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export default function SignupPage() {
  const { user, signUpWithEmail, loading: authLoading } = useAuth();
  const router = useRouter();
  const isFirebaseConfigured = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const [inProgress, setInProgress] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
        router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setInProgress(true);
    try {
      await signUpWithEmail(values.email, values.password, values.displayName);
      router.push('/dashboard');
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        form.setError("email", { type: "manual", message: "This email address is already in use." });
        toast.error("This email address is already in use.");
      } else {
        toast.error("Signup Failed", { description: error.message || "Please try again."});
      }
    } finally {
        setInProgress(false);
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
       {/* Background blobs */}
      <div className="absolute -top-1/4 left-0 h-1/2 w-1/2 animate-[spin_20s_linear_infinite] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-1/4 right-0 h-1/2 w-1/2 animate-[spin_20s_linear_infinite_reverse] rounded-full bg-accent/10 blur-3xl" />
      
      <Card className="relative w-full max-w-md border-border/20 bg-background/60 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-500">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Logo />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-bold font-headline">Create an Account</CardTitle>
            <CardDescription>Enter your information to get started.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
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
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="displayName">Display Name</Label>
                    <FormControl>
                      <Input id="displayName" placeholder="Jane Doe" {...field} disabled={!isFirebaseConfigured || inProgress} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="email">Email</Label>
                    <FormControl>
                      <Input id="email" type="email" placeholder="m@example.com" {...field} disabled={!isFirebaseConfigured || inProgress} />
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
                    <Label htmlFor="password">Password</Label>
                    <FormControl>
                      <Input id="password" type="password" {...field} disabled={!isFirebaseConfigured || inProgress} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={inProgress || !isFirebaseConfigured}>
                {inProgress && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/" className="underline">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
