
import { Logo } from "./logo";

export function SplashScreen() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <div className="animate-pulse">
        <Logo className="size-24" />
      </div>
      <p className="mt-4 text-muted-foreground animate-pulse">
        Loading your financial hub...
      </p>
    </div>
  );
}
