
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Package, Users, History, PlusCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { SetupBusinessProfileDialog } from '@/components/sales-scribe/setup-business-profile-dialog';
import { useData } from '@/hooks/use-data';
import { AddSaleDialog } from '@/components/sales-scribe/add-sale-dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const scribeNavItems = [
  { href: '/sales-scribe', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sales-scribe/products', label: 'Products', icon: Package },
  { href: '/sales-scribe/customers', label: 'Customers', icon: Users },
  { href: '/sales-scribe/history', label: 'History', icon: History },
];

export default function SalesScribeLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { userData } = useAuth();
    const { refreshData } = useData();
    const [isSetupOpen, setIsSetupOpen] = React.useState(false);
    const [isAddSaleOpen, setIsAddSaleOpen] = React.useState(false);

    React.useEffect(() => {
        if (userData && userData.accountType !== 'business') {
            router.push('/dashboard');
        } else if (userData && userData.accountType === 'business' && !userData.businessProfile?.isSetup) {
            setIsSetupOpen(true);
        }
    }, [userData, router]);

    const handleSaleAdded = () => {
      refreshData();
      setIsAddSaleOpen(false);
    }
    
    if (!userData || userData.accountType !== 'business') {
        return null;
    }

    if (!userData.businessProfile?.isSetup) {
        return (
             <SetupBusinessProfileDialog 
                open={isSetupOpen} 
                onOpenChange={setIsSetupOpen} 
                onProfileSetup={refreshData} 
            />
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold font-headline">SalesScribe</h1>
                        <Badge variant="outline">Beta</Badge>
                    </div>
                    <p className="text-muted-foreground">Your business sales and income tracker.</p>
                </div>
                <Button onClick={() => setIsAddSaleOpen(true)} className="w-full sm:w-auto">
                    <PlusCircle className="mr-2" /> Add New Sale
                </Button>
            </div>

            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Feature in Development</AlertTitle>
                <AlertDescription>
                    SalesScribe is a new feature and is currently in beta. Some functionalities may not work as expected.
                </AlertDescription>
            </Alert>
            
            <nav className="overflow-x-auto pb-2">
                <div className="flex items-center gap-2 border-b">
                    {scribeNavItems.map(item => (
                        <Link key={item.href} href={item.href}>
                            <div className={cn(
                                'flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary',
                                pathname === item.href && 'border-b-2 border-primary text-primary'
                            )}>
                                <item.icon className="size-5 shrink-0" />
                                <span className="hidden sm:inline">{item.label}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </nav>

            <main className="min-w-0">
                {children}
            </main>
            
            <AddSaleDialog 
                open={isAddSaleOpen}
                onOpenChange={setIsAddSaleOpen}
                onSaleAdded={handleSaleAdded}
            />
        </div>
    );
}
