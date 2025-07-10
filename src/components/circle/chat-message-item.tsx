
"use client";

import { cn } from '@/lib/utils';
import type { ChatMessage, UserProfile } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { CornerDownLeft, Trash } from 'lucide-react';
import { QuotedMessage } from './quoted-message';
import Image from 'next/image';

interface ChatMessageItemProps {
    message: ChatMessage;
    currentUser: UserProfile;
    onReply: (message: ChatMessage) => void;
    onDelete: (message: ChatMessage) => void;
    onPreview: (imageUrl: string) => void;
}

export const ChatMessageItem = ({ message, currentUser, onReply, onDelete, onPreview }: ChatMessageItemProps) => {
    const isCurrentUser = message.user.uid === currentUser.uid;

    if (message.isDeleted) {
        return (
            <div className={cn("flex w-full items-center gap-3 my-1", isCurrentUser ? "justify-end" : "justify-start")}>
                 {!isCurrentUser && <div className="h-8 w-8 flex-shrink-0" />}
                <p className="px-3 py-2 rounded-lg bg-muted text-sm italic text-muted-foreground">This message was deleted</p>
                 {isCurrentUser && <div className="h-8 w-8 flex-shrink-0" />}
            </div>
        )
    }

    return (
        <div className={cn("flex w-full items-start gap-3 group", isCurrentUser && "justify-end")}>
            {/* Avatar for other users */}
            {!isCurrentUser && (
                <Avatar className="h-8 w-8 flex-shrink-0 self-end">
                    <AvatarImage src={message.user.photoURL || undefined} />
                    <AvatarFallback>{message.user.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
            )}

            {/* Message content container */}
            <div className={cn(
                "flex flex-col gap-1 min-w-0", // Added min-w-0 to allow shrinking
                isCurrentUser ? "items-end" : "items-start",
                "max-w-[85%]"
            )}>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                         <div className={cn(
                            "relative flex flex-col rounded-lg px-3 py-2",
                            isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}>
                            <p className="text-xs font-bold mb-1 break-all">{isCurrentUser ? "You" : message.user.displayName}</p>
                            {message.replyTo && <QuotedMessage reply={message.replyTo} />}
                            {message.mediaURL && (
                                <div
                                  className="relative my-2 cursor-pointer max-w-xs"
                                  onClick={(e) => { e.stopPropagation(); onPreview(message.mediaURL!); }}
                                >
                                  <Image
                                      src={message.mediaURL}
                                      alt="Chat attachment"
                                      width={200}
                                      height={200}
                                      className="rounded-md h-auto w-full object-cover"
                                  />
                                </div>
                            )}
                            {message.text && <p className="text-sm whitespace-pre-wrap break-all">{message.text}</p>}
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isCurrentUser ? "end" : "start"}>
                        <DropdownMenuItem onSelect={() => onReply(message)}>
                            <CornerDownLeft className="mr-2 h-4 w-4" /> Reply
                        </DropdownMenuItem>
                        {isCurrentUser && (
                            <DropdownMenuItem onSelect={() => onDelete(message)} className="text-destructive">
                                <Trash className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
                <p className="text-xs text-muted-foreground px-1">{format(message.createdAt, "p")}</p>
            </div>
            
            {/* Avatar for current user */}
             {isCurrentUser && (
                <Avatar className="h-8 w-8 flex-shrink-0 self-end">
                    <AvatarImage src={currentUser.photoURL || undefined} />
                    <AvatarFallback>{currentUser.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
            )}
        </div>
    )
}
