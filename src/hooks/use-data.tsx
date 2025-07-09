
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
import { addDays, addWeeks, addMonths, addYears, startOfDay } from 'date-fns';

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
        const today = startOfDay(new Date());
        let newTransactionsAdded = false;

        for (const expense of expenses) {
            if (!expense.isActive || !expense.id) continue;
            
            if (today >= startOfDay(expense.nextDueDate)) {
                
                await addTransaction({
                    userId: userId,
                    description: expense.description,
                    amount: expense.amount,
                    category: expense.category,
                    date: expense.nextDueDate, // Log transaction on the day it was due
                    recurringExpenseId: expense.id,
                    isSplit: false,
                    splitDetails: null,
                    circleId: null,
                });
                
                let newNextDueDate;
                switch(expense.frequency) {
                    case 'daily': newNextDueDate = addDays(expense.nextDueDate, 1); break;
                    case 'weekly': newNextDueDate = addWeeks(expense.nextDueDate, 1); break;
                    case 'monthly': newNextDueDate = addMonths(expense.nextDueDate, 1); break;
                    case 'yearly': newNextDueDate = addYears(expense.nextDueDate, 1); break;
                    default: newNextDueDate = expense.nextDueDate;
                }
                
                await updateRecurringExpense(expense.id!, { nextDueDate: newNextDueDate });

                newTransactionsAdded = true;
            }
        }
        
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
        if (typeof window !== 'undefined' && user && userData && !hasProcessedRecurring) {
            const runRecurringExpenseCheck = async () => {
                setRecurringLoading(true);
                try {
                    const fetchedRecurring = await getRecurringExpenses(user.uid);
                    setRecurringExpenses(fetchedRecurring);
                    const newTransactionsAdded = await processRecurringExpenses(user.uid, fetchedRecurring);
                    if (newTransactionsAdded) {
                        await refreshData(); // Refresh all data to reflect new state
                        toast.info("Recurring expenses for this period have been automatically added.");
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
    }, [user, userData, hasProcessedRecurring, processRecurringExpenses, refreshData]);

    useEffect(() => {
        if (typeof window !== 'undefined' && !user) {
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
        } else if (typeof window !== 'undefined') {
             resetLoadingStates();
        }
    }, [user, resetLoadingStates]);
    
    useEffect(() => {
        if (typeof window !== 'undefined' && userData?.categories) {
            setCategories(userData.categories);
            setCategoriesLoading(false);
        } else if (typeof window !== 'undefined' && user) {
            setCategoriesLoading(true);
        }
    }, [userData, user]);
    
    useEffect(() => {
        if (typeof window !== 'undefined' && user) {
            const unsubscribe = getTransactionsListener(user.uid, (data) => {
                setTransactions(data);
                setTransactionsLoading(false);
            });
            return () => unsubscribe();
        }
    }, [user]);
    
    useEffect(() => {
        if (typeof window !== 'undefined' && user) {
            const unsubscribe = getRecurringExpenses(user.uid).then(data => {
                setRecurringExpenses(data);
                setRecurringLoading(false);
            });
            // This is not a listener, so no unsubscribe function to return.
            // It's fetched once at the start. Refreshes happen via refreshData.
        }
    }, [user]);

    useEffect(() => {
        if (typeof window !== 'undefined' && user) {
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
                            new Notification('New Cashible Notification', {
                                body: latestNotification.message,
                                icon: 'https://i.postimg.cc/GhKqC9zp/cashible-logo.png',
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
        if (typeof window !== 'undefined' && user) {
            const unsubscribe = getFriendRequestsListener(user.uid, (data) => {
                setFriendRequests(data);
                setRequestsLoading(false);
            });
            return () => unsubscribe();
        }
    }, [user]);

    useEffect(() => {
        if (typeof window !== 'undefined' && user) {
            const unsubscribe = getFriendsListener(user.uid, (data) => {
                setFriends(data);
                setFriendsLoading(false);
            });
            return () => unsubscribe();
        }
    }, [user]);

    useEffect(() => {
        if (typeof window !== 'undefined' && user) {
            const unsubscribe = getCirclesForUserListener(user.uid, (data) => {
                setCircles(data);
                setCirclesLoading(false);
            });
            return () => unsubscribe();
        }
    }, [user]);

    useEffect(() => {
        if (typeof window !== 'undefined' && user) {
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
            console.error("Failed to mark all notifications as read", Error);
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
