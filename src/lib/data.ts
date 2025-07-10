
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
    type?: 'expense' | 'income';
    saleDetails?: SaleDetails | null;
    relatedSaleId?: string; 
}

export interface SaleItem {
    name: string;
    quantity: number;
    price: number;
}

export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

export interface SaleDetails {
    items: SaleItem[];
    totalAmount: number;
    customerName?: string | null;
    customerId?: string | null;
    paymentStatus: PaymentStatus;
    amountPaid: number;
    notes?: string | null;
}

export type RecurringExpenseFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringExpense {
    id?: string;
    userId: string;
    description: string;
    amount: number;
    category: string;
    frequency: RecurringExpenseFrequency;
    nextDueDate: Date;
    isActive: boolean;
}

export interface UserProfile {
    uid: string;
    displayName: string;
    email: string;
    photoURL: string | null;
    username?: string;
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
    memberIds: string[]; 
    members: { [uid: string]: UserProfile }; 
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
    isSettled?: boolean; 
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
    'settlement-expense-pending' | 
    'settlement-income-pending' | 
    'settlement-rejected' | 
    'circle-member-joined' |
    'circle-expense-removed-by-owner' |
    'feature-announcement';


export interface Notification {
    id: string;
    userId: string; 
    fromUser: UserProfile;
    type: NotificationType;
    message: string;
    link: string;
    read: boolean;
    relatedId?: string; 
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

export interface BusinessProfile {
    isSetup: boolean;
    name: string;
    logoUrl: string | null;
}

export interface Product {
    id?: string;
    userId: string;
    name: string;
    price: number;
}

export interface Customer {
    id?: string;
    userId: string;
    name: string;
    totalDebt: number;
    unpaidSaleIds: string[];
}
