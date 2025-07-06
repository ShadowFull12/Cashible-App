
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Upload } from 'lucide-react';
import type { Circle } from '@/lib/data';
import { updateCircle, uploadCircleImage } from '@/services/circleService';

const formSchema = z.object({
  name: z.string().min(3, { message: "Circle name must be at least 3 characters." }),
});

interface EditCircleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  circle: Circle;
}

export function EditCircleDialog({ open, onOpenChange, circle }: EditCircleDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(circle.photoURL || null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
     const isImgBbConfigured = !!process.env.NEXT_PUBLIC_IMGBB_API_KEY;

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: circle.name,
        }
    });

    useEffect(() => {
        if (open) {
            form.reset({ name: circle.name });
            setAvatarPreview(circle.photoURL || null);
            setAvatarFile(null);
        }
    }, [open, circle, form]);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const onSubmit = async (values: z.infer<typeof formSchema>>) => {
        setIsSubmitting(true);
        try {
            let photoURL = circle.photoURL;
            if (avatarFile) {
                photoURL = await uploadCircleImage(avatarFile);
            }
            
            await updateCircle(circle.id, { name: values.name, photoURL: photoURL || undefined });
            toast.success("Circle updated successfully!");
            onOpenChange(false);
        } catch (error: any) {
            toast.error("Failed to update circle", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Circle Details</DialogTitle>
                    <DialogDescription>
                        Change the name or photo for your circle.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="flex items-center gap-6">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src={avatarPreview || undefined} alt={circle.name} />
                                <AvatarFallback className="text-2xl">{circle.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="space-y-2">
                                <Button type="button" size="sm" onClick={() => avatarInputRef.current?.click()} disabled={!isImgBbConfigured}>
                                    <Upload className="mr-2" /> Change Photo
                                </Button>
                                <input type="file" accept="image/*" ref={avatarInputRef} onChange={handleAvatarChange} className="hidden" />
                                <p className="text-xs text-muted-foreground">Recommended size: 200x200px</p>
                            </div>
                        </div>

                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Circle Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="secondary">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
