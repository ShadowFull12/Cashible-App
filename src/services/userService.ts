import { db, storage } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function updateUser(userId: string, data: object) {
    if (!db) throw new Error("Firestore is not initialized.");
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, data);
}

export async function uploadProfileImage(userId: string, file: File): Promise<string> {
    if (!storage) throw new Error("Firebase Storage is not initialized.");
    
    const fileExtension = file.name.split('.').pop();
    const storageRef = ref(storage, `avatars/${userId}.${fileExtension}`);
    
    await uploadBytes(storageRef, file);
    
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
}
