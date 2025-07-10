
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  username: z.string().min(3, { message: "Username must be 3-15 characters long."}).regex(/^[a-zA-Z0-9_]{3,15}$/, { message: "Username can only contain letters, numbers, and underscores."}),
});

interface SetUsernameModalProps {
  open: boolean;
  onUsernameSet: (username: string) => Promise<void>;
}

export function SetUsernameModal({ open, onUsernameSet }: SetUsernameModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      await onUsernameSet(values.username);
      toast.success("Username set successfully!");
      form.reset();
    } catch (error: any) {
      toast.error("Failed to set username.", { description: error.message });
      form.setError("username", { type: 'manual', message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>One Last Step!</DialogTitle>
          <DialogDescription>
            Choose a unique username for your account. This will be used for friending and mentions.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. jane_doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Username
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
