
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useAuth } from './use-auth';
import { getTransactionsListener, addTransaction } from '@/services/transactionService';
import { getCategories } from '@/services/categoryService';
import { getRecurringExpenses, updateRecurringExpense } from '@/services/recurringExpenseService';
import { getFriendsListener, getFriendRequestsListener } from '@/services/friendService';
import { getCirclesForUserListener } from '@/services/circleService';
import { getNotificationsForUser, markNotificationAsRead, markAllNotificationsAsRead } from '@/services/notificationService';
import { toast } from 'sonner';
import type { Transaction, RecurringExpense, UserProfile, FriendRequest, Circle, Notification, Settlement } from '@/lib/data';
import { getSettlementsForUserListener } from '@/services/debtService';

interface DataContextType {
    transactions: Transaction[];
    categories: any[];
    recurringExpenses: RecurringExpense[];
    friends: UserProfile[];
    friendRequests: FriendRequest[];
    circles: Circle[];
    settlements: Settlement[];
    notifications: Notification[];
    unreadNotificationCount: number;
    isLoading: boolean;
    refreshData: () => Promise<void>;
    
    // State for AddExpenseDialog
    isAddExpenseOpen: boolean;
    setIsAddExpenseOpen: React.Dispatch<React.SetStateAction<boolean>>;
    newExpenseDefaultDate: Date | null;
    setNewExpenseDefaultDate: React.Dispatch<React.SetStateAction<Date | null>>;
    newExpenseDefaultCircleId: string | null;
    setNewExpenseDefaultCircleId: React.Dispatch<React.SetStateAction<string | null>>;

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
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    
    // Individual loading states for better perceived performance
    const [transactionsLoading, setTransactionsLoading] = useState(true);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [recurringLoading, setRecurringLoading] = useState(true);
    const [friendsLoading, setFriendsLoading] = useState(true);
    const [requestsLoading, setRequestsLoading] = useState(true);
    const [circlesLoading, setCirclesLoading] = useState(true);
    const [settlementsLoading, setSettlementsLoading] = useState(true);
    const [notificationsLoading, setNotificationsLoading] = useState(true);

    const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
    const [newExpenseDefaultDate, setNewExpenseDefaultDate] = useState<Date | null>(null);
    const [newExpenseDefaultCircleId, setNewExpenseDefaultCircleId] = useState<string | null>(null);
    
    const [hasProcessedRecurring, setHasProcessedRecurring] = useState(false);

    const unreadNotificationCount = useMemo(() => {
        return notifications.filter(n => !n.read).length;
    }, [notifications]);

    // Combined loading state for consumers
    const isLoading = useMemo(() => {
        if (!user) return false; // If no user, data isn't "loading", it's just not there.
        return (
            transactionsLoading ||
            categoriesLoading ||
            recurringLoading ||
            friendsLoading ||
            requestsLoading ||
            circlesLoading ||
            settlementsLoading ||
            notificationsLoading
        );
    }, [
        user,
        transactionsLoading,
        categoriesLoading,
        recurringLoading,
        friendsLoading,
        requestsLoading,
        circlesLoading,
        settlementsLoading,
        notificationsLoading,
    ]);
    
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
                processingPromises.push(
                    addTransaction({
                        userId: userId,
                        description: expense.description,
                        amount: expense.amount,
                        category: expense.category,
                        date: new Date(today.getFullYear(), today.getMonth(), expense.dayOfMonth),
                        recurringExpenseId: expense.id,
                        isSplit: false,
                        splitDetails: null,
                        circleId: null,
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

    const resetLoadingStates = useCallback(() => {
        setTransactionsLoading(true);
        setCategoriesLoading(true);
        setRecurringLoading(true);
        setFriendsLoading(true);
        setRequestsLoading(true);
        setCirclesLoading(true);
        setSettlementsLoading(true);
        setNotificationsLoading(true);
    }, []);

    const refreshData = useCallback(async () => {
        if (!user) return;
        try {
            // Re-fetch non-listener data. Listeners will update automatically.
            await refreshUserData();
            const fetchedRecurring = await getRecurringExpenses(user.uid);
            setRecurringExpenses(fetchedRecurring);
        } catch (error: any) {
            if (error.code === 'permission-denied') {
                toast.error("Permission Denied", { description: "The app could not refresh your data." });
            } else {
                toast.error("Failed to refresh data.");
            }
            console.error(error);
        }
    }, [user, refreshUserData]);

    useEffect(() => {
        if (user && userData && !hasProcessedRecurring) {
            const runRecurringExpenseCheck = async () => {
                try {
                    const fetchedRecurring = await getRecurringExpenses(user.uid);
                    setRecurringExpenses(fetchedRecurring);
                    const newTransactionsAdded = await processRecurringExpenses(user.uid, fetchedRecurring);
                    if (newTransactionsAdded) {
                        toast.info("Recurring expenses for this month have been automatically added.");
                    }
                } catch (error) {
                    console.error("Failed to process recurring expenses in background:", error);
                } finally {
                    setRecurringLoading(false);
                    setHasProcessedRecurring(true); 
                }
            };
            runRecurringExpenseCheck();
        }
    }, [user, userData, hasProcessedRecurring, processRecurringExpenses]);

    useEffect(() => {
        if (!user) {
            setTransactions([]);
            setCategories([]);
            setRecurringExpenses([]);
            setFriends([]);
            setFriendRequests([]);
            setCircles([]);
            setSettlements([]);
            setNotifications([]);
            resetLoadingStates();
            setHasProcessedRecurring(false);
        } else {
             resetLoadingStates(); // Reset loading states when a new user logs in
        }
    }, [user, resetLoadingStates]);
    
    useEffect(() => {
        if (userData?.categories) {
            setCategories(userData.categories);
            setCategoriesLoading(false);
        } else if (user) {
            // This will be true for a new user until their doc is created.
            // We can keep it loading or assume defaults. Assuming defaults might be better UX.
            setCategoriesLoading(true);
        }
    }, [userData, user]);
    
    useEffect(() => {
        if (user) {
            const unsubscribe = getTransactionsListener(user.uid, (data) => {
                setTransactions(data);
                setTransactionsLoading(false);
            });
            return () => unsubscribe();
        }
    }, [user]);
    
    useEffect(() => {
        if (user) {
            const unsubscribe = getNotificationsForUser(user.uid, (data) => {
                setNotifications(data);
                setNotificationsLoading(false);
            });
            return () => unsubscribe();
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            const unsubscribe = getFriendRequestsListener(user.uid, (data) => {
                setFriendRequests(data);
                setRequestsLoading(false);
            });
            return () => unsubscribe();
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            const unsubscribe = getFriendsListener(user.uid, (data) => {
                setFriends(data);
                setFriendsLoading(false);
            });
            return () => unsubscribe();
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            const unsubscribe = getCirclesForUserListener(user.uid, (data) => {
                setCircles(data);
                setCirclesLoading(false);
            });
            return () => unsubscribe();
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            const unsubscribe = getSettlementsForUserListener(user.uid, (data) => {
                setSettlements(data);
                setSettlementsLoading(false);
            });
            return () => unsubscribe();
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
        settlements,
        notifications,
        unreadNotificationCount,
        isLoading,
        refreshData,
        isAddExpenseOpen,
        setIsAddExpenseOpen,
        newExpenseDefaultDate,
        setNewExpenseDefaultDate,
        newExpenseDefaultCircleId,
        setNewExpenseDefaultCircleId,
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
