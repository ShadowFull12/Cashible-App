
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useData } from '@/hooks/use-data';
import { useAuth } from '@/hooks/use-auth';
import { createCircle } from '@/services/circleService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import type { UserProfile } from '@/lib/data';

const formSchema = z.object({
  name: z.string().min(3, { message: "Circle name must be at least 3 characters." }),
  members: z.array(z.string()), // Can be empty
});

interface CreateCircleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCircleDialog({ open, onOpenChange }: CreateCircleDialogProps) {
    const { user } = useAuth();
    const { friends, refreshData } = useData();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            members: [],
        }
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!user || !user.displayName || !user.email) return;

        setIsSubmitting(true);
        try {
            const memberProfiles = friends.filter(f => values.members.includes(f.uid));
            const currentUserProfile: UserProfile = {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL || null,
            };
            
            await createCircle({
                name: values.name,
                owner: currentUserProfile,
                members: [currentUserProfile, ...memberProfiles],
            });

            toast.success(`Circle "${values.name}" created successfully!`);
            await refreshData();
            onOpenChange(false);
            form.reset();
        } catch (error: any) {
            toast.error("Failed to create circle", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleDialogChange = (isOpen: boolean) => {
        if (!isSubmitting) {
            form.reset();
            onOpenChange(isOpen);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={handleDialogChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create a New Spend Circle</DialogTitle>
                    <DialogDescription>
                        Give your circle a name and select friends to add. They will be added to the circle immediately.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Circle Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Roommates, Trip to Goa" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="members"
                            render={() => (
                                <FormItem>
                                     <div className="mb-4">
                                        <FormLabel className="text-base">Add Friends (Optional)</FormLabel>
                                    </div>
                                    <ScrollArea className="h-48 rounded-md border p-2">
                                    {friends.length === 0 ? (
                                        <p className="text-sm text-center text-muted-foreground p-4">You need to add friends before you can add them to a circle.</p>
                                    ) : (
                                        friends.map((friend) => (
                                            <FormField
                                                key={friend.uid}
                                                control={form.control}
                                                name="members"
                                                render={({ field }) => {
                                                    return (
                                                        <FormItem
                                                            key={friend.uid}
                                                            className="flex flex-row items-center space-x-3 space-y-0 p-2 rounded-md hover:bg-muted/50"
                                                        >
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.includes(friend.uid)}
                                                                    onCheckedChange={(checked) => {
                                                                        return checked
                                                                            ? field.onChange([...(field.value || []), friend.uid])
                                                                            : field.onChange(
                                                                                field.value?.filter(
                                                                                    (value) => value !== friend.uid
                                                                                )
                                                                            )
                                                                    }}
                                                                />
                                                            </FormControl>
                                                             <FormLabel className="font-normal w-full cursor-pointer">
                                                                <div className="flex items-center gap-3">
                                                                     <Avatar className="h-8 w-8">
                                                                        <AvatarImage src={friend.photoURL || null} />
                                                                        <AvatarFallback>{friend.displayName.charAt(0)}</AvatarFallback>
                                                                    </Avatar>
                                                                    <div>
                                                                        <p className="font-medium">{friend.displayName}</p>
                                                                        <p className="text-xs text-muted-foreground">{friend.email}</p>
                                                                    </div>
                                                                </div>
                                                            </FormLabel>
                                                        </FormItem>
                                                    )
                                                }}
                                            />
                                        ))
                                    )}
                                    </ScrollArea>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                                Create Circle
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
