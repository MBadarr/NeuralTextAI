"use client";

import { ThemeToggle } from "@/components/ThemeProvider";

export default function AuthError({ reset }: { reset: () => void }) {
  return (
    <main className="auth-fallback">
      <ThemeToggle />
      <h1>We couldn’t connect</h1>
      <p>
        Authentication is temporarily unavailable. Please try again in a moment.
      </p>
      <button className="auth-submit" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
