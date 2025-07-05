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

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        console.error("ImgBB API Error:", result);
        throw new Error(result?.error?.message || "Failed to upload image via ImgBB.");
    }

    return result.data.url;
}
