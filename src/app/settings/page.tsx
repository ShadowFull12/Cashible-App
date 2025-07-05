import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Trash2 } from "lucide-react";

const categories = [
  { id: 1, name: "Groceries", color: "#22c55e" },
  { id: 2, name: "Food", color: "#ef4444" },
  { id: 3, name: "Entertainment", color: "#a855f7" },
  { id: 4, name: "Utilities", color: "#eab308" },
  { id: 5, name: "Transport", color: "#f97316" },
];

const accentColors = [
    { name: "Electric Blue", color: "#7DF9FF" },
    { name: "Sunny Orange", color: "#f97316" },
    { name: "Vibrant Pink", color: "#ec4899" },
    { name: "Lush Green", color: "#22c55e" },
    { name: "Royal Purple", color: "#8b5cf6" },
];

export default function SettingsPage() {
  return (
    <div className="grid gap-6">
        <h1 className="text-3xl font-bold font-headline">Settings</h1>
        <Tabs defaultValue="profile">
            <TabsList>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="categories">Categories</TabsTrigger>
                <TabsTrigger value="appearance">Appearance</TabsTrigger>
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
                            <Input id="username" defaultValue="Jane Doe" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" defaultValue="jane.doe@example.com" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="currency">Default Currency</Label>
                             <Select defaultValue="inr">
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="inr">INR (₹)</SelectItem>
                                    <SelectItem value="usd">USD ($)</SelectItem>
                                    <SelectItem value="eur">EUR (€)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button>Save Changes</Button>
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
                            {categories.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{backgroundColor: cat.color}}>
                                            <Palette className="size-4 text-white"/>
                                        </div>
                                        <span>{cat.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="color" defaultValue={cat.color} className="h-8 w-8 appearance-none border-none bg-transparent p-0 cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"/>
                                        <Button variant="ghost" size="icon">
                                            <Trash2 className="size-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                       </div>
                       <div className="flex items-end gap-4">
                           <div className="flex-grow space-y-2">
                               <Label htmlFor="new-category">New Category Name</Label>
                               <Input id="new-category" placeholder="e.g. Health" />
                           </div>
                           <Button>Add Category</Button>
                       </div>
                    </CardContent>
                </Card>
            </TabsContent>
             <TabsContent value="appearance" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Appearance</CardTitle>
                        <CardDescription>Customize the look and feel of the app.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Theme Accent Color</Label>
                             <div className="flex flex-wrap gap-3">
                                {accentColors.map(color => (
                                    <Button key={color.name} variant="outline" className="h-16 w-32 flex flex-col gap-2">
                                        <div className="h-6 w-full rounded" style={{ backgroundColor: color.color }}></div>
                                        <span>{color.name}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <Button>Save Changes</Button>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  )
}
