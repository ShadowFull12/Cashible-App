
"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Trash2, Loader2, Sun, Moon, Laptop, Upload, CheckCircle2, Repeat, PauseCircle, PlayCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useData } from "@/hooks/use-data";
import React, { useState, useRef, useEffect } from "react";
import { addCategory, deleteCategory, updateCategory } from "@/services/categoryService";
import { deleteRecurringExpense, deleteRecurringExpenseAndHistory } from "@/services/recurringExpenseService";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { RecurringExpense } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";


const passwordSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required." }),
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
});

const emailSchema = z.object({
  newEmail: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required to change email." }),
});

const usernameSchema = z.object({
  newUsername: z.string().min(3, { message: "Username must be 3-15 characters long."}).regex(/^[a-zA-Z0-9_]{3,15}$/, { message: "Username can only contain letters, numbers, and underscores."}),
  password: z.string().min(1, { message: "Password is required to change username." }),
});

const primaryColors = [
    { name: 'Teal', value: '181 95% 45%' },
    { name: 'Rose', value: '340 82% 52%' },
    { name: 'Blue', value: '217 91% 60%' },
    { name: 'Orange', value: '25 88% 55%' },
    { name: 'Violet', value: '262 83% 58%' },
    { name: 'Lime', value: '84 81% 44%' },
];

function DangerZone() {
    const { user, updateUserProfile, deleteAccount, reauthenticateWithPassword, deleteAllUserData } = useAuth();
    const router = useRouter();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [actionType, setActionType] = useState<'deleteData' | 'deleteAccount' | null>(null);
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const dialogTitle = actionType === 'deleteData' ? 'Delete All Your Data?' : 'Delete Your Account?';
    const dialogDescription = actionType === 'deleteData' 
        ? "This will permanently delete all your transactions, circles, friends, and notifications. Your account will not be deleted, and you can start fresh."
        : "This will permanently delete your account and all associated data. This action is irreversible.";

    const handleConfirm = async () => {
        if (!actionType) return;
        setIsLoading(true);
        try {
            await reauthenticateWithPassword(password);
            
            if (actionType === 'deleteData') {
                await deleteAllUserData();
                toast.success("All your data has been deleted.", { description: "Your account has been reset."});
                setDialogOpen(false);
                router.push('/dashboard');
            } else if (actionType === 'deleteAccount') {
                await deleteAccount();
                toast.success("Your account has been permanently deleted.", { description: "We're sad to see you go."});
                router.push('/');
            }
        } catch (error: any) {
            toast.error("Action failed", { description: error.message || "Please check your password and try again." });
        } finally {
            setIsLoading(false);
            setPassword('');
        }
    };

    const openConfirmation = (type: 'deleteData' | 'deleteAccount') => {
        setActionType(type);
        setDialogOpen(true);
    };

    return (
        <Card className="border-destructive">
            <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2"><ShieldAlert /> Danger Zone</CardTitle>
                <CardDescription>These are irreversible actions. Please proceed with caution.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
                    <div>
                        <h4 className="font-semibold">Delete All Data</h4>
                        <p className="text-sm text-muted-foreground">Reset your account to its initial state.</p>
                    </div>
                    <Button variant="destructive" onClick={() => openConfirmation('deleteData')}>Delete Data</Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
                    <div>
                        <h4 className="font-semibold">Delete Account</h4>
                        <p className="text-sm text-muted-foreground">Permanently remove your account and all data.</p>
                    </div>
                     <Button variant="destructive" onClick={() => openConfirmation('deleteAccount')}>Delete Account</Button>
                </div>
            </CardContent>
             <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{dialogTitle}</DialogTitle>
                        <DialogDescription>{dialogDescription}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                        <Label htmlFor="password-confirm">To confirm, please enter your password:</Label>
                        <Input 
                            id="password-confirm" 
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                        <Button variant="destructive" onClick={handleConfirm} disabled={isLoading || password.length < 6}>
                            {isLoading && <Loader2 className="mr-2 animate-spin" />}
                            Confirm & Proceed
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}


export default function SettingsPage() {
    const { user, userData, updateUserProfile, uploadAndSetProfileImage, updateUserPassword, updateUserEmail, updateUserUsername } = useAuth();
    const { categories, recurringExpenses, isLoading, refreshData } = useData();
    const { theme, setTheme } = useTheme();

    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryColor, setNewCategoryColor] = useState("#22c55e");
    const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
    const [budget, setBudget] = useState(userData?.budget || 0);
    const [isSavingBudget, setIsSavingBudget] = useState(false);

    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const [categoryColors, setCategoryColors] = useState<{[key: string]: string}>({});
    const [originalCategoryColors, setOriginalCategoryColors] = useState<{[key: string]: string}>({});
    const [savingColor, setSavingColor] = useState<string | null>(null);
    const [deletingExpense, setDeletingExpense] = useState<RecurringExpense | null>(null);
    
    const isImgBbConfigured = !!process.env.NEXT_PUBLIC_IMGBB_API_KEY;

    const passwordForm = useForm<z.infer<typeof passwordSchema>>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { currentPassword: "", newPassword: "" },
    });

    const emailForm = useForm<z.infer<typeof emailSchema>>({
        resolver: zodResolver(emailSchema),
        defaultValues: { newEmail: user?.email || "", password: "" },
    });

    const usernameForm = useForm<z.infer<typeof usernameSchema>>({
        resolver: zodResolver(usernameSchema),
        defaultValues: { newUsername: userData?.username || "", password: "" },
    });
    
    useEffect(() => {
        if (userData) {
            setBudget(userData.budget || 0);
            usernameForm.reset({ newUsername: userData.username || "", password: "" });
        }
        if (user?.photoURL) {
            setAvatarPreview(user.photoURL);
        }
    }, [userData, user?.photoURL, usernameForm]);


    useEffect(() => {
        if (categories) {
            const colors = categories.reduce((acc, cat) => {
                acc[cat.name] = cat.color;
                return acc;
            }, {} as {[key: string]: string});
            setCategoryColors(colors);
            setOriginalCategoryColors(colors);
        }
    }, [categories]);

    const userInitial = user?.displayName ? user.displayName.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U');

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newCategoryName) return;
        if (categories.some(cat => cat.name.toLowerCase() === newCategoryName.toLowerCase())) {
            toast.error("Category with this name already exists.");
            return;
        }
        setIsSubmittingCategory(true);
        try {
            const newCategory = { name: newCategoryName, color: newCategoryColor };
            await addCategory(user.uid, newCategory);
            setNewCategoryName("");
            setNewCategoryColor("#22c55e");
            toast.success("Category added!");
            await refreshData();
        } catch (error) {
            toast.error("Failed to add category.");
        } finally {
            setIsSubmittingCategory(false);
        }
    };
    
    const handleDeleteCategory = async (categoryName: string) => {
        if (!user) return;
        const categoryToDelete = categories.find(c => c.name === categoryName);
        if (!categoryToDelete) return;
        try {
            await deleteCategory(user.uid, categoryToDelete);
            toast.success("Category deleted!");
            await refreshData();
        } catch (error) {
            toast.error("Failed to delete category.");
        }
    };
    
    const handleCategoryColorChange = async (categoryName: string) => {
        if (!user) return;
        setSavingColor(categoryName);
        const newColor = categoryColors[categoryName];
        try {
            await updateCategory(user.uid, categoryName, newColor);
            await refreshData();
            toast.success(`Color for ${categoryName} updated.`);
        } catch (error) {
            toast.error("Failed to update category color.");
             setCategoryColors(prev => ({...prev, [categoryName]: originalCategoryColors[categoryName]}));
        } finally {
            setSavingColor(null);
        }
    };

    const handleLocalColorChange = (categoryName: string, newColor: string) => {
        setCategoryColors(prev => ({...prev, [categoryName]: newColor}));
    };


    const handleSaveBudget = async () => {
        setIsSavingBudget(true);
        try {
            await updateUserProfile({ budget });
            toast.success("Budget updated successfully!");
        } catch (error) {
            toast.error("Failed to update budget.");
        } finally {
            setIsSavingBudget(false);
        }
    }

    const handlePrimaryColorChange = async (colorValue: string) => {
        try {
            await updateUserProfile({ primaryColor: colorValue });
            toast.success("Primary color updated!");
        } catch (error) {
            toast.error("Failed to update color.");
        }
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleAvatarUpload = async () => {
        if (!avatarFile) {
            toast.error("Please select an image first.");
            return;
        }
        setIsUploading(true);
        try {
            await uploadAndSetProfileImage(avatarFile);
            toast.success("Avatar updated successfully!");
            setAvatarFile(null);
        } catch (error: any) {
            toast.error("Failed to upload avatar.", { description: error.message });
            setAvatarPreview(user?.photoURL || null);
        } finally {
            setIsUploading(false);
        }
    };

    const onPasswordChange = async (values: z.infer<typeof passwordSchema>) => {
        try {
            await updateUserPassword(values.currentPassword, values.newPassword);
            toast.success("Password updated successfully.");
            passwordForm.reset();
        } catch (error: any) {
            toast.error("Password change failed.", { description: error.message });
        }
    };

    const onEmailChange = async (values: z.infer<typeof emailSchema>) => {
         try {
            await updateUserEmail(values.password, values.newEmail);
            toast.success("Email updated successfully. Please verify your new email address.");
            emailForm.reset({ newEmail: values.newEmail, password: "" });
        } catch (error: any) {
            toast.error("Email change failed.", { description: error.message });
        }
    }

    const onUsernameChange = async (values: z.infer<typeof usernameSchema>) => {
        if (userData?.username && values.newUsername.toLowerCase() === userData.username.toLowerCase()) {
            toast.info("This is already your username.");
            return;
        }
        try {
            await updateUserUsername(values.password, values.newUsername);
            toast.success("Username updated successfully.");
            usernameForm.reset({ newUsername: values.newUsername, password: "" });
        } catch (error: any) {
            usernameForm.setError("newUsername", { type: "manual", message: error.message });
            toast.error("Username change failed.", { description: error.message });
        }
    }
    
    const handleDeleteFuturePayments = async (expenseId: string) => {
        try {
            await deleteRecurringExpense(expenseId);
            await refreshData();
            toast.success("Recurring expense has been stopped.");
        } catch (error) {
            toast.error("Failed to stop recurring expense.");
        } finally {
            setDeletingExpense(null);
        }
    }
    
    const handleDeleteAndEraseHistory = async (expenseId: string) => {
        if (!user) {
            toast.error("You must be logged in to perform this action.");
            return;
        }
        try {
            await deleteRecurringExpenseAndHistory(user.uid, expenseId);
            await refreshData();
            toast.success("Recurring expense and its history deleted.");
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete recurring expense permanently.");
        } finally {
            setDeletingExpense(null);
        }
    }

    return (
        <div className="grid gap-6">
            <h1 className="text-3xl font-bold font-headline">Settings</h1>
            <div className="w-full overflow-x-auto pb-2">
                <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="w-max">
                        <TabsTrigger value="profile">Profile</TabsTrigger>
                        <TabsTrigger value="categories">Categories</TabsTrigger>
                        <TabsTrigger value="recurring">Recurring</TabsTrigger>
                        <TabsTrigger value="appearance">Appearance</TabsTrigger>
                        <TabsTrigger value="security">Security</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="profile" className="mt-6">
                        <Card>
                            <CardHeader><CardTitle>Profile Settings</CardTitle><CardDescription>Manage your personal information and account settings.</CardDescription></CardHeader>
                            <CardContent className="space-y-8">
                                {!isImgBbConfigured && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>Image Uploads Disabled</AlertTitle>
                                        <AlertDescription>
                                            An ImgBB API key is not configured. Please get a free key from <a href="https://api.imgbb.com/" target="_blank" rel="noopener noreferrer" className="underline">api.imgbb.com</a> and add it to your <code>.env.local</code> or <code>.env</code> file to enable avatar uploads.
                                        </AlertDescription>
                                    </Alert>
                                )}
                                <div className="flex items-center gap-6">
                                    <Avatar className="h-20 w-20"><AvatarImage src={avatarPreview || ''} alt="User Avatar" /><AvatarFallback>{userInitial}</AvatarFallback></Avatar>
                                    <div className="space-y-2">
                                        <Button size="sm" onClick={() => avatarInputRef.current?.click()} disabled={!isImgBbConfigured}><Upload className="mr-2" />Change Avatar</Button>
                                        <input type="file" accept="image/*" ref={avatarInputRef} onChange={handleAvatarChange} className="hidden" />
                                        {avatarFile && <Button size="sm" variant="secondary" onClick={handleAvatarUpload} disabled={isUploading}>{isUploading ? <Loader2 className="animate-spin" /> : "Save Avatar"}</Button>}
                                        <p className="text-xs text-muted-foreground">Recommended size: 200x200px</p>
                                    </div>
                                </div>
                                <div className="space-y-2"><Label htmlFor="displayName">Display Name</Label><Input id="displayName" value={user?.displayName || ''} disabled /></div>
                                <div className="space-y-2"><Label htmlFor="username">Username</Label><Input id="username" value={userData?.username || ''} disabled /></div>
                                <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={user?.email || ''} disabled /></div>
                                <div className="space-y-2">
                                    <Label htmlFor="budget">Monthly Budget (₹)</Label>
                                    <div className="flex items-center gap-4">
                                        <Input id="budget" type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} className="max-w-xs" />
                                        <Button onClick={handleSaveBudget} disabled={isSavingBudget}>{isSavingBudget && <Loader2 className="mr-2 animate-spin" />}Save Budget</Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="categories" className="mt-6">
                        <Card>
                            <CardHeader><CardTitle>Expense Categories</CardTitle><CardDescription>Add or remove categories to organize your spending.</CardDescription></CardHeader>
                            <CardContent className="space-y-6">
                            <div className="space-y-4">
                                    {isLoading ? <Loader2 className="animate-spin" /> : categories.map(cat => (
                                        <div key={cat.name} className="flex items-center justify-between rounded-lg border p-3">
                                            <div className="flex items-center gap-3">
                                                <input type="color" value={categoryColors[cat.name] || '#000000'} onChange={(e) => handleLocalColorChange(cat.name, e.target.value)} className="w-8 h-8 rounded-md border-none cursor-pointer" style={{backgroundColor: categoryColors[cat.name]}} />
                                                <span>{cat.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {categoryColors[cat.name] !== originalCategoryColors[cat.name] && (<Button size="sm" onClick={() => handleCategoryColorChange(cat.name)} disabled={savingColor === cat.name}>{savingColor === cat.name ? <Loader2 className="animate-spin"/> : 'Save'}</Button>)}
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat.name)}><Trash2 className="size-4 text-red-500" /></Button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                            <form onSubmit={handleAddCategory} className="flex items-end gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="new-category-color">Color</Label>
                                        <Input type="color" id="new-category-color" value={newCategoryColor} onChange={e => setNewCategoryColor(e.target.value)} className="w-16 p-1" />
                                    </div>
                                <div className="flex-grow space-y-2">
                                    <Label htmlFor="new-category">New Category Name</Label>
                                    <Input id="new-category" placeholder="e.g. Health" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                                </div>
                                <Button type="submit" disabled={isSubmittingCategory}>{isSubmittingCategory && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Category</Button>
                            </form>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="recurring" className="mt-6">
                        <Card>
                            <CardHeader><CardTitle>Recurring Payments</CardTitle><CardDescription>Manage your automated monthly expenses.</CardDescription></CardHeader>
                            <CardContent className="space-y-4">
                                {isLoading ? <Loader2 className="animate-spin" /> : recurringExpenses.length > 0 ? recurringExpenses.map(expense => (
                                    <div key={expense.id} className="flex items-center justify-between rounded-lg border p-3">
                                        <div className="flex-grow">
                                            <p className="font-medium">{expense.description}</p>
                                            <p className="text-sm text-muted-foreground">
                                                ₹{expense.amount.toLocaleString()} on day {expense.dayOfMonth} of each month
                                            </p>
                                            <Badge variant="outline">{expense.category}</Badge>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Badge variant={expense.isActive ? 'default' : 'secondary'} className={cn(expense.isActive ? 'bg-green-500/20 text-green-700 border-green-500/30' : 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30')}>
                                                {expense.isActive ? <PlayCircle className="mr-2"/> : <PauseCircle className="mr-2"/>}
                                                {expense.isActive ? 'Active' : 'Paused'}
                                            </Badge>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" onClick={() => setDeletingExpense(expense)}><Trash2 className="size-4 text-red-500" /></Button>
                                                </AlertDialogTrigger>
                                                {deletingExpense && deletingExpense.id === expense.id && (
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Recurring Expense?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Choose how to handle this recurring expense. This action cannot be fully undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <div className="flex flex-col gap-4 py-4">
                                                            <Button variant="outline" onClick={() => handleDeleteFuturePayments(deletingExpense.id!)}>Just Stop Future Payments</Button>
                                                            <Button variant="destructive" onClick={() => handleDeleteAndEraseHistory(deletingExpense.id!)}>Delete Permanently & Erase History</Button>
                                                        </div>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel onClick={() => setDeletingExpense(null)}>Cancel</AlertDialogCancel>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                )}
                                            </AlertDialog>
                                        </div>
                                    </div>
                                )) : <p className="text-muted-foreground text-center">No recurring expenses found. You can add one from the "Add Expense" dialog.</p>}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="appearance" className="mt-6">
                        <Card>
                            <CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Customize the look and feel of the application.</CardDescription></CardHeader>
                            <CardContent className="space-y-6">
                            <div className="space-y-2">
                                    <Label>Theme</Label>
                                    <div className="grid grid-cols-3 gap-4">
                                    <Button variant={theme === 'light' ? 'default' : 'outline'} onClick={() => setTheme('light')}><Sun className="mr-2"/> Light</Button>
                                    <Button variant={theme === 'dark' ? 'default' : 'outline'} onClick={() => setTheme('dark')}><Moon className="mr-2"/> Dark</Button>
                                    <Button variant={theme === 'system' ? 'default' : 'outline'} onClick={() => setTheme('system')}><Laptop className="mr-2"/> System</Button>
                                    </div>
                            </div>
                            <div className="space-y-2">
                                    <Label>Primary Color</Label>
                                    <div className="flex flex-wrap gap-3">
                                        {primaryColors.map((color) => (
                                            <button key={color.name} title={color.name} onClick={() => handlePrimaryColorChange(color.value)} className="h-10 w-10 rounded-full border-2 transition-all flex items-center justify-center" style={{ backgroundColor: `hsl(${color.value})`, borderColor: userData?.primaryColor === color.value ? `hsl(${color.value})` : 'transparent' }}>
                                                {userData?.primaryColor === color.value && <CheckCircle2 className="size-6 text-white" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="security" className="mt-6">
                        <Card>
                            <CardHeader><CardTitle>Security</CardTitle><CardDescription>Manage your password, email, and username.</CardDescription></CardHeader>
                            <CardContent className="space-y-8">
                                <div>
                                    <h3 className="text-lg font-medium mb-4">Change Username</h3>
                                    <Form {...usernameForm}>
                                        <form onSubmit={usernameForm.handleSubmit(onUsernameChange)} className="space-y-4 max-w-sm">
                                            <FormField control={usernameForm.control} name="newUsername" render={({ field }) => (<FormItem><FormLabel>New Username</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={usernameForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Current Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <Button type="submit" disabled={usernameForm.formState.isSubmitting}>{usernameForm.formState.isSubmitting && <Loader2 className="mr-2 animate-spin" />} Change Username</Button>
                                        </form>
                                    </Form>
                                </div>
                                <hr/>
                                <div>
                                    <h3 className="text-lg font-medium mb-4">Change Email</h3>
                                    <Form {...emailForm}>
                                        <form onSubmit={emailForm.handleSubmit(onEmailChange)} className="space-y-4 max-w-sm">
                                            <FormField control={emailForm.control} name="newEmail" render={({ field }) => (<FormItem><FormLabel>New Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={emailForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Current Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <Button type="submit" disabled={emailForm.formState.isSubmitting}>{emailForm.formState.isSubmitting && <Loader2 className="mr-2 animate-spin" />} Change Email</Button>
                                        </form>
                                    </Form>
                                </div>
                                 <hr/>
                                <div>
                                    <h3 className="text-lg font-medium mb-4">Change Password</h3>
                                    <Form {...passwordForm}>
                                        <form onSubmit={passwordForm.handleSubmit(onPasswordChange)} className="space-y-4 max-w-sm">
                                            <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (<FormItem><FormLabel>Current Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (<FormItem><FormLabel>New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <Button type="submit" disabled={passwordForm.formState.isSubmitting}>{passwordForm.formState.isSubmitting && <Loader2 className="mr-2 animate-spin" />} Change Password</Button>
                                        </form>
                                    </Form>
                                </div>
                            </CardContent>
                        </Card>
                        <div className="mt-6">
                            <DangerZone />
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
