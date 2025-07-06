"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CalendarIcon, Loader2, Lightbulb } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useData } from "@/hooks/use-data";
import { addTransaction, updateTransaction } from "@/services/transactionService";
import { addRecurringExpense } from "@/services/recurringExpenseService";
import { suggestCategory } from "@/ai/flows/suggest-category";
import { Switch } from "./ui/switch";
import type { Transaction } from "@/lib/data";

const formSchema = z.object({
  description: z.string().min(3, { message: "Description must be at least 3 characters." }),
  amount: z.coerce.number().positive({ message: "Amount must be positive." }),
  category: z.string().min(1, { message: "Please select a category." }),
  date: z.date(),
  isRecurring: z.boolean().default(false),
});

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpenseAdded: () => void;
  defaultDate?: Date | null;
  transactionToEdit?: Transaction | null;
}

export function AddExpenseDialog({ open, onOpenChange, onExpenseAdded, defaultDate, transactionToEdit }: AddExpenseDialogProps) {
  const { user } = useAuth();
  const { categories } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const isEditing = !!transactionToEdit;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: 0,
      category: "",
      date: new Date(),
      isRecurring: false,
    },
  });

  useEffect(() => {
    if (open) {
      if (isEditing) {
        form.reset({
          description: transactionToEdit.description,
          amount: transactionToEdit.amount,
          category: transactionToEdit.category,
          date: transactionToEdit.date,
          isRecurring: !!transactionToEdit.recurringExpenseId,
        });
      } else {
        form.reset({
          description: "",
          amount: 0,
          category: "",
          date: defaultDate || new Date(),
          isRecurring: false,
        });
      }
    }
  }, [open, isEditing, transactionToEdit, defaultDate, form]);

  const handleSuggestCategory = async () => {
    const description = form.getValues("description");
    if (!description) {
        toast.info("Please enter a description first.");
        return;
    }
    setIsSuggesting(true);
    try {
        const categoryNames = categories.map(c => c.name);
        const result = await suggestCategory({ description, categories: categoryNames });
        if (result.category && categoryNames.includes(result.category)) {
            form.setValue("category", result.category);
            toast.success("Category suggested!");
        } else {
            toast.info("AI couldn't suggest a suitable category from your list.");
        }
    } catch (error) {
        toast.error("Failed to get AI suggestion.");
        console.error(error);
    } finally {
        setIsSuggesting(false);
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast.error("You must be logged in to perform this action.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateTransaction(transactionToEdit.id!, {
          description: values.description,
          amount: values.amount,
          category: values.category,
          date: values.date,
        });
        toast.success("Expense updated successfully!");
      } else {
        let recurringId: string | undefined = undefined;
        if (values.isRecurring) {
          recurringId = await addRecurringExpense({
            userId: user.uid,
            description: values.description,
            amount: values.amount,
            category: values.category,
            dayOfMonth: values.date.getDate(),
            isActive: true,
            lastProcessed: new Date(),
          });
          toast.info("Recurring expense created. The first transaction has been added.");
        }

        await addTransaction({
          userId: user.uid,
          description: values.description,
          amount: values.amount,
          category: values.category,
          date: values.date,
          recurringExpenseId: recurringId
        });
        toast.success("Expense added successfully!");
      }
      
      onExpenseAdded();
      onOpenChange(false);
    } catch (error: any) {
      if (error.code === 'permission-denied' || error.message.includes('permission-denied')) {
          toast.error("Permission Denied", {
              description: "Could not perform action. Please check your Firestore security rules."
          });
      } else {
        toast.error(`Failed to ${isEditing ? 'update' : 'add'} expense. Please try again.`);
      }
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Expense" : "Add New Expense"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the details of your expense below." : "Enter the details of your expense below. Use the AI helper to suggest a category!"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expense Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g. Lunch with colleagues" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g. 500" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <div className="flex items-center gap-2">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.name} value={cat.name}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={handleSuggestCategory} disabled={isSuggesting}>
                        {isSuggesting ? <Loader2 className="animate-spin" /> : <Lightbulb />}
                        <span className="sr-only">Suggest Category</span>
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Recurring Expense</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Set this expense to repeat every month on the selected day.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isEditing}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Expense'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
