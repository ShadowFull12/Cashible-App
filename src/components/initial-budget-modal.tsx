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
import { useAuth } from "@/hooks/use-auth";

const formSchema = z.object({
  budget: z.coerce.number().positive({ message: "Budget must be a positive number." }),
});

interface InitialBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBudgetSet: () => void;
}

export function InitialBudgetModal({ open, onOpenChange, onBudgetSet }: InitialBudgetModalProps) {
  const { updateUserProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      budget: 50000,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      await updateUserProfile({ budget: values.budget, budgetIsSet: true });
      toast.success("Budget set successfully!");
      onBudgetSet();
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to set budget. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Welcome to SpendWise!</DialogTitle>
          <DialogDescription>
            Let's start by setting your monthly budget. You can change this later in the settings.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="budget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Monthly Budget (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g. 50000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set Budget and Continue
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
