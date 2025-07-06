
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { MessageSquare } from "lucide-react";

export function ChatTab() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Group Chat</CardTitle>
                <CardDescription>Coordinate with your circle members.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-48 border-2 border-dashed rounded-lg">
                    <MessageSquare className="size-12 mb-4" />
                    <p className="text-lg font-semibold">Chat feature coming soon!</p>
                    <p className="text-sm">This space will be for group conversations.</p>
                </div>
            </CardContent>
        </Card>
    );
}
