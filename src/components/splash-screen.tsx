
import { Logo } from "./logo";
import { Loader2 } from "lucide-react";

export function SplashScreen() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <Logo className="size-24" />
      <Loader2 className="mt-6 h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
