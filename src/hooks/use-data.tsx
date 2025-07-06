
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useAuth } from './use-auth';
import { getTransactions, addTransaction } from '@/services/transactionService';
import { getCategories } from '@/services/categoryService';
import { getRecurringExpenses, updateRecurringExpense } from '@/services/recurringExpenseService';
import { getFriends, getFriendRequestsListener } from '@/services/friendService';
import { getCirclesForUser } from '@/services/circleService';
import { getNotificationsForUser, markNotificationAsRead, markAllNotificationsAsRead } from '@/services/notificationService';
import { toast } from 'sonner';
import type { Transaction, RecurringExpense, UserProfile, FriendRequest, Circle, Notification } from '@/lib/data';

interface DataContextType {
    transactions: Transaction[];
    categories: any[];
    recurringExpenses: RecurringExpense[];
    friends: UserProfile[];
    friendRequests: FriendRequest[];
    circles: Circle[];
    notifications: Notification[];
    unreadNotificationCount: number;
    isLoading: boolean;
    refreshData: () => Promise<void>;
    newExpenseDefaultDate: Date | null;
    setNewExpenseDefaultDate: React.Dispatch<React.SetStateAction<Date | null>>;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
    const { user, userData, refreshUserData } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
    const [friends, setFriends] = useState<UserProfile[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [circles, setCircles] = useState<Circle[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newExpenseDefaultDate, setNewExpenseDefaultDate] = useState<Date | null>(null);

    const unreadNotificationCount = useMemo(() => {
        return notifications.filter(n => !n.read).length;
    }, [notifications]);
    
    const processRecurringExpenses = useCallback(async (userId: string, expenses: RecurringExpense[]) => {
        const today = new Date();
        const processingPromises: Promise<any>[] = [];
        let newTransactionsAdded = false;

        for (const expense of expenses) {
            if (!expense.isActive || !expense.id) continue;

            const lastProcessed = expense.lastProcessed;
            const isSameMonth = lastProcessed 
                ? today.getFullYear() === lastProcessed.getFullYear() && today.getMonth() === lastProcessed.getMonth()
                : false;
            
            const paymentIsDue = today.getDate() >= expense.dayOfMonth;
            
            if (paymentIsDue && !isSameMonth) {
                const transactionDate = new Date(today.getFullYear(), today.getMonth(), expense.dayOfMonth);
                
                processingPromises.push(
                    addTransaction({
                        userId: userId,
                        description: expense.description,
                        amount: expense.amount,
                        category: expense.category,
                        date: transactionDate,
                        recurringExpenseId: expense.id,
                    }).then(() => {
                        return updateRecurringExpense(expense.id!, { lastProcessed: today });
                    })
                );
                newTransactionsAdded = true;
            }
        }
        
        await Promise.all(processingPromises);
        return newTransactionsAdded;
    }, []);

    const refreshData = useCallback(async (showLoading = true) => {
        if (!user) return;
        if(showLoading) setIsLoading(true);
        try {
            const fetchedRecurring = await getRecurringExpenses(user.uid);
            setRecurringExpenses(fetchedRecurring);

            const newTransactionsAdded = await processRecurringExpenses(user.uid, fetchedRecurring);

            if (newTransactionsAdded) {
                toast.info("Recurring expenses have been automatically added.");
            }

            const dataPromises = [
                getTransactions(user.uid).then(setTransactions),
                getCategories(user.uid).then(setCategories),
                getFriends(user.uid).then(setFriends),
                getCirclesForUser(user.uid).then(setCircles),
                refreshUserData()
            ];

            await Promise.all(dataPromises);

        } catch (error: any) {
            if (error.code === 'permission-denied') {
                toast.error("Permission Denied", {
                    description: "The app could not refresh your data. Please check your Firestore security rules."
                });
            } else {
                toast.error("Failed to refresh data.");
            }
            console.error(error);
        } finally {
            if(showLoading) setIsLoading(false);
        }
    }, [user, refreshUserData, processRecurringExpenses]);

    useEffect(() => {
        if(user) {
            refreshData();
        } else {
            setTransactions([]);
            setCategories([]);
            setRecurringExpenses([]);
            setFriends([]);
            setFriendRequests([]);
            setCircles([]);
            setNotifications([]);
            setIsLoading(false);
        }
    }, [user, refreshData]);
    
    useEffect(() => {
        if (userData?.categories) {
            setCategories(userData.categories);
        }
    }, [userData]);
    
    // Listener for notifications
    useEffect(() => {
        if (user) {
            const unsubscribe = getNotificationsForUser(user.uid, (newNotifications) => {
                setNotifications(newNotifications);
            });
            return () => unsubscribe();
        } else {
            setNotifications([]);
        }
    }, [user]);

    // Listener for friend requests
    useEffect(() => {
        if (user) {
            const unsubscribe = getFriendRequestsListener(user.uid, (requests) => {
                setFriendRequests(requests);
            });
            return () => unsubscribe();
        } else {
            setFriendRequests([]);
        }
    }, [user]);


    const markAsRead = async (notificationId: string) => {
        try {
            await markNotificationAsRead(notificationId);
        } catch (error) {
            console.error("Failed to mark notification as read", error);
            toast.error("Failed to update notification.");
        }
    }

    const markAllAsRead = async () => {
        if (!user) return;
        try {
            await markAllNotificationsAsRead(user.uid);
        } catch (error) {
            console.error("Failed to mark all notifications as read", error);
            toast.error("Failed to update notifications.");
        }
    }

    const value = {
        transactions,
        categories,
        recurringExpenses,
        friends,
        friendRequests,
        circles,
        notifications,
        unreadNotificationCount,
        isLoading,
        refreshData: refreshData as () => Promise<void>,
        newExpenseDefaultDate,
        setNewExpenseDefaultDate,
        markAsRead,
        markAllAsRead,
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
