
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../ui/card";
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useAuth } from '@/hooks/use-auth';
import type { Circle, ChatMessage, UserProfile } from '@/lib/data';
import { getChatMessagesListener, sendChatMessage, deleteMessageForEveryone, deleteMessageForMe } from '@/services/chatService';
import { uploadCircleMedia } from '@/services/circleService';
import { Paperclip, Send, Loader2, X, MessagesSquare } from 'lucide-react';
import { toast } from 'sonner';
import { ImagePreviewDialog } from './image-preview-dialog';
import { ChatMessageItem } from './chat-message-item';
import { updateUserLastReadTimestamp } from '@/services/chatService';
import { useData } from '@/hooks/use-data';

interface ChatTabProps {
    circle: Circle;
}

export function ChatTab({ circle }: ChatTabProps) {
    const { user, userData } = useAuth();
    const { refreshData } = useData();
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
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    
    useEffect(() => {
        if (!user) return;
        const unreadCount = circle.unreadCounts?.[user.uid] || 0;
        if (unreadCount > 0) {
            const timer = setTimeout(() => {
                updateUserLastReadTimestamp(circle.id, user.uid).then(() => {
                    refreshData();
                });
            }, 2000); // Mark as read after 2 seconds of being on the tab
            return () => clearTimeout(timer);
        }
    }, [circle.id, user, circle.unreadCounts, refreshData]);

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
                payload.mediaType = uploadingFile.type.startsWith('image/') ? 'image' : 'file';
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
    };

    const handleDelete = async (message: ChatMessage) => {
        if(!user) return;
        try {
            if (message.user.uid === user.uid) {
                await deleteMessageForEveryone(circle.id, message.id);
                toast.success("Message deleted for everyone.");
            }
        } catch(e: any) {
            toast.error("Failed to delete message.", { description: e.message });
        }
    };

    if (!user || !userData) return null;

    const currentUserProfile: UserProfile = {
        uid: user.uid, displayName: user.displayName || 'User', email: user.email || '', photoURL: user.photoURL || null, username: userData.username || '',
    };

    return (
        <>
            <Card className="w-full flex flex-col h-[70vh] overflow-hidden">
                <CardHeader>
                    <CardTitle>Group Chat</CardTitle>
                    <CardDescription>Chat with your circle members in real-time.</CardDescription>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length > 0 ? (
                        messages.map(msg => (
                            <ChatMessageItem
                                key={msg.id}
                                message={msg}
                                currentUser={currentUserProfile}
                                onReply={setReplyingTo}
                                onDelete={handleDelete}
                                onPreview={setPreviewImage}
                            />
                        ))
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                            <MessagesSquare className="mb-4 h-16 w-16" />
                            <p className="text-lg font-semibold">Start the conversation!</p>
                            <p>Send a message or share a receipt to get things started.</p>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </CardContent>

                <CardFooter className="p-2 border-t flex flex-col items-stretch">
                    {replyingTo && (
                        <div className="bg-muted/50 p-2 rounded-t-md w-full mb-1">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-muted-foreground">Replying to <span className="font-bold">{replyingTo.user.displayName}</span></p>
                                    <p className="truncate text-foreground">{replyingTo.text || "Image"}</p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyingTo(null)}><X className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    )}
                    
                    {uploadingFile && !replyingTo && (
                         <div className="bg-muted/50 p-2 rounded-t-md w-full mb-1">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-muted-foreground">Attaching:</p>
                                    <p className="truncate text-foreground">{uploadingFile.name}</p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {setUploadingFile(null); if (fileInputRef.current) fileInputRef.current.value = "";}}><X className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSendMessage} className="flex items-center gap-2 w-full">
                        <Button type="button" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()}>
                            <Paperclip />
                            <span className="sr-only">Attach file</span>
                        </Button>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <Input
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            disabled={isSending}
                            autoComplete="off"
                            className="flex-1"
                        />
                        <Button type="submit" size="icon" disabled={isSending || (!newMessage.trim() && !uploadingFile)}>
                            {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                        </Button>
                    </form>
                </CardFooter>
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
