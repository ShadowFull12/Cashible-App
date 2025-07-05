"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useData } from "@/hooks/use-data";
import { useState } from "react";
import { addCategory, deleteCategory } from "@/services/categoryService";
import { toast } from "sonner";

interface Category {
    name: string;
    color: string;
}

export default function SettingsPage() {
    const { user } = useAuth();
    const { categories, isLoading, refreshData } = useData();
    const [newCategoryName, setNewCategoryName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newCategoryName) return;
        
        if (categories.some(cat => cat.name.toLowerCase() === newCategoryName.toLowerCase())) {
            toast.error("Category with this name already exists.");
            return;
        }

        setIsSubmitting(true);
        try {
            const newCategory = { name: newCategoryName, color: `#${Math.floor(Math.random()*16777215).toString(16)}` };
            await addCategory(user.uid, newCategory);
            setNewCategoryName("");
            toast.success("Category added!");
            await refreshData();
        } catch (error) {
            toast.error("Failed to add category.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeleteCategory = async (category: Category) => {
        if (!user) return;
        try {
            await deleteCategory(user.uid, category);
            toast.success("Category deleted!");
            await refreshData();
        } catch (error) {
            toast.error("Failed to delete category.");
        }
    };

    return (
        <div className="grid gap-6">
            <h1 className="text-3xl font-bold font-headline">Settings</h1>
            <Tabs defaultValue="profile">
                <TabsList>
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="categories">Categories</TabsTrigger>
                    <TabsTrigger value="appearance" disabled>Appearance</TabsTrigger>
                </TabsList>
                <TabsContent value="profile" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile Settings</CardTitle>
                            <CardDescription>Manage your personal information and account settings.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="username">Username</Label>
                                <Input id="username" defaultValue={user?.displayName || ''} disabled />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" defaultValue={user?.email || ''} disabled />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="currency">Default Currency</Label>
                                 <Select defaultValue="inr" disabled>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Select currency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="inr">INR (₹)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button disabled>Save Changes</Button>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="categories" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Expense Categories</CardTitle>
                            <CardDescription>Add, edit, or remove categories to organize your spending.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                           <div className="space-y-4">
                                {isLoading ? <Loader2 className="animate-spin" /> : categories.map(cat => (
                                    <div key={cat.name} className="flex items-center justify-between rounded-lg border p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{backgroundColor: cat.color}}>
                                                <Palette className="size-4 text-white"/>
                                            </div>
                                            <span>{cat.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input type="color" value={cat.color} className="h-8 w-8 appearance-none border-none bg-transparent p-0 cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none" disabled/>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat)}>
                                                <Trash2 className="size-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                           </div>
                           <form onSubmit={handleAddCategory} className="flex items-end gap-4">
                               <div className="flex-grow space-y-2">
                                   <Label htmlFor="new-category">New Category Name</Label>
                                   <Input id="new-category" placeholder="e.g. Health" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                               </div>
                               <Button type="submit" disabled={isSubmitting}>
                                 {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                 Add Category
                                </Button>
                           </form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
