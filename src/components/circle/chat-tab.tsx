
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
import { Paperclip, Send, Loader2, CornerDownLeft, Trash, X, MessagesSquare, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ImagePreviewDialog } from './image-preview-dialog';
import { QuotedMessage } from './quoted-message';

// =====================================================================
// New, dedicated component for rendering a single chat message.
// This is built from the ground up to be responsive and prevent overflow.
// =====================================================================
interface ChatMessageItemProps {
    message: ChatMessage;
    currentUser: UserProfile;
    onReply: (message: ChatMessage) => void;
    onDelete: (message: ChatMessage) => void;
    onPreview: (imageUrl: string) => void;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, currentUser, onReply, onDelete, onPreview }) => {
    const isCurrentUser = message.user.uid === currentUser.uid;

    return (
        <div className={cn("flex w-full items-start gap-2", isCurrentUser ? "justify-end" : "justify-start")}>
            {!isCurrentUser && (
                <Avatar className="h-8 w-8 self-end flex-shrink-0">
                    <AvatarImage src={message.user.photoURL || undefined} />
                    <AvatarFallback>{message.user.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
            )}

            {/* Message Bubble and Content */}
            <div className={cn("flex flex-col group", isCurrentUser ? "items-end" : "items-start")}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div
                            className={cn(
                                "relative rounded-lg px-3 py-2 cursor-pointer max-w-xs sm:max-w-sm md:max-w-md overflow-hidden",
                                isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}
                        >
                            {message.isDeleted ? (
                                <p className="text-sm italic opacity-70">This message was deleted</p>
                            ) : (
                                <>
                                    <p className="text-xs font-bold mb-1">{message.user.displayName}</p>
                                    {message.replyTo && <QuotedMessage reply={message.replyTo} />}
                                    {message.mediaURL && (
                                        <Image
                                            src={message.mediaURL}
                                            alt="Chat attachment"
                                            width={200}
                                            height={200}
                                            className="rounded-md my-2 object-cover cursor-pointer"
                                            onClick={(e) => { e.stopPropagation(); onPreview(message.mediaURL!); }}
                                        />
                                    )}
                                    {message.text && <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>}
                                    <p className="text-xs opacity-70 mt-1 text-right">{format(message.createdAt, "p")}</p>
                                </>
                            )}
                        </div>
                    </DropdownMenuTrigger>
                    {!message.isDeleted && (
                        <DropdownMenuContent align={isCurrentUser ? "end" : "start"}>
                            {message.mediaURL && (
                                <DropdownMenuItem onSelect={() => onPreview(message.mediaURL!)}>
                                    <Eye className="mr-2" /> Preview
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={() => onReply(message)}>
                                <CornerDownLeft className="mr-2" /> Reply
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onDelete(message)} className="text-destructive">
                                <Trash className="mr-2" /> {isCurrentUser ? 'Delete for Everyone' : 'Delete for Me'}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    )}
                </DropdownMenu>
            </div>

            {isCurrentUser && (
                <Avatar className="h-8 w-8 self-end flex-shrink-0">
                    <AvatarImage src={message.user.photoURL || undefined} />
                    <AvatarFallback>{message.user.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
            )}
        </div>
    );
};


// =====================================================================
// Main ChatTab Component
// =====================================================================
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
    
    if (!user || !userData) return null;

    const currentUserProfile: UserProfile = {
        uid: user.uid, displayName: user.displayName || 'User', email: user.email || '', photoURL: user.photoURL || null, username: userData.username || '',
    };

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
                    {/* Main chat area with overflow controls */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-4">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <MessagesSquare className="size-16 mb-4"/>
                                <p className="text-lg font-semibold">Start the conversation!</p>
                                <p>Send a message or share a receipt to get things started.</p>
                            </div>
                        )}
                        {messages.map(msg => (
                            <ChatMessageItem
                                key={msg.id}
                                message={msg}
                                currentUser={currentUserProfile}
                                onReply={setReplyingTo}
                                onDelete={handleDelete}
                                onPreview={setPreviewImage}
                            />
                        ))}
                         <div ref={messagesEndRef} />
                    </div>

                    {/* Replying-to banner */}
                    {replyingTo && (
                        <div className="p-2 border-t bg-muted/50">
                            <div className="flex justify-between items-center text-sm">
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-muted-foreground">Replying to <span className="font-bold">{replyingTo.user.displayName}</span></p>
                                    <p className="truncate text-foreground">{replyingTo.text || "Image"}</p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setReplyingTo(null)}>
                                    <X className="size-4"/>
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Message input form */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t flex items-center gap-2">
                        <Button type="button" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()}>
                            <Paperclip />
                            <span className="sr-only">Attach file</span>
                        </Button>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden"/>
                         {uploadingFile && <span className="text-sm text-muted-foreground truncate max-w-[10rem]">{uploadingFile.name}</span>}
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
