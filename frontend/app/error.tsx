"use client";

import { authFallbackClass, authSubmitClass } from "@/lib/auth-styles";

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <main className={authFallbackClass}>
      <h1>We couldn’t open your workspace</h1>
      <p>Please try again in a moment.</p>
      <button type="button" className={authSubmitClass} onClick={reset}>
        Try again
      </button>
    </main>
  );
}
