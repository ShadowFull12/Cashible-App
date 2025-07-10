
"use client";

import React, { useMemo, useEffect, useState } from 'react';
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import { useData } from '@/hooks/use-data';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Transaction } from '@/lib/data';
import { useIsMobile } from '@/hooks/use-mobile';

export default function SalesHistoryPage() {
    const { sales, isLoading } = useData();
    const { userData } = useAuth();
    const isMobile = useIsMobile();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);
    
    const generateInvoice = (sale: Transaction) => {
        if (!sale.saleDetails || !userData?.businessProfile) return;
        
        const doc = new jsPDF();
        const businessProfile = userData.businessProfile;

        if (businessProfile.logoUrl) {
           try {
                doc.addImage(businessProfile.logoUrl, 'PNG', 15, 10, 30, 30, undefined, 'FAST');
           } catch(e) {
                console.error("Could not add logo to PDF, likely due to CORS.", e)
           }
        }
        doc.setFontSize(22);
        doc.text(businessProfile.name, doc.internal.pageSize.getWidth() / 2, 25, { align: 'center' });
        doc.setFontSize(12);
        doc.text('Tax Invoice', doc.internal.pageSize.getWidth() / 2, 35, { align: 'center' });

        doc.setFontSize(10);
        doc.text(`Invoice #${sale.id?.slice(0, 8).toUpperCase()}`, 15, 50);
        doc.text(`Date: ${format(sale.date, 'PPP')}`, 15, 55);
        if (sale.saleDetails.customerName) {
            doc.text(`Bill to: ${sale.saleDetails.customerName}`, 15, 60);
        }

        autoTable(doc, {
            startY: 70,
            head: [['Item', 'Quantity', 'Unit Price', 'Total']],
            body: sale.saleDetails.items.map(item => [
                item.name,
                item.quantity,
                `Rs. ${item.price.toFixed(2)}`,
                `Rs. ${(item.quantity * item.price).toFixed(2)}`
            ]),
            theme: 'striped',
            headStyles: { fillColor: [22, 163, 74] }
        });

        let finalY = (doc as any).lastAutoTable.finalY + 10;
        const rightAlign = doc.internal.pageSize.getWidth() - 15;
        doc.setFontSize(12);
        doc.text(`Subtotal: Rs. ${sale.saleDetails.items.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2)}`, rightAlign, finalY, { align: 'right' });
        finalY += 7;
        doc.setFont('helvetica', 'bold');
        doc.text(`Final Amount: Rs. ${Math.abs(sale.amount).toFixed(2)}`, rightAlign, finalY, { align: 'right' });
        finalY += 7;
        doc.setFont('helvetica', 'normal');
        
        doc.text(`Payment Status: ${sale.saleDetails.paymentStatus.charAt(0).toUpperCase() + sale.saleDetails.paymentStatus.slice(1)}`, rightAlign, finalY, { align: 'right' });
        finalY += 7;
        if(sale.saleDetails.paymentStatus === 'partial' && sale.saleDetails.amountPaid) {
             doc.text(`Amount Paid: Rs. ${sale.saleDetails.amountPaid.toFixed(2)}`, rightAlign, finalY, { align: 'right' });
             finalY += 7;
        }
        const amountDue = Math.abs(sale.amount) - (sale.saleDetails.amountPaid || 0);
        if (amountDue > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(220, 53, 69); // Red color for due amount
            doc.text(`Amount Due: Rs. ${amountDue.toFixed(2)}`, rightAlign, finalY, { align: 'right' });
        }

        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text('Thank you for your business!', doc.internal.pageSize.getWidth() / 2, pageHeight - 15, { align: 'center' });

        doc.save(`Invoice-${sale.id?.slice(0, 8)}.pdf`);
    };

    const renderDesktopTable = () => (
        <div className="relative w-full overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount Paid</TableHead>
                        <TableHead className="text-right">Invoice</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                     {isLoading && Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
                        </TableRow>
                    ))}
                    {!isLoading && sales.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                No sales recorded yet. Use the "Add New Sale" button to start.
                            </TableCell>
                        </TableRow>
                    )}
                    {!isLoading && sales.map((sale) => (
                        <TableRow key={sale.id}>
                            <TableCell>{format(sale.date, 'dd MMM, yyyy')}</TableCell>
                            <TableCell>
                                <p className="font-medium">{sale.description}</p>
                                {sale.saleDetails?.customerName && <p className="text-sm text-muted-foreground">Customer: {sale.saleDetails.customerName}</p>}
                            </TableCell>
                            <TableCell>
                                <Badge variant={sale.saleDetails?.paymentStatus === 'paid' ? 'default' : sale.saleDetails?.paymentStatus === 'partial' ? 'secondary' : 'destructive'}>
                                    {sale.saleDetails?.paymentStatus}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-green-500">+₹{sale.saleDetails?.amountPaid.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => generateInvoice(sale)}>
                                    <Download className="size-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
    
    const renderMobileCards = () => (
        <div className="space-y-3">
             {isLoading && Array.from({ length: 5 }).map((_, i) => (
                 <Card key={i} className="p-4"><Skeleton className="h-20 w-full" /></Card>
             ))}
             {!isLoading && sales.length === 0 && (
                <div className="text-center text-muted-foreground py-10">
                     No sales recorded yet.
                </div>
            )}
            {!isLoading && sales.map((sale) => (
                <Card key={sale.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="font-semibold">{sale.description}</p>
                            <p className="text-xs text-muted-foreground">{format(sale.date, 'PPP')}</p>
                        </div>
                        <p className="font-bold text-lg text-green-500 shrink-0 ml-2">+₹{sale.saleDetails?.amountPaid.toFixed(2)}</p>
                    </div>
                    {sale.saleDetails?.customerName && <p className="text-sm text-muted-foreground mb-2">Customer: {sale.saleDetails.customerName}</p>}
                    <div className="flex justify-between items-center">
                        <Badge variant={sale.saleDetails?.paymentStatus === 'paid' ? 'default' : sale.saleDetails?.paymentStatus === 'partial' ? 'secondary' : 'destructive'}>
                            {sale.saleDetails?.paymentStatus}
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={() => generateInvoice(sale)}>
                            <Download className="size-4" />
                        </Button>
                    </div>
                </Card>
            ))}
        </div>
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sales History</CardTitle>
                <CardDescription>A log of all your recorded sales. You can download an invoice for each sale.</CardDescription>
            </CardHeader>
            <CardContent>
                {isClient ? (isMobile ? renderMobileCards() : renderDesktopTable()) : <Skeleton className="h-64 w-full" />}
            </CardContent>
        </Card>
    );
}
