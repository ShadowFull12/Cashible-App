
import type { Timestamp } from "firebase/firestore";

export const defaultCategories = [
    { name: "Groceries", color: "#22c55e" },
    { name: "Food", color: "#ef4444" },
    { name: "Entertainment", color: "#a855f7" },
    { name: "Utilities", color: "#eab308" },
    { name: "Transport", color: "#f97316" },
    { name: "Housing", color: "#3b82f6" },
    { name: "Shopping", color: "#ec4899" },
    { name: "College", color: "#8b5cf6" },
    { name: "Settlement", color: "#64748b" },
    { name: "Others", color: "#6b7280" },
];

export interface Transaction {
    id?: string;
    userId: string;
    description: string;
    amount: number;
    category: string;
    date: Date;
    recurringExpenseId?: string | null;
    isSplit?: boolean;
    circleId?: string | null;
    splitDetails?: SplitDetails | null;
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
    photoURL: string | null;
    username: string;
}

export interface FriendRequest {
    id: string;
    fromUser: UserProfile;
    toUserId: string;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
    createdAt: Date;
}

export interface Circle {
    id: string;
    name: string;
    ownerId: string;
    memberIds: string[]; // For querying
    members: { [uid: string]: UserProfile }; // For storing member details
    createdAt: Date;
    photoURL?: string | null;
    lastMessageAt?: Date | null;
    lastRead?: { [uid: string]: Date };
    unreadCounts?: { [uid: string]: number };
}

export type DebtSettlementStatus = 'unsettled' | 'pending_confirmation' | 'confirmed' | 'logged';

export interface Debt {
    id: string;
    circleId: string | null;
    transactionId: string;
    debtorId: string;
    creditorId: string;
    amount: number;
    isSettled?: boolean; // For backwards compatibility
    settlementStatus: DebtSettlementStatus;
    createdAt: Date;
    involvedUids: string[];
    debtor: UserProfile;
    creditor: UserProfile;
    transactionDescription: string;
}

export type SplitType = 'equally' | 'unequally';

export interface SplitMember extends UserProfile {
    share: number;
}

export interface SplitDetails {
    type: SplitType;
    payerId: string;
    members: SplitMember[];
    total: number;
}

export type SettlementStatus = 'pending_confirmation' | 'confirmed' | 'rejected';

export interface Settlement {
    id: string;
    circleId: string;
    fromUserId: string;
    fromUser: UserProfile;
    toUserId: string;
    toUser: UserProfile;
    amount: number;
    status: SettlementStatus;
    createdAt: Date;
    processedAt?: Date | null;
    payerTransactionId?: string | null;
    creditorIncomeLogged?: boolean;
}


export type NotificationType = 
    'friend-request' | 
    'expense-claim-request' |
    'expense-claim-accepted' |
    'expense-claim-rejected' |
    'settlement-request' | 
    'settlement-expense-pending' | // To Payer
    'settlement-income-pending' | // To Creditor
    'settlement-rejected' | 
    'circle-member-joined' |
    'circle-expense-removed-by-owner';


export interface Notification {
    id: string;
    userId: string; // The user who receives the notification
    fromUser: UserProfile;
    type: NotificationType;
    message: string;
    link: string;
    read: boolean;
    relatedId?: string; // e.g., friend request ID, expense claim ID
    createdAt: Date;
}

export interface ExpenseClaim {
    id: string;
    claimerId: string;
    claimerProfile: UserProfile;
    payerId: string;
    expenseDetails: {
        description: string;
        amount: number;
        category: string;
        date: Date;
        circleId: string | null;
        splitDetails: SplitDetails;
    };
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: Date;
}

export interface ChatMessage {
    id: string;
    circleId: string;
    user: UserProfile;
    text?: string;
    mediaURL?: string | null;
    mediaType?: 'image' | 'receipt';
    createdAt: Date;
    replyTo?: {
        messageId: string;
        authorName: string;
        text: string;
    } | null;
    isDeleted?: boolean;
    deletedFor?: string[];
}
