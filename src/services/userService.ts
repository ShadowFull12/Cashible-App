import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export async function updateUser(userId: string, data: object) {
    if (!db) throw new Error("Firestore is not initialized.");
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, data);
}

export async function uploadProfileImage(file: File): Promise<string> {
    const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
    if (!apiKey) {
        throw new Error("ImgBB API key is not configured. Please add it to your .env.local file.");
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("ImgBB API Error - Non-OK response:", { 
                status: response.status, 
                statusText: response.statusText,
                body: errorText 
            });
            throw new Error(`Failed to upload image. Server responded with ${response.status}: ${errorText || response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
            console.error("ImgBB API Error - Success False:", result);
            throw new Error(result?.error?.message || "Upload failed due to a generic API error.");
        }

        return result.data.url;
    } catch (error) {
        console.error("Error during image upload fetch/parse:", error);
        if (error instanceof Error) {
           throw new Error(`A network or parsing error occurred: ${error.message}`);
        }
        throw new Error("An unknown error occurred during image upload.");
    }
}
