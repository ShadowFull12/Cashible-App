
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useData } from '@/hooks/use-data';
import { useAuth } from '@/hooks/use-auth';
import { addMembersToCircle } from '@/services/circleService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import type { Circle, UserProfile } from '@/lib/data';

const formSchema = z.object({
  members: z.array(z.string()).min(1, { message: "You must select at least one friend to invite." }),
});

interface InviteToCircleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  circle: Circle;
  onInviteSent: () => void;
}

export function InviteToCircleDialog({ open, onOpenChange, circle, onInviteSent }: InviteToCircleDialogProps) {
    const { friends } = useData();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const friendsToInvite = friends.filter(f => !circle.memberIds.includes(f.uid));

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            members: [],
        }
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!user || !user.displayName || !user.email) return;
        
        setIsSubmitting(true);
        try {
            const selectedFriends = friends.filter(f => values.members.includes(f.uid));
            const inviterProfile: UserProfile = {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL
            };

            await addMembersToCircle(circle.id, selectedFriends, inviterProfile);

            toast.success(`Invited ${selectedFriends.length} friend(s) to "${circle.name}"!`);
            onInviteSent();
            onOpenChange(false);
            form.reset();
        } catch (error: any) {
            toast.error("Failed to invite friends", { description: error.message });
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
                    <DialogTitle>Invite Friends to {circle.name}</DialogTitle>
                    <DialogDescription>
                        Select friends from your list to add to this circle.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                         <FormField
                            control={form.control}
                            name="members"
                            render={() => (
                                <FormItem>
                                     <div className="mb-4">
                                        <FormLabel className="text-base">Select Friends</FormLabel>
                                    </div>
                                    <ScrollArea className="h-48 rounded-md border p-2">
                                    {friendsToInvite.length === 0 ? (
                                        <p className="text-sm text-center text-muted-foreground p-4">All your friends are already in this circle.</p>
                                    ) : (
                                        friendsToInvite.map((friend) => (
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
                                                                        <AvatarImage src={friend.photoURL} />
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
                            <DialogClose asChild>
                                <Button type="button" variant="secondary">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting || friendsToInvite.length === 0}>
                                {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                                Send Invites
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
