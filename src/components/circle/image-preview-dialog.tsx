"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Download } from 'lucide-react';

interface ImagePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
}

export function ImagePreviewDialog({ isOpen, onClose, imageUrl }: ImagePreviewDialogProps) {
    if (!isOpen) return null;

    const handleDownload = () => {
        // This creates a temporary link to trigger the download
        const link = document.createElement('a');
        link.href = imageUrl;
        // The 'download' attribute suggests a filename to the browser
        link.setAttribute('download', 'image.jpg'); 
        link.setAttribute('target', '_blank'); // Open in new tab as fallback
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-4xl h-auto p-2 sm:p-4">
                <DialogHeader className="sr-only">
                    <DialogTitle>Image Preview</DialogTitle>
                    <DialogDescription>A larger preview of the selected image from the chat.</DialogDescription>
                </DialogHeader>
                <div className="relative w-full h-[75vh] sm:h-[85vh]">
                    <Image 
                        src={imageUrl} 
                        alt="Image Preview" 
                        layout="fill"
                        objectFit="contain"
                    />
                </div>
                <DialogFooter className="sm:justify-end mt-2 sm:mt-0">
                    <Button onClick={handleDownload} size="sm">
                        <Download className="mr-2" /> Download
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}