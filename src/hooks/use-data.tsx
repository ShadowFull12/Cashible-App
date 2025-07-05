"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './use-auth';
import { getTransactions } from '@/services/transactionService';
import { getCategories } from '@/services/categoryService';
import { toast } from 'sonner';
import type { Transaction } from '@/lib/data';

interface DataContextType {
    transactions: Transaction[];
    categories: any[];
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
    const [isLoading, setIsLoading] = useState(true);
    const [newExpenseDefaultDate, setNewExpenseDefaultDate] = useState<Date | null>(null);
    
    const refreshData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            await Promise.all([
                getTransactions(user.uid).then(setTransactions),
                getCategories(user.uid).then(setCategories),
                refreshUserData()
            ]);
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
            setIsLoading(false);
        }
    }, [user, refreshUserData]);

    useEffect(() => {
        if(user) {
            refreshData();
        } else {
            setTransactions([]);
            setCategories([]);
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
