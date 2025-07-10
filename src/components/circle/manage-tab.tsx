
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import type { Circle, UserProfile } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { UserPlus, LogOut, Edit, ShieldAlert } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { leaveCircle } from '@/services/circleService';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { AddMemberDialog } from '../add-member-dialog';
import { EditCircleDialog } from './edit-circle-dialog';

interface ManageTabProps {
    circle: Circle;
    isOwner: boolean;
}

export function ManageTab({ circle, isOwner }: ManageTabProps) {
    const { user } = useAuth();
    const router = useRouter();
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [isEditCircleOpen, setIsEditCircleOpen] = useState(false);

    const handleLeaveCircle = async () => {
        if (!user) return;
        try {
            await leaveCircle(circle.id, user.uid);
            toast.success(`You have left the circle "${circle.name}".`);
            router.push('/spend-circle');
        } catch (error: any) {
            toast.error("Failed to leave circle.", { description: error.message });
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Circle Members</CardTitle>
                    <CardDescription>All members currently in this circle.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {Object.values(circle.members).map(member => (
                        <div key={member.uid} className="flex items-center justify-between p-2">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={member.photoURL || undefined} />
                                    <AvatarFallback>{member.displayName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium">{member.displayName}</p>
                                    <p className="text-xs text-muted-foreground">{member.email}</p>
                                </div>
                            </div>
                            {member.uid === circle.ownerId && <Badge variant="secondary">Owner</Badge>}
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Circle Actions</CardTitle>
                        <CardDescription>Manage your circle settings and members.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {isOwner && (
                            <>
                                <Button className="w-full justify-start" onClick={() => setIsAddMemberOpen(true)}>
                                    <UserPlus className="mr-2" /> Add Members
                                </Button>
                                <Button className="w-full justify-start" variant="outline" onClick={() => setIsEditCircleOpen(true)}>
                                    <Edit className="mr-2" /> Edit Circle Details
                                </Button>
                            </>
                        )}
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="w-full justify-start"><LogOut className="mr-2"/>Leave Circle</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Leave "{circle.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        You will be removed from this circle. If you are the last member, the circle will be deleted. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleLeaveCircle}>Confirm & Leave</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
            </div>
            {isAddMemberOpen && (
                <AddMemberDialog
                    open={isAddMemberOpen}
                    onOpenChange={setIsAddMemberOpen}
                    circle={circle}
                />
            )}
            {isEditCircleOpen && (
                <EditCircleDialog
                    open={isEditCircleOpen}
                    onOpenChange={setIsEditCircleOpen}
                    circle={circle}
                />
            )}
        </div>
    );
}
