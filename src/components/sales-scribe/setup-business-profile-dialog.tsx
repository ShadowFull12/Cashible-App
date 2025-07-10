
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import React, { useState, useRef } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

const formSchema = z.object({
  businessName: z.string().min(2, { message: "Business name is required." }),
});

interface SetupBusinessProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileSetup: () => void;
}

export function SetupBusinessProfileDialog({ open, onOpenChange, onProfileSetup }: SetupBusinessProfileDialogProps) {
  const { updateUserProfile, uploadAndSetProfileImage } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const isImgBbConfigured = !!process.env.NEXT_PUBLIC_IMGBB_API_KEY;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      businessName: "",
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
        let logoUrl: string | null = null;
        if (logoFile && isImgBbConfigured) {
            const formData = new FormData();
            formData.append('image', logoFile);
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            const result = await response.json();
            if (!result.success) throw new Error(result.error?.message || "Upload failed");
            logoUrl = result.data.url;
        }

        await updateUserProfile({ 
            businessProfile: {
                isSetup: true,
                name: values.businessName,
                logoUrl: logoUrl,
            }
        });
        toast.success("Business profile created!");
        onProfileSetup();
        form.reset();
        onOpenChange(false);
    } catch (error: any) {
        toast.error("Failed to create profile.", { description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Setup Your Business Profile</DialogTitle>
          <DialogDescription>
            This information will be used on your invoices. You can change this later.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex flex-col items-center gap-4">
                <Avatar className="h-24 w-24">
                    <AvatarImage src={logoPreview || ''} alt="Business Logo" />
                    <AvatarFallback className="text-3xl">
                        {form.watch('businessName')?.charAt(0) || '?'}
                    </AvatarFallback>
                </Avatar>
                <Button size="sm" type="button" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={!isImgBbConfigured}>
                    <Upload className="mr-2" /> Upload Logo (Optional)
                </Button>
                <input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoChange} className="hidden" />
            </div>

            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. The Corner Store" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save and Continue
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
