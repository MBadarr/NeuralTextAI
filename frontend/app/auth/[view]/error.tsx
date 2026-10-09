"use client";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  authFallbackClass,
  authSubmitClass,
} from "@/features/auth/lib/auth-styles";
import { Button } from "@/ui/Button";

export default function AuthError({ reset }: { reset: () => void }) {
  return (
    <main className={authFallbackClass}>
      <ThemeToggle />
      <h1>We couldn’t connect</h1>
      <p>
        Authentication is temporarily unavailable. Please try again in a moment.
      </p>
      <Button className={authSubmitClass} type="button" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
