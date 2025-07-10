
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, onSnapshot, Unsubscribe, doc, deleteDoc, WriteBatch, updateDoc, writeBatch } from "firebase/firestore";
import type { Product } from "@/lib/data";
import { addCustomerDeletionsToBatch } from "./customerService";

export async function addProduct(product: Omit<Product, 'id'>) {
    if (!db) throw new Error("Firebase is not configured.");
    const productsRef = collection(db, "products");

    // Check if product with the same name already exists for this user
    const q = query(productsRef, where("userId", "==", product.userId), where("name", "==", product.name));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        // Don't throw error, just skip adding.
        console.log(`Product with name "${product.name}" already exists. Skipping.`);
        return;
    }

    try {
        const docRef = await addDoc(productsRef, product);
        return docRef.id;
    } catch (error: any) {
        console.error('Error adding product:', error);
        throw new Error(error.message || "Failed to add product.");
    }
}

export function getProductsListener(userId: string, callback: (products: Product[]) => void): Unsubscribe {
    if (!db) return () => {};
    const productsRef = collection(db, "products");
    try {
        const q = query(productsRef, where("userId", "==", userId));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const products: Product[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                products.push({
                    id: doc.id,
                    ...data,
                } as Product);
            });
            callback(products.sort((a, b) => a.name.localeCompare(b.name)));
        });
        return unsubscribe;
    } catch (error) {
        console.error(`Error listening to products for user ${userId}:`, error);
        throw error;
    }
}

export async function updateProduct(productId: string, data: Partial<Product>) {
    if (!db) throw new Error("Firebase is not configured.");
    const productRef = doc(db, "products", productId);
    await updateDoc(productRef, data);
}

export async function deleteProduct(productId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    const productRef = doc(db, "products", productId);
    await deleteDoc(productRef);
}

// Used for batch deleting all of a user's business data
export async function addProductDeletionsToBatch(userId: string, batch: WriteBatch) {
    if (!db) return;
    const q = query(collection(db, "products"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
}

// Standalone function to delete all business-related data
export async function deleteAllBusinessData(userId: string) {
    if (!db) throw new Error("Firebase is not configured.");
    
    const batch = writeBatch(db);

    // Delete all products
    await addProductDeletionsToBatch(userId, batch);
    
    // Delete all sales records
    const salesQuery = query(collection(db, "transactions"), where("userId", "==", userId), where("category", "==", 'Sale'));
    const salesSnapshot = await getDocs(salesQuery);
    salesSnapshot.forEach(doc => batch.delete(doc.ref));

    // Delete all related income transactions from sales
    const incomeQuery = query(collection(db, "transactions"), where("userId", "==", userId), where("category", "==", "Income"), where("relatedSaleId", "!=", null));
    const incomeSnapshot = await getDocs(incomeQuery);
    incomeSnapshot.forEach(doc => batch.delete(doc.ref));

    // Delete all customers
    await addCustomerDeletionsToBatch(userId, batch);
    
    await batch.commit();
}
