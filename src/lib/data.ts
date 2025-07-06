
export const defaultCategories = [
    { name: "Groceries", color: "#22c55e" },
    { name: "Food", color: "#ef4444" },
    { name: "Entertainment", color: "#a855f7" },
    { name: "Utilities", color: "#eab308" },
    { name: "Transport", color: "#f97316" },
    { name: "Housing", color: "#3b82f6" },
    { name: "Shopping", color: "#ec4899" },
    { name: "College", color: "#8b5cf6" },
    { name: "Others", color: "#6b7280" },
];

export interface Transaction {
    id?: string;
    userId: string;
    description: string;
    amount: number;
    category: string;
    date: Date;
    recurringExpenseId?: string;
}

export interface RecurringExpense {
    id?: string;
    userId: string;
    description: string;
    amount: number;
    category: string;
    dayOfMonth: number;
    isActive: boolean;
    lastProcessed: Date | null;
}

export interface UserProfile {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
}

export interface FriendRequest {
    id: string;
    fromUser: UserProfile;
    toUserId: string;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
    createdAt: Date;
}

export interface Circle {
    id?: string;
    name: string;
    ownerId: string;
    memberIds: string[]; // For querying
    members: { [uid: string]: UserProfile }; // For storing member details
    createdAt: Date;
}
