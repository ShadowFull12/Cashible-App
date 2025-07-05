import { auth } from "@/lib/firebase";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateEmail } from "firebase/auth";

async function reauthenticate(password: string) {
    if (!auth?.currentUser) throw new Error("User not found or not authenticated.");
    const credential = EmailAuthProvider.credential(auth.currentUser.email!, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
}

export async function changePassword(currentPassword: string, newPassword: string) {
    if (!auth?.currentUser) throw new Error("User not found or not authenticated.");
    await reauthenticate(currentPassword);
    await updatePassword(auth.currentUser, newPassword);
}

export async function changeEmail(currentPassword: string, newEmail: string) {
    if (!auth?.currentUser) throw new Error("User not found or not authenticated.");
    await reauthenticate(currentPassword);
    await updateEmail(auth.currentUser, newEmail);
}
