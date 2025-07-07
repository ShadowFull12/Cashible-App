
"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import type { Circle, ChatMessage, UserProfile } from '@/lib/data';
import { getChatMessagesListener, sendChatMessage, updateUserLastReadTimestamp, deleteMessageForEveryone, deleteMessageForMe } from '@/services/chatService';
import { uploadCircleMedia } from '@/services/circleService';
import { format } from 'date-fns';
import { Paperclip, Send, Loader2, CornerDownLeft, Trash, X, MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ImagePreviewDialog } from './image-preview-dialog';
import { QuotedMessage } from './quoted-message';


interface ChatTabProps {
    circle: Circle;
}

export function ChatTab({ circle }: ChatTabProps) {
    const { user, userData } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [uploadingFile, setUploadingFile] = useState<File | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!circle.id || !user) return;
        const unsubscribe = getChatMessagesListener(circle.id, user.uid, setMessages);
        return () => unsubscribe();
    }, [circle.id, user]);

    useEffect(() => {
        if (!user || !circle.id) return;
        updateUserLastReadTimestamp(circle.id, user.uid);
    }, [circle.id, user, messages]);

     useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!newMessage.trim() && !uploadingFile) || !user || !userData) return;

        setIsSending(true);
        try {
            const currentUserProfile: UserProfile = {
                uid: user.uid,
                displayName: user.displayName || 'User',
                email: user.email || '',
                photoURL: user.photoURL || null,
                username: userData.username || ''
            };

            const payload: any = {
                circle: circle,
                user: currentUserProfile,
                text: newMessage.trim(),
                replyTo: replyingTo ? {
                    messageId: replyingTo.id,
                    authorName: replyingTo.user.displayName,
                    text: replyingTo.text || (replyingTo.mediaURL ? 'Image' : ''),
                } : null,
            };

            if (uploadingFile) {
                payload.mediaURL = await uploadCircleMedia(uploadingFile);
                payload.mediaType = 'image';
            }
            
            await sendChatMessage(payload);
            
            setNewMessage("");
            setUploadingFile(null);
            setReplyingTo(null);
            if (fileInputRef.current) fileInputRef.current.value = "";

        } catch (error: any) {
            toast.error("Failed to send message", { description: error.message });
        } finally {
            setIsSending(false);
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploadingFile(e.target.files[0]);
        }
    }

    const handleDelete = async (message: ChatMessage) => {
        if(!user) return;
        try {
            if (message.user.uid === user.uid) {
                await deleteMessageForEveryone(circle.id, message.id);
                toast.success("Message deleted for everyone.");
            } else {
                await deleteMessageForMe(circle.id, message.id, user.uid);
                toast.success("Message deleted for you.");
            }
        } catch(e: any) {
            toast.error("Failed to delete message.", { description: e.message });
        }
    }
    
    if (!user) return null;

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>Group Chat</CardTitle>
                <CardDescription>
                    Chat with your circle members in real-time.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col h-[60vh]">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <MessagesSquare className="size-16 mb-4"/>
                                <p className="text-lg font-semibold">Start the conversation!</p>
                                <p>Send a message or share a receipt to get things started.</p>
                            </div>
                        )}
                        {messages.map(msg => (
                            <div key={msg.id} className={cn("flex items-end gap-2 group", msg.user.uid === user.uid ? "justify-end" : "justify-start")}>
                                {msg.user.uid !== user.uid && (
                                    <Avatar className="h-8 w-8 self-end">
                                        <AvatarImage src={msg.user.photoURL || undefined} />
                                        <AvatarFallback>{msg.user.displayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                )}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <div className={cn("max-w-xs sm:max-w-md rounded-lg px-3 py-2 cursor-pointer", msg.user.uid === user.uid ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                             {msg.isDeleted ? (
                                                <p className="text-sm italic opacity-70">This message was deleted</p>
                                             ) : (
                                                <>
                                                    <p className="text-xs font-bold mb-1">{msg.user.displayName}</p>
                                                    {msg.replyTo && <QuotedMessage reply={msg.replyTo} />}
                                                    {msg.mediaURL && (
                                                        <button onClick={() => setPreviewImage(msg.mediaURL)} className="block w-full">
                                                            <Image
                                                                src={msg.mediaURL}
                                                                alt="Chat attachment"
                                                                width={200}
                                                                height={200}
                                                                className="rounded-md my-2 object-cover"
                                                            />
                                                        </button>
                                                    )}
                                                    {msg.text && <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>}
                                                    <p className="text-xs opacity-70 mt-1 text-right">{format(msg.createdAt, "p")}</p>
                                                </>
                                             )}
                                        </div>
                                    </DropdownMenuTrigger>
                                     {!msg.isDeleted && (
                                        <DropdownMenuContent align={msg.user.uid === user.uid ? "end" : "start"}>
                                            <DropdownMenuItem onSelect={() => setReplyingTo(msg)}>
                                                <CornerDownLeft className="mr-2" /> Reply
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => handleDelete(msg)} className="text-destructive">
                                                <Trash className="mr-2" /> {msg.user.uid === user.uid ? 'Delete for Everyone' : 'Delete for Me'}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                     )}
                                </DropdownMenu>
                                 {msg.user.uid === user.uid && (
                                    <Avatar className="h-8 w-8 self-end">
                                        <AvatarImage src={msg.user.photoURL || undefined} />
                                        <AvatarFallback>{msg.user.displayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        ))}
                         <div ref={messagesEndRef} />
                    </div>
                    {replyingTo && (
                        <div className="p-2 border-t bg-muted/50">
                            <div className="flex justify-between items-center text-sm">
                                <div className="flex-1">
                                    <p className="text-muted-foreground">Replying to <span className="font-bold">{replyingTo.user.displayName}</span></p>
                                    <p className="truncate text-foreground">{replyingTo.text || "Image"}</p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setReplyingTo(null)}>
                                    <X className="size-4"/>
                                </Button>
                            </div>
                        </div>
                    )}
                    <form onSubmit={handleSendMessage} className="p-4 border-t flex items-center gap-2">
                        <Button type="button" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()}>
                            <Paperclip />
                            <span className="sr-only">Attach file</span>
                        </Button>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden"/>
                         {uploadingFile && <span className="text-sm text-muted-foreground truncate max-w-xs">{uploadingFile.name}</span>}
                        <Input 
                            placeholder="Type a message..." 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            disabled={isSending}
                            autoComplete="off"
                        />
                        <Button type="submit" size="icon" disabled={isSending || (!newMessage.trim() && !uploadingFile)}>
                            {isSending ? <Loader2 className="animate-spin"/> : <Send />}
                        </Button>
                    </form>
                </div>
            </CardContent>
        </Card>
        {previewImage && (
             <ImagePreviewDialog
                isOpen={!!previewImage}
                onClose={() => setPreviewImage(null)}
                imageUrl={previewImage}
            />
        )}
        </>
    );
}
