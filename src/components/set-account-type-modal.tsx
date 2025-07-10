
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Briefcase, User, Package, Users, History, IndianRupee } from "lucide-react";
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
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { AccountType } from "@/hooks/use-auth";
import { Card, CardContent } from "./ui/card";

const formSchema = z.object({
  accountType: z.enum(["personal", "business"], {
    required_error: "You need to select an account type.",
  }),
});

interface SetAccountTypeModalProps {
  open: boolean;
  onAccountTypeSet: (type: AccountType) => Promise<void>;
}

export function SetAccountTypeModal({ open, onAccountTypeSet }: SetAccountTypeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      await onAccountTypeSet(values.accountType as AccountType);
      if (values.accountType === 'business') {
        toast.info("Business Account selected!", {
          description: "Go to the SalesScribe tab to set up your business profile.",
        });
      }
    } catch (error: any) {
      toast.error("Failed to set account type.", { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-xl" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Choose Your Account Type</DialogTitle>
          <DialogDescription>
            Select the type of account that best suits your needs. You can change this later in settings.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="accountType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    >
                      <FormItem>
                        <Label htmlFor="personal" className="[&:has([data-state=checked])>div]:border-primary">
                          <RadioGroupItem value="personal" id="personal" className="sr-only" />
                          <Card className="p-4 cursor-pointer hover:border-primary/50 transition-colors">
                            <CardContent className="p-0 space-y-3">
                               <div className="flex items-center gap-2">
                                <User className="size-6 text-primary" />
                                <h3 className="text-lg font-semibold">Personal</h3>
                               </div>
                               <p className="text-sm text-muted-foreground">For everyday expense tracking and splitting bills with friends.</p>
                            </CardContent>
                          </Card>
                        </Label>
                      </FormItem>
                      <FormItem>
                        <Label htmlFor="business" className="[&:has([data-state=checked])>div]:border-primary">
                          <RadioGroupItem value="business" id="business" className="sr-only" />
                          <Card className="p-4 cursor-pointer hover:border-primary/50 transition-colors">
                            <CardContent className="p-0 space-y-3">
                                <div className="flex items-center gap-2">
                                 <Briefcase className="size-6 text-primary" />
                                 <h3 className="text-lg font-semibold">Business</h3>
                               </div>
                               <p className="text-sm font-bold text-foreground">Includes all personal features, plus:</p>
                               <ul className="text-xs text-muted-foreground space-y-1.5 pl-2">
                                    <li className="flex items-center gap-2"><Package className="size-4 shrink-0"/> Product & Inventory Management</li>
                                    <li className="flex items-center gap-2"><History className="size-4 shrink-0"/> Sales History & Invoicing</li>
                                    <li className="flex items-center gap-2"><IndianRupee className="size-4 shrink-0"/> Customer Debt Tracking</li>
                               </ul>
                            </CardContent>
                          </Card>
                        </Label>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
