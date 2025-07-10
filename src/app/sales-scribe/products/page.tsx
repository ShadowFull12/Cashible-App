
"use client";

import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useData } from '@/hooks/use-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Package, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { addProduct, deleteProduct, updateProduct } from '@/services/productService';
import { Product } from '@/lib/data';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogClose, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogContent } from '@/components/ui/dialog';

function EditProductDialog({ product, onEdited, open, onOpenChange }: { product: Product, onEdited: () => void, open: boolean, onOpenChange: (open: boolean) => void }) {
    const [name, setName] = useState(product.name);
    const [price, setPrice] = useState(product.price.toString());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleUpdate = async () => {
        if (!name || !price) {
            toast.error("Name and price are required.");
            return;
        }
        setIsSubmitting(true);
        try {
            await updateProduct(product.id!, { name, price: parseFloat(price) });
            toast.success("Product updated!");
            onEdited();
            onOpenChange(false);
        } catch (error: any) {
            toast.error("Failed to update product.", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Product</DialogTitle>
                    <DialogDescription>Update the details for {product.name}.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-1">
                        <Label htmlFor="edit-product-name">Product Name</Label>
                        <Input id="edit-product-name" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="edit-product-price">Price (₹)</Label>
                        <Input id="edit-product-price" type="number" value={price} onChange={e => setPrice(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                    <Button onClick={handleUpdate} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="animate-spin" />} Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function ProductsPage() {
    const { user } = useAuth();
    const { products, isLoading, refreshData } = useData();
    const [newProductName, setNewProductName] = useState("");
    const [newProductPrice, setNewProductPrice] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newProductName || !newProductPrice) return;
        setIsSubmitting(true);
        try {
            await addProduct({
                userId: user.uid,
                name: newProductName,
                price: parseFloat(newProductPrice),
            });
            toast.success("Product added successfully!");
            setNewProductName("");
            setNewProductPrice("");
            refreshData();
        } catch (error: any) {
            toast.error("Failed to add product", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteProduct = async (productId: string) => {
        if (!user) return;
        try {
            await deleteProduct(productId);
            toast.success("Product deleted successfully");
            refreshData();
        } catch (error: any) {
            toast.error("Failed to delete product", { description: error.message });
        }
    }

    const handleProductEdited = () => {
        setEditingProduct(null);
        refreshData();
    }

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Manage Products</CardTitle>
                    <CardDescription>Add, view, or remove products from your sales inventory.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form onSubmit={handleAddProduct} className="flex flex-col sm:flex-row items-end gap-4 p-4 border rounded-lg">
                        <div className="flex-grow w-full space-y-1.5">
                            <Label htmlFor="product-name">Product Name</Label>
                            <Input id="product-name" placeholder="e.g. T-Shirt" value={newProductName} onChange={e => setNewProductName(e.target.value)} />
                        </div>
                        <div className="w-full sm:w-40 space-y-1.5">
                            <Label htmlFor="product-price">Price (₹)</Label>
                            <Input id="product-price" type="number" placeholder="e.g. 499" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} />
                        </div>
                        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : "Add Product"}
                        </Button>
                    </form>

                    <div className="space-y-4">
                        <h3 className="font-semibold">Your Products ({products.length})</h3>
                        {isLoading && <Loader2 className="animate-spin" />}
                        {!isLoading && products.length === 0 && (
                            <p className="text-center text-muted-foreground py-4">You have no products yet. Add one above to get started.</p>
                        )}
                        <div className="space-y-3">
                            {products.map(product => (
                                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg border">
                                    <div className="flex items-center gap-3">
                                        <Package className="size-5 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">{product.name}</p>
                                            <p className="text-sm text-muted-foreground">₹{product.price.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                         <Button variant="ghost" size="icon" onClick={() => setEditingProduct(product)}>
                                            <Edit className="size-4" />
                                         </Button>
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Trash2 className="size-4 text-destructive" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently remove the product from your list. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteProduct(product.id!)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {editingProduct && (
                <EditProductDialog
                    product={editingProduct}
                    onEdited={handleProductEdited}
                    open={!!editingProduct}
                    onOpenChange={(open) => !open && setEditingProduct(null)}
                />
            )}
        </div>
    );
}
