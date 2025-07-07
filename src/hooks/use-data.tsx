
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bell } from 'lucide-react';

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
    
    // Real-time notification system
    setAudioRef: (el: HTMLAudioElement) => void;
    hasNewNotification: boolean;
    clearNewNotification: () => void;
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

    // Real-time notification system state
    const prevNotificationsRef = useRef<Notification[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [hasNewNotification, setHasNewNotification] = useState(false);

    const setAudioRef = useCallback((el: HTMLAudioElement) => {
        audioRef.current = el;
    }, []);

    const unreadNotificationCount = useMemo(() => {
        return notifications.filter(n => !n.read).length;
    }, [notifications]);

    const isLoading = useMemo(() => {
        if (!user) return false;
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
            setHasNewNotification(false);
        } else {
             resetLoadingStates();
        }
    }, [user, resetLoadingStates]);
    
    useEffect(() => {
        if (userData?.categories) {
            setCategories(userData.categories);
            setCategoriesLoading(false);
        } else if (user) {
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
                // This check avoids firing notifications on the initial load.
                if (prevNotificationsRef.current.length > 0) {
                    const newUnreadNotifications = data.filter(n => !n.read && !prevNotificationsRef.current.some(pn => pn.id === n.id));
                    
                    if (newUnreadNotifications.length > 0) {
                        setHasNewNotification(true);
                        const latestNotification = newUnreadNotifications[0]; // Assuming data is sorted desc by date
                        
                        // Play sound
                        audioRef.current?.play().catch(e => console.error("Audio play failed:", e));

                        // Show toast
                        toast(
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={latestNotification.fromUser.photoURL || undefined} />
                              <AvatarFallback><Bell /></AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="font-bold">{latestNotification.fromUser.displayName}</div>
                              <div>{latestNotification.message}</div>
                            </div>
                          </div>,
                          {
                            duration: 5000,
                          }
                        );

                        // Show desktop notification
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification('New SpendWise Notification', {
                                body: latestNotification.message,
                                icon: '/assests/logo.png',
                            });
                        }
                    }
                }

                setNotifications(data);
                prevNotificationsRef.current = data;
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
            setHasNewNotification(false);
        } catch (error) {
            console.error("Failed to mark all notifications as read", error);
            toast.error("Failed to update notifications.");
        }
    }

    const clearNewNotification = () => {
        setHasNewNotification(false);
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
        setAudioRef,
        hasNewNotification,
        clearNewNotification,
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
