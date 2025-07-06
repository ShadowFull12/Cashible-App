"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './use-auth';
import { getTransactions, addTransaction } from '@/services/transactionService';
import { getCategories } from '@/services/categoryService';
import { getRecurringExpenses, updateRecurringExpense } from '@/services/recurringExpenseService';
import { getFriends, getFriendRequests } from '@/services/friendService';
import { getCirclesForUser } from '@/services/circleService';
import { toast } from 'sonner';
import type { Transaction, RecurringExpense, UserProfile, FriendRequest, Circle } from '@/lib/data';

interface DataContextType {
    transactions: Transaction[];
    categories: any[];
    recurringExpenses: RecurringExpense[];
    friends: UserProfile[];
    friendRequests: FriendRequest[];
    circles: Circle[];
    isLoading: boolean;
    refreshData: () => Promise<void>;
    newExpenseDefaultDate: Date | null;
    setNewExpenseDefaultDate: React.Dispatch<React.SetStateAction<Date | null>>;
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
    const [isLoading, setIsLoading] = useState(true);
    const [newExpenseDefaultDate, setNewExpenseDefaultDate] = useState<Date | null>(null);
    
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
                getFriendRequests(user.uid).then(setFriendRequests),
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
            setIsLoading(false);
        }
    }, [user, refreshData]);
    
    useEffect(() => {
        if (userData?.categories) {
            setCategories(userData.categories);
        }
    }, [userData]);

    const value = {
        transactions,
        categories,
        recurringExpenses,
        friends,
        friendRequests,
        circles,
        isLoading,
        refreshData: refreshData as () => Promise<void>,
        newExpenseDefaultDate,
        setNewExpenseDefaultDate,
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
