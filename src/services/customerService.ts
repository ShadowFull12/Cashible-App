
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, Unsubscribe, WriteBatch, getDocs } from "firebase/firestore";
import type { Customer } from "@/lib/data";

export function getCustomersListener(userId: string, callback: (customers: Customer[]) => void): Unsubscribe {
    if (!db) return () => {};
    const customersRef = collection(db, "customers");
    try {
        const q = query(customersRef, where("userId", "==", userId));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const customers: Customer[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                customers.push({
                    id: doc.id,
                    ...data,
                } as Customer);
            });
            callback(customers.sort((a, b) => a.name.localeCompare(b.name)));
        });
        return unsubscribe;
    } catch (error) {
        console.error(`Error listening to customers for user ${userId}:`, error);
        throw error;
    }
}

export async function addCustomerDeletionsToBatch(userId: string, batch: WriteBatch) {
    if (!db) return;
    const q = query(collection(db, "customers"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
}
