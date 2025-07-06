
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CalendarIcon, Loader2, Lightbulb, Users, User, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
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
import { addTransaction, updateTransaction, addSplitTransaction } from "@/services/transactionService";
import { addRecurringExpense } from "@/services/recurringExpenseService";
import { suggestCategory } from "@/ai/flows/suggest-category";
import { Switch } from "./ui/switch";
import type { Transaction, Circle, UserProfile, SplitDetails, SplitMember } from "@/lib/data";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Checkbox } from "./ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

const formSchema = z.object({
  description: z.string().min(3, { message: "Description must be at least 3 characters." }),
  amount: z.coerce.number().positive({ message: "Amount must be positive." }),
  category: z.string().min(1, { message: "Please select a category." }),
  date: z.date(),
  isRecurring: z.boolean().default(false),
  isSplit: z.boolean().default(false),
  splitTarget: z.string().optional(), // 'friend-[uid]' or 'circle-[id]'
  splitMembers: z.array(z.string()).optional(), // array of uids
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
  const { categories, friends, circles } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const isEditing = !!transactionToEdit;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "", amount: 0, category: "", date: new Date(), isRecurring: false, isSplit: false,
    },
  });

  const { watch, setValue } = form;
  const isSplit = watch('isSplit');
  const amount = watch('amount');
  const splitTarget = watch('splitTarget');

  const selectedCircle = useMemo(() => {
    if (splitTarget?.startsWith('circle-')) {
      return circles.find(c => c.id === splitTarget.replace('circle-', ''));
    }
    return null;
  }, [splitTarget, circles]);

  const selectedFriend = useMemo(() => {
    if (splitTarget?.startsWith('friend-')) {
      return friends.find(f => f.uid === splitTarget.replace('friend-', ''));
    }
    return null;
  }, [splitTarget, friends]);
  
  const potentialSplitMembers: UserProfile[] = useMemo(() => {
    if (selectedCircle) return Object.values(selectedCircle.members);
    if (selectedFriend && user) return [
        { uid: user.uid, displayName: user.displayName || 'You', email: user.email || '' }, 
        selectedFriend
    ];
    return [];
  }, [selectedCircle, selectedFriend, user]);
  
  useEffect(() => {
    // Auto-select all members when a circle is chosen
    if (selectedCircle) {
      setValue('splitMembers', Object.keys(selectedCircle.members));
    }
    // Auto-select both users when a friend is chosen
    else if (selectedFriend && user) {
       setValue('splitMembers', [user.uid, selectedFriend.uid]);
    } else {
       setValue('splitMembers', []);
    }
  }, [selectedCircle, selectedFriend, user, setValue]);

  useEffect(() => {
    if (open) {
      if (isEditing) {
        form.reset({
          description: transactionToEdit.description, amount: transactionToEdit.amount, category: transactionToEdit.category, date: transactionToEdit.date, isRecurring: !!transactionToEdit.recurringExpenseId, isSplit: transactionToEdit.isSplit,
        });
      } else {
        form.reset({
          description: "", amount: 0, category: "", date: defaultDate || new Date(), isRecurring: false, isSplit: false, splitMembers: [], splitTarget: undefined,
        });
      }
    }
  }, [open, isEditing, transactionToEdit, defaultDate, form]);

  const handleSuggestCategory = async () => { /* ... */ };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !user.displayName) return;
    setIsSubmitting(true);
    try {
      if (isEditing) {
        // Editing split expenses is complex and deferred for a future update.
        await updateTransaction(transactionToEdit.id!, {
          description: values.description, amount: values.amount, category: values.category, date: values.date,
        });
        toast.success("Expense updated successfully!");
      } else if (values.isSplit) {
        const totalAmount = values.amount;
        const membersToSplit = potentialSplitMembers.filter(m => values.splitMembers?.includes(m.uid));
        
        if (membersToSplit.length === 0) {
            toast.error("You must select at least one person to split with.");
            setIsSubmitting(false);
            return;
        }

        const share = totalAmount / membersToSplit.length;
        const splitDetails: SplitDetails = {
            type: 'equally',
            total: totalAmount,
            members: membersToSplit.map(member => ({
                ...member,
                share: share,
                isPayer: member.uid === user.uid
            }))
        };
        
        // Ensure the current user is a payer and in the split
        if (!splitDetails.members.some(m => m.uid === user.uid)) {
            toast.error("You (the payer) must be included in the split.");
            setIsSubmitting(false);
            return;
        }
        
        await addSplitTransaction({
          userId: user.uid, description: values.description, amount: values.amount, category: values.category, date: values.date, circleId: selectedCircle?.id || null
        }, splitDetails);
        toast.success("Split expense added successfully!");

      } else { // Regular or recurring expense
        let recurringId: string | undefined = undefined;
        if (values.isRecurring) { /* ... */ }
        await addTransaction({
          userId: user.uid, description: values.description, amount: values.amount, category: values.category, date: values.date, recurringExpenseId: recurringId
        });
        toast.success("Expense added successfully!");
      }
      onExpenseAdded();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Failed to ${isEditing ? 'update' : 'add'} expense.`, { description: error.message });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedSplitMembersCount = watch('splitMembers')?.length || 0;
  const individualShare = amount > 0 && selectedSplitMembersCount > 0 ? (amount / selectedSplitMembersCount).toFixed(2) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Expense" : "Add New Expense"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the details of your expense below." : "Enter details for your expense. You can also split bills with friends or circles."}
          </DialogDescription>
        </DialogHeader>
        {isEditing && transactionToEdit.isSplit && (
            <Alert variant="destructive">
                <AlertTitle>Editing Split Bills</AlertTitle>
                <AlertDescription>Editing expenses that have been split is not yet supported.</AlertDescription>
            </Alert>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="description" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="e.g. Lunch with colleagues" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField name="amount" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Amount (₹)</FormLabel><FormControl><Input type="number" placeholder="e.g. 500" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField name="category" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Category</FormLabel><div className="flex items-center gap-2"><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl><SelectContent>{categories?.map((cat) => ( <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem> ))}</SelectContent></Select><Button type="button" variant="outline" size="icon" onClick={handleSuggestCategory} disabled={isSuggesting}>{isSuggesting ? <Loader2 className="animate-spin" /> : <Lightbulb />}<span className="sr-only">Suggest Category</span></Button></div><FormMessage /></FormItem> )} />
            <FormField name="date" control={form.control} render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn( "w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground" )}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
            
            {!isEditing && (
              <div className="space-y-4">
                <FormField control={form.control} name="isRecurring" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Recurring Expense</FormLabel><p className="text-xs text-muted-foreground">Repeats monthly on the selected day.</p></div><FormControl><Switch checked={field.value} onCheckedChange={(val) => { field.onChange(val); if(val) setValue('isSplit', false); }} disabled={isEditing || isSplit}/></FormControl></FormItem>)} />
                <FormField control={form.control} name="isSplit" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Split Expense</FormLabel><p className="text-xs text-muted-foreground">Split this bill with others.</p></div><FormControl><Switch checked={field.value} onCheckedChange={(val) => { field.onChange(val); if(val) setValue('isRecurring', false); }} disabled={isEditing} /></FormControl></FormItem>)} />
              </div>
            )}

            {isSplit && !isEditing && (
                <Collapsible open={isSplit} className="space-y-4 rounded-lg border p-4">
                    <CollapsibleTrigger className="flex w-full justify-between items-center font-semibold"><span>Split Options</span> <ChevronDown className="transition-transform"/> </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4">
                        <FormField control={form.control} name="splitTarget" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Split with</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a friend or circle..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="friend" disabled>Friends</SelectItem>
                                        {friends.map(f => <SelectItem key={f.uid} value={`friend-${f.uid}`}>{f.displayName}</SelectItem>)}
                                        <SelectItem value="circle" disabled>Circles</SelectItem>
                                        {circles.map(c => <SelectItem key={c.id} value={`circle-${c.id}`}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage/>
                            </FormItem>
                        )}/>

                        {potentialSplitMembers.length > 0 && (
                            <div className="space-y-2">
                                <FormLabel>Participants ({selectedSplitMembersCount})</FormLabel>
                                <div className="max-h-40 overflow-y-auto space-y-2 rounded-md border p-2">
                                    {potentialSplitMembers.map(item => (
                                        <FormField key={item.uid} control={form.control} name="splitMembers" render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                                <FormControl>
                                                    <Checkbox 
                                                        checked={field.value?.includes(item.uid)}
                                                        onCheckedChange={(checked) => {
                                                            return checked
                                                                ? field.onChange([...(field.value || []), item.uid])
                                                                : field.onChange(field.value?.filter(value => value !== item.uid))
                                                        }}
                                                        disabled={item.uid === user?.uid}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal flex items-center gap-2">
                                                    <Avatar className="h-6 w-6"><AvatarImage src={item.photoURL} /><AvatarFallback>{item.displayName.charAt(0)}</AvatarFallback></Avatar>
                                                    {item.displayName} {item.uid === user?.uid && '(You, Payer)'}
                                                </FormLabel>
                                            </FormItem>
                                        )} />
                                    ))}
                                </div>
                                {amount > 0 && (
                                     <p className="text-sm text-muted-foreground">Each person owes: <span className="font-bold text-foreground">₹{individualShare}</span></p>
                                )}
                            </div>
                        )}
                    </CollapsibleContent>
                </Collapsible>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting || (isEditing && transactionToEdit.isSplit)}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Expense'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
