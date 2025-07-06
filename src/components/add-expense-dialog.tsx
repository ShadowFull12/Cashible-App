
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CalendarIcon, Loader2, Lightbulb, ChevronDown, Info, AlertTriangle } from "lucide-react";
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
import { createExpenseClaim } from "@/services/expenseClaimService";
import { suggestCategory } from "@/ai/flows/suggest-category";
import { Switch } from "./ui/switch";
import type { Transaction, UserProfile, SplitDetails, SplitType } from "@/lib/data";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Checkbox } from "./ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";


const formSchema = z.object({
  description: z.string().min(3, { message: "Description must be at least 3 characters." }),
  amount: z.coerce.number().positive({ message: "Amount must be positive." }),
  category: z.string().min(1, { message: "Please select a category." }),
  date: z.date(),
  isRecurring: z.boolean().default(false),
  isSplit: z.boolean().default(false),
  splitTarget: z.string().optional(),
  splitMembers: z.array(z.string()).optional(),
  payerId: z.string().optional(),
});

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpenseAdded: () => void;
  defaultDate?: Date | null;
  defaultCircleId?: string | null;
  transactionToEdit?: Transaction | null;
}

export function AddExpenseDialog({ open, onOpenChange, onExpenseAdded, defaultDate, defaultCircleId, transactionToEdit }: AddExpenseDialogProps) {
  const { user } = useAuth();
  const { categories, friends, circles } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [splitMethod, setSplitMethod] = useState<SplitType>('equally');
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const isEditing = !!transactionToEdit;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "", amount: 0, category: "", date: new Date(), isRecurring: false, isSplit: false, payerId: user?.uid || "",
    },
  });

  const { watch, setValue, control } = form;
  const isSplit = watch('isSplit');
  const amount = watch('amount');
  const splitTarget = watch('splitTarget');
  const payerId = watch('payerId');
  
  const potentialSplitMembers: UserProfile[] = useMemo(() => {
    if (splitTarget?.startsWith('circle-')) {
      const circle = circles.find(c => c.id === splitTarget.replace('circle-', ''));
      return circle ? Object.values(circle.members) : [];
    }
    return [];
  }, [splitTarget, circles]);

  const selectedCircle = useMemo(() => {
    if (splitTarget?.startsWith('circle-')) {
      return circles.find(c => c.id === splitTarget.replace('circle-', ''));
    }
    return null;
  }, [splitTarget, circles]);

  useEffect(() => {
    if (potentialSplitMembers.length > 0) {
      setValue('splitMembers', potentialSplitMembers.map(m => m.uid));
    } else {
       setValue('splitMembers', []);
    }
    if(user) setValue('payerId', user.uid);
  }, [potentialSplitMembers, setValue, user]);

  useEffect(() => {
    if (open) {
      if (isEditing && transactionToEdit) {
        form.reset({
          description: transactionToEdit.description, amount: transactionToEdit.amount, category: transactionToEdit.category, date: transactionToEdit.date, isRecurring: !!transactionToEdit.recurringExpenseId, isSplit: transactionToEdit.isSplit,
        });
      } else if (defaultCircleId) {
        form.reset({
            description: "", amount: 0, category: "", date: defaultDate || new Date(),
            isRecurring: false, isSplit: true, splitTarget: `circle-${defaultCircleId}`,
            splitMembers: [], payerId: user?.uid
        });
      } else {
        form.reset({
          description: "", amount: 0, category: "", date: defaultDate || new Date(), isRecurring: false, isSplit: false, splitMembers: [], splitTarget: undefined, payerId: user?.uid
        });
      }
      setSplitMethod('equally');
      setCustomShares({});
    }
  }, [open, isEditing, transactionToEdit, defaultDate, form, user, defaultCircleId]);

  const handleSuggestCategory = async () => { /* ... */ };
  
  const handleShareChange = (uid: string, value: string) => {
    setCustomShares(prev => ({...prev, [uid]: value}));
  };

  const totalCustomShare = useMemo(() => {
      return Object.values(customShares).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [customShares]);

  const isCustomSplitInvalid = splitMethod === 'unequally' && Math.abs(totalCustomShare - amount) > 0.01 && potentialSplitMembers.length > 0;


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !user.displayName || !user.email) return;
    setIsSubmitting(true);
    try {
      if (isEditing && transactionToEdit) {
        await updateTransaction(transactionToEdit.id!, {
          description: values.description, amount: values.amount, category: values.category, date: values.date,
        });
        toast.success("Expense updated successfully!");
      } else if (values.isSplit) {
        const membersToSplitWith = potentialSplitMembers.filter(m => values.splitMembers?.includes(m.uid));
        
        if (membersToSplitWith.length === 0 || !values.splitMembers) {
            toast.error("You must select at least one person to split with."); setIsSubmitting(false); return;
        }
        if (!values.payerId) {
            toast.error("You must select who paid for this expense."); setIsSubmitting(false); return;
        }
        if (!values.splitMembers.includes(values.payerId)) {
            toast.error("The payer must be included in the split participants."); setIsSubmitting(false); return;
        }
        
        const payerProfile = potentialSplitMembers.find(m => m.uid === values.payerId);
        if (!payerProfile) {
            toast.error("Payer could not be found."); setIsSubmitting(false); return;
        }

        let splitDetails: SplitDetails;

        if (splitMethod === 'unequally') {
            const finalCustomShares = potentialSplitMembers.reduce((acc, member) => {
                if (values.splitMembers?.includes(member.uid)) {
                   acc[member.uid] = Number(customShares[member.uid]) || 0;
                }
                return acc;
            }, {} as Record<string, number>);

            const totalSum = Object.values(finalCustomShares).reduce((sum, val) => sum + val, 0);

            if (Math.abs(totalSum - values.amount) > 0.01) {
                toast.error("The sum of custom shares must equal the total amount."); setIsSubmitting(false); return;
            }

            splitDetails = {
                type: 'unequally',
                total: values.amount,
                payerId: values.payerId,
                members: membersToSplitWith.map(member => ({...member, share: finalCustomShares[member.uid] || 0}))
            };
        } else {
             const share = values.amount / membersToSplitWith.length;
             splitDetails = {
                type: 'equally',
                total: values.amount,
                payerId: values.payerId,
                members: membersToSplitWith.map(member => ({...member, share}))
            };
        }
        
        const transactionPayload = {
             userId: user.uid, description: values.description, amount: values.amount, category: values.category, date: values.date, circleId: selectedCircle?.id || null, recurringExpenseId: null
        };

        if (values.payerId !== user.uid) {
            const currentUserProfile: UserProfile = { uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL || null };
            await createExpenseClaim({
                claimerProfile: currentUserProfile,
                payerId: values.payerId,
                expenseDetails: { ...transactionPayload, splitDetails }
            });
            toast.success(`Expense claim sent to ${payerProfile.displayName} for approval.`);
        } else {
             await addSplitTransaction(transactionPayload, splitDetails);
             toast.success("Split expense recorded successfully!");
        }

      } else { 
        let recurringId: string | undefined = undefined;
        if (values.isRecurring) { /* ... */ }
        await addTransaction({
          userId: user.uid, description: values.description, amount: values.amount, category: values.category, date: values.date, recurringExpenseId: recurringId, isSplit: false, splitDetails: null, circleId: null
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
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Expense" : "Add New Expense"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the details of your expense below." : "Enter details for your expense. You can also split bills with circles."}
          </DialogDescription>
        </DialogHeader>
        {isEditing && transactionToEdit?.isSplit && (
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
                    <CollapsibleContent className="space-y-4 pt-4">
                        {payerId !== user?.uid && (
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>Request for Approval</AlertTitle>
                                <AlertDescription>
                                    Since you didn't pay, a request will be sent to the payer to approve and log this expense. Debts will be created after their approval.
                                </AlertDescription>
                            </Alert>
                        )}
                        <FormField control={form.control} name="splitTarget" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Split with Circle</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a circle..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {circles.map(c => <SelectItem key={c.id} value={`circle-${c.id}`}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage/>
                            </FormItem>
                        )}/>

                        {potentialSplitMembers.length > 0 && (
                          <>
                            <FormField control={control} name="payerId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Who paid?</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select who paid..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {potentialSplitMembers.map(member => (
                                                <SelectItem key={member.uid} value={member.uid}>
                                                    {member.displayName} {member.uid === user?.uid ? '(You)' : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            
                            <FormItem>
                                <FormLabel>Split Method</FormLabel>
                                <RadioGroup value={splitMethod} onValueChange={(v: "equally" | "unequally") => setSplitMethod(v)} className="flex items-center gap-4">
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="equally" id="equally" /><Label htmlFor="equally">Equally</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="unequally" id="unequally" /><Label htmlFor="unequally">Unequally</Label></div>
                                </RadioGroup>
                            </FormItem>

                            {splitMethod === 'equally' ? (
                                <div className="space-y-2">
                                    <FormLabel>Participants ({selectedSplitMembersCount})</FormLabel>
                                    <div className="max-h-40 overflow-y-auto space-y-2 rounded-md border p-2">
                                        {potentialSplitMembers.map(item => (
                                            <FormField key={item.uid} control={form.control} name="splitMembers" render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                                    <FormControl><Checkbox checked={field.value?.includes(item.uid)} onCheckedChange={(checked) => {return checked ? field.onChange([...(field.value || []), item.uid]) : field.onChange(field.value?.filter(value => value !== item.uid))}}/></FormControl>
                                                    <FormLabel className="font-normal flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={item.photoURL || undefined} /><AvatarFallback>{item.displayName.charAt(0)}</AvatarFallback></Avatar>{item.displayName} {item.uid === user?.uid && '(You)'}</FormLabel>
                                                </FormItem>
                                            )} />
                                        ))}
                                    </div>
                                    {amount > 0 && ( <p className="text-sm text-muted-foreground">Each person owes: <span className="font-bold text-foreground">₹{individualShare}</span></p>)}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <FormLabel>Enter Shares</FormLabel>
                                    <div className="max-h-48 overflow-y-auto space-y-3 rounded-md border p-2">
                                        {potentialSplitMembers.map(member => (
                                            <div key={member.uid} className="flex items-center gap-3">
                                                <Label htmlFor={`share-${member.uid}`} className="flex-1 flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={member.photoURL || undefined} /><AvatarFallback>{member.displayName.charAt(0)}</AvatarFallback></Avatar>{member.displayName}</Label>
                                                <Input id={`share-${member.uid}`} type="number" placeholder="0.00" className="w-28" value={customShares[member.uid] || ''} onChange={(e) => handleShareChange(member.uid, e.target.value)} />
                                            </div>
                                        ))}
                                    </div>
                                    <div className={cn("text-sm p-2 rounded-md", isCustomSplitInvalid ? "bg-destructive/10 text-destructive" : "bg-muted/70 text-muted-foreground")}>
                                        <div className="flex justify-between font-medium">
                                            <span>Total of shares:</span><span>₹{totalCustomShare.toFixed(2)}</span>
                                        </div>
                                        {isCustomSplitInvalid && <div className="flex justify-between text-xs mt-1"><span>Remaining:</span><span>₹{(amount - totalCustomShare).toFixed(2)}</span></div>}
                                    </div>
                                </div>
                            )}
                           </>
                        )}
                    </CollapsibleContent>
                </Collapsible>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting || (isEditing && !!transactionToEdit?.isSplit) || isCustomSplitInvalid}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCustomSplitInvalid ? 'Shares must equal total' : isEditing ? 'Save Changes' : 'Add Expense'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
