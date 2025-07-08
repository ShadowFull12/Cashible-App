
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
  DialogFooter,
  DialogClose,
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
import type { UserProfile, Circle } from "@/lib/data";
import { initiateSettlement } from "@/services/debtService";

interface SettleDebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toUser: UserProfile;
  amountOwed: number;
  circle: Circle;
  onSettlementRequested: () => void;
}

export function SettleDebtDialog({ open, onOpenChange, toUser, amountOwed, circle, onSettlementRequested }: SettleDebtDialogProps) {
  const { user: fromUser, userData } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formSchema = z.object({
    amount: z.coerce.number()
        .positive({ message: "Amount must be positive." })
        .max(amountOwed, { message: `You can't pay back more than you owe (₹${amountOwed.toFixed(2)}).` }),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: Number(amountOwed.toFixed(2)),
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!fromUser || !fromUser.displayName || !fromUser.email) {
        toast.error("Your user profile is incomplete.");
        return;
    };
    
    setIsSubmitting(true);
    try {
        const fromUserProfile: UserProfile = {
            uid: fromUser.uid,
            displayName: fromUser.displayName,
            email: fromUser.email,
            photoURL: userData?.photoURL || fromUser.photoURL || null,
        }

        await initiateSettlement(fromUserProfile, toUser, values.amount, circle.id, circle.name);
        toast.success(`Settlement request of ₹${values.amount.toFixed(2)} sent to ${toUser.displayName}.`);
        onSettlementRequested();
    } catch (error: any) {
        toast.error("Failed to send settlement request", { description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay Back {toUser.displayName}</DialogTitle>
          <DialogDescription>
            Enter the amount you've paid. A confirmation request will be sent to {toUser.displayName}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount to Pay (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Mark as Paid
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
