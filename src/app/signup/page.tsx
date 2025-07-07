
"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, writeBatch } from "firebase/firestore";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { auth, db } from "@/lib/firebase";
import { defaultCategories } from "@/lib/data";
import { isUsernameAvailable } from "@/services/userService";

const formSchema = z.object({
  displayName: z.string().min(2, { message: "Display name must be at least 2 characters." }),
  username: z.string().min(3, { message: "Username must be 3-15 characters." }).regex(/^[a-zA-Z0-9_]{3,15}$/, { message: "Use only letters, numbers, and underscores." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const isFirebaseConfigured = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: "",
      username: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    if (!db) {
        toast.error("Database connection not available. Please try again later.");
        setIsLoading(false);
        return;
    }

    try {
      const usernameAvailable = await isUsernameAvailable(values.username);
      if (!usernameAvailable) {
        form.setError("username", { type: "manual", message: "This username is already taken." });
        setIsLoading(false);
        return;
      }

      // Step 1: Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      // Step 2: Update the auth profile immediately. This doesn't require Firestore permissions.
      await updateProfile(user, { displayName: values.displayName, photoURL: null });
      
      // Step 3: Force a token refresh AFTER updating profile to ensure all data is current for Firestore rules.
      await user.getIdToken(true);
      
      // Step 4: Now, perform Firestore writes with the newly authenticated user.
      const batch = writeBatch(db);

      const userDocRef = doc(db, "users", user.uid);
      batch.set(userDocRef, {
        uid: user.uid,
        displayName: values.displayName,
        username: values.username.toLowerCase(),
        email: user.email!,
        categories: defaultCategories,
        budget: 0,
        budgetIsSet: false,
        photoURL: null,
        primaryColor: '181 95% 45%',
      });

      const usernameDocRef = doc(db, "usernames", values.username.toLowerCase());
      batch.set(usernameDocRef, { uid: user.uid });

      await batch.commit();

      toast.success("Account created successfully! Redirecting...");
      // The redirect will be handled by the onAuthStateChanged listener in RootLayoutClient
    } catch (error: any) {
       if (error.code === 'auth/email-already-in-use') {
        form.setError("email", { type: "manual", message: "This email address is already in use." });
        toast.error("This email address is already in use.");
      } else {
        toast.error(error.message || "Failed to create account. Please try again.");
      }
      console.error("Signup error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background p-4">
       {/* Background blobs */}
      <div className="absolute -top-1/4 left-0 h-1/2 w-1/2 animate-[spin_20s_linear_infinite] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-1/4 right-0 h-1/2 w-1/2 animate-[spin_20s_linear_infinite_reverse] rounded-full bg-accent/10 blur-3xl" />
      
      <Card className="relative w-full max-w-md border-border/20 bg-background/60 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-24 duration-1000 ease-out">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 animate-in fade-in-0 slide-in-from-top-12 delay-300 duration-700">
            <Logo />
          </div>
          <div className="space-y-1 animate-in fade-in-0 slide-in-from-top-16 delay-500 duration-700">
            <CardTitle className="text-3xl font-bold font-headline">Create an Account</CardTitle>
            <CardDescription>Enter your information to get started.</CardDescription>
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
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="displayName">Display Name</Label>
                    <FormControl>
                      <Input id="displayName" placeholder="Jane Doe" {...field} disabled={!isFirebaseConfigured} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="username">Username</Label>
                    <FormControl>
                      <Input id="username" placeholder="jane_doe" {...field} disabled={!isFirebaseConfigured} />
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
                      <Input id="email" type="email" placeholder="m@example.com" {...field} disabled={!isFirebaseConfigured} />
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
                      <Input id="password" type="password" {...field} disabled={!isFirebaseConfigured} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading || !isFirebaseConfigured}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
