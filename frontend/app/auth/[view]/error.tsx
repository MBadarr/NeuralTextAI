"use client";

import { ThemeToggle } from "@/components/ThemeProvider";
import { authFallbackClass, authSubmitClass } from "@/lib/auth-styles";

export default function AuthError({ reset }: { reset: () => void }) {
  return (
    <main className={authFallbackClass}>
      <ThemeToggle />
      <h1>We couldn’t connect</h1>
      <p>
        Authentication is temporarily unavailable. Please try again in a moment.
      </p>
      <button className={authSubmitClass} type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
