
import type { ChatMessage } from "@/lib/data";

interface QuotedMessageProps {
    reply: NonNullable<ChatMessage['replyTo']>;
}

export function QuotedMessage({ reply }: QuotedMessageProps) {
    return (
        <div className="relative bg-black/10 dark:bg-white/10 p-2 rounded-md mb-1 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary/50">
            <p className="text-xs font-bold">{reply.authorName}</p>
            <p className="text-sm opacity-80 truncate">{reply.text}</p>
        </div>
    );
}
