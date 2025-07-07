"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import type { Circle, ChatMessage, UserProfile } from '@/lib/data';
import { getChatMessagesListener, sendChatMessage, updateUserLastReadTimestamp } from '@/services/chatService';
import { uploadCircleMedia } from '@/services/circleService';
import { format } from 'date-fns';
import { Paperclip, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ChatTabProps {
    circle: Circle;
}

export function ChatTab({ circle }: ChatTabProps) {
    const { user, userData } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [uploadingFile, setUploadingFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!circle.id) return;
        const unsubscribe = getChatMessagesListener(circle.id, setMessages);
        return () => unsubscribe();
    }, [circle.id]);

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
                circleId: circle.id,
                user: currentUserProfile,
                text: newMessage.trim(),
            };

            if (uploadingFile) {
                payload.mediaURL = await uploadCircleMedia(uploadingFile);
                payload.mediaType = 'image';
            }
            
            await sendChatMessage(payload);
            
            setNewMessage("");
            setUploadingFile(null);
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
    
    if (!user) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Group Chat</CardTitle>
                <CardDescription>
                    Chat with your circle members in real-time. Please note that this chat is not end-to-end encrypted.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col h-[60vh]">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map(msg => (
                            <div key={msg.id} className={cn("flex items-end gap-2", msg.user.uid === user.uid ? "justify-end" : "justify-start")}>
                                {msg.user.uid !== user.uid && (
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={msg.user.photoURL || undefined} />
                                        <AvatarFallback>{msg.user.displayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                )}
                                <div className={cn("max-w-xs sm:max-w-md rounded-lg px-3 py-2", msg.user.uid === user.uid ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                    <p className="text-xs font-bold mb-1">{msg.user.displayName}</p>
                                    {msg.mediaURL && (
                                        <a href={msg.mediaURL} target="_blank" rel="noopener noreferrer">
                                            <Image
                                                src={msg.mediaURL}
                                                alt="Chat attachment"
                                                width={200}
                                                height={200}
                                                className="rounded-md my-2"
                                            />
                                        </a>
                                    )}
                                    {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                                    <p className="text-xs opacity-70 mt-1 text-right">{format(msg.createdAt, "p")}</p>
                                </div>
                                 {msg.user.uid === user.uid && (
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={msg.user.photoURL || undefined} />
                                        <AvatarFallback>{msg.user.displayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        ))}
                         <div ref={messagesEndRef} />
                    </div>
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
                        />
                        <Button type="submit" size="icon" disabled={isSending || (!newMessage.trim() && !uploadingFile)}>
                            {isSending ? <Loader2 className="animate-spin"/> : <Send />}
                        </Button>
                    </form>
                </div>
            </CardContent>
        </Card>
    );
}
