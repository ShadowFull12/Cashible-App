
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { CalendarIcon, Loader2, Plus, X, RotateCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useData } from "@/hooks/use-data";
import { addProduct } from "@/services/productService";
import { addSaleTransaction } from "@/services/transactionService";
import type { Customer, Product } from "@/lib/data";

const saleItemSchema = z.object({
  productId: z.string(), 
  name: z.string().min(1, "Product name is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  price: z.coerce.number().min(0, "Price cannot be negative"),
});

const formSchema = z.object({
  items: z.array(saleItemSchema).min(1, "At least one item is required."),
  date: z.date(),
  finalAmount: z.coerce.number().positive("Final amount must be positive."),
  notes: z.string().optional(),
  customerName: z.string().optional(),
  paymentStatus: z.enum(["paid", "partial", "unpaid"]).default("paid"),
  amountPaid: z.coerce.number().optional(),
});

interface AddSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaleAdded: () => void;
}

export function AddSaleDialog({ open, onOpenChange, onSaleAdded }: AddSaleDialogProps) {
  const { user } = useAuth();
  const { products, customers, refreshData } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState<Record<number, string>>({});
  const [activeProductSearchIndex, setActiveProductSearchIndex] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [activeCustomerSearch, setActiveCustomerSearch] = useState(false);
  const [subtotal, setSubtotal] = useState(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      items: [{ productId: "", name: "", quantity: 1, price: 0 }],
      date: new Date(),
      finalAmount: 0,
      paymentStatus: "paid",
      amountPaid: 0,
    },
  });

  const { control, watch, setValue, reset, trigger } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  
  const saleItems = watch("items");
  const paymentStatus = watch("paymentStatus");
  const finalAmount = watch("finalAmount");

  useEffect(() => {
    const calculatedTotal = saleItems.reduce((total, item) => total + (item.quantity || 0) * (item.price || 0), 0);
    setSubtotal(calculatedTotal);
  }, [saleItems]);
  
  useEffect(() => {
    setValue("finalAmount", subtotal, { shouldValidate: true });
  }, [subtotal, setValue]);

  useEffect(() => {
    if (paymentStatus === 'paid') {
      setValue("amountPaid", finalAmount, { shouldValidate: true });
      setValue("customerName", "", { shouldValidate: true });
      setCustomerSearch("");
    } else if (paymentStatus === 'unpaid') {
      setValue("amountPaid", 0, { shouldValidate: true });
    } else if (paymentStatus === 'partial') {
       setValue("amountPaid", undefined, { shouldValidate: true });
    }
  }, [paymentStatus, finalAmount, setValue]);

  useEffect(() => {
    if (open) {
      reset({
        items: [{ productId: "", name: "", quantity: 1, price: 0 }],
        date: new Date(),
        finalAmount: 0,
        paymentStatus: "paid",
        amountPaid: 0,
        notes: "",
        customerName: ""
      });
      setProductSearch({});
      setCustomerSearch("");
      setActiveProductSearchIndex(null);
      setActiveCustomerSearch(false);
    }
  }, [open, reset]);

  const filteredProducts = (index: number) => {
    const query = productSearch[index]?.toLowerCase() || "";
    if (!query) return [];
    return products.filter(p => p.name.toLowerCase().includes(query));
  };
  
  const handleProductSelect = (index: number, product: Product) => {
    setValue(`items.${index}.productId`, product.id!, { shouldValidate: true });
    setValue(`items.${index}.name`, product.name, { shouldValidate: true });
    setValue(`items.${index}.price`, product.price, { shouldValidate: true });
    setProductSearch(prev => ({ ...prev, [index]: product.name }));
    setActiveProductSearchIndex(null);
    trigger('items');
  };

  const handleProductSearchChange = (index: number, value: string) => {
    setProductSearch(prev => ({ ...prev, [index]: value }));
    setValue(`items.${index}.name`, value, { shouldValidate: true });
    setValue(`items.${index}.productId`, 'new', { shouldValidate: true });
    if(value) {
      setActiveProductSearchIndex(index);
    } else {
      setActiveProductSearchIndex(null);
    }
  };

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.toLowerCase();
    if (!query) return [];
    return customers.filter(c => c.name.toLowerCase().includes(query));
  }, [customerSearch, customers]);

  const handleCustomerSelect = (customer: Customer) => {
    setValue("customerName", customer.name, { shouldValidate: true });
    setCustomerSearch(customer.name);
    setActiveCustomerSearch(false);
  }

  const handleCustomerSearchChange = (value: string) => {
    setCustomerSearch(value);
    setValue("customerName", value, { shouldValidate: true });
    setActiveCustomerSearch(!!value);
  }

  const handleRecalculate = () => {
    const newTotal = saleItems.reduce((total, item) => total + (item.quantity || 0) * (item.price || 0), 0);
    setSubtotal(newTotal);
    setValue("finalAmount", newTotal, { shouldValidate: true });
    toast.success("Total recalculated!");
  }


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) return;

    if ((values.paymentStatus === 'partial' || values.paymentStatus === 'unpaid') && !values.customerName?.trim()) {
        toast.error("Customer name is required for unpaid or partial sales.");
        return;
    }

    setIsSubmitting(true);
    try {
        const newProductsToCreate = values.items.filter(item => 
            !products.some(p => p.name.toLowerCase() === item.name.toLowerCase())
        );
        
        if (newProductsToCreate.length > 0) {
            for (const item of newProductsToCreate) {
                await addProduct({ userId: user.uid, name: item.name, price: item.price });
            }
            await refreshData(); 
        }
        
        await addSaleTransaction({
            userId: user.uid,
            items: values.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
            totalAmount: values.finalAmount,
            date: values.date,
            customerName: values.customerName,
            paymentStatus: values.paymentStatus,
            amountPaid: values.amountPaid || 0,
            notes: values.notes,
        });
        
        toast.success("Sale recorded successfully!");
        onSaleAdded();

    } catch (error: any) {
        toast.error("Failed to record sale", { description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Record a New Sale</DialogTitle>
          <DialogDescription>
            Add items to create a bill. New products will be saved automatically.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex flex-col sm:flex-row items-start gap-2 p-3 border rounded-lg relative">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-2">
                    <div className="relative">
                      <FormItem>
                         <FormLabel className="sr-only">Product</FormLabel>
                         <FormControl>
                            <Input 
                              placeholder="Type product name..."
                              value={productSearch[index] || ""}
                              onChange={(e) => handleProductSearchChange(index, e.target.value)}
                              onFocus={() => setActiveProductSearchIndex(index)}
                              onBlur={() => setTimeout(() => setActiveProductSearchIndex(null), 150)}
                            />
                         </FormControl>
                      </FormItem>
                      {activeProductSearchIndex === index && filteredProducts(index).length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
                              {filteredProducts(index).map(p => (
                                  <div 
                                      key={p.id}
                                      className="p-2 hover:bg-muted cursor-pointer"
                                      onClick={() => handleProductSelect(index, p)}
                                  >
                                      <p className="font-medium">{p.name}</p>
                                      <p className="text-xs text-muted-foreground">₹{p.price.toFixed(2)}</p>
                                  </div>
                              ))}
                          </div>
                      )}
                    </div>
                     <FormField control={control} name={`items.${index}.quantity`} render={({ field }) => (
                         <FormItem><FormLabel className="sr-only">Qty</FormLabel><FormControl><Input type="number" placeholder="Qty" {...field} /></FormControl><FormMessage/></FormItem>
                     )} />
                     <FormField control={control} name={`items.${index}.price`} render={({ field }) => (
                         <FormItem><FormLabel className="sr-only">Price</FormLabel><FormControl><Input type="number" placeholder="Price" {...field} /></FormControl><FormMessage/></FormItem>
                     )} />
                  </div>
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="sm:absolute sm:-top-2 sm:-right-2 h-7 w-7" onClick={() => remove(index)}>
                        <X className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => append({ productId: "new", name: "", quantity: 1, price: 0 })} className="w-full">
                <Plus className="mr-2" /> Add Item
              </Button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex justify-between text-sm"><span>Subtotal:</span><span>₹{subtotal.toFixed(2)}</span></div>
                     <FormField control={control} name="finalAmount" render={({ field }) => (
                         <FormItem className="flex items-center justify-between">
                            <FormLabel className="font-bold">Final Total:</FormLabel>
                            <div className="flex items-center gap-1">
                              <FormControl><Input className="w-28 text-right font-bold" type="number" {...field} /></FormControl>
                              <Button type="button" variant="ghost" size="icon" onClick={handleRecalculate}><RotateCw className="size-4"/></Button>
                            </div>
                         </FormItem>
                     )} />
                </div>
                 <FormField name="date" control={control} render={({ field }) => (
                    <FormItem className="flex flex-col justify-center">
                        <FormLabel>Sale Date</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild><FormControl><Button variant="outline" className={cn(!field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent>
                        </Popover>
                    </FormItem>
                 )} />
              </div>

               <div className="p-4 border rounded-lg space-y-4">
                    <FormField control={control} name="paymentStatus" render={({ field }) => (
                        <FormItem><FormLabel>Payment Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="paid">Paid in Full</SelectItem>
                                <SelectItem value="partial">Partially Paid</SelectItem>
                                <SelectItem value="unpaid">Unpaid</SelectItem>
                            </SelectContent>
                        </Select>
                        </FormItem>
                    )} />

                    {(paymentStatus === 'partial' || paymentStatus === 'unpaid') && (
                         <div className="relative">
                            <FormItem>
                                <FormLabel>Customer Name</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="Enter customer name to track debt"
                                    value={customerSearch}
                                    onChange={e => handleCustomerSearchChange(e.target.value)}
                                    onFocus={() => setActiveCustomerSearch(true)}
                                    onBlur={() => setTimeout(() => setActiveCustomerSearch(false), 150)}
                                  />
                                </FormControl>
                            </FormItem>
                             {activeCustomerSearch && filteredCustomers.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
                                    {filteredCustomers.map(c => (
                                        <div 
                                            key={c.id}
                                            className="p-2 hover:bg-muted cursor-pointer"
                                            onClick={() => handleCustomerSelect(c)}
                                        >
                                            <p className="font-medium">{c.name}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                         </div>
                    )}
                    {paymentStatus === 'partial' && (
                         <FormField control={control} name="amountPaid" render={({ field }) => (
                             <FormItem><FormLabel>Amount Paid</FormLabel><FormControl><Input type="number" placeholder="e.g. 500" {...field} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem>
                         )} />
                    )}
               </div>

                <FormField control={control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="e.g. Discount applied, special requests." {...field} /></FormControl></FormItem>
                )}/>
            </div>
            
            <div className="border-t pt-4">
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Sale
                </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
