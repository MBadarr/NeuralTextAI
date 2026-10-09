"use client";

import {
  authFallbackClass,
  authSubmitClass,
} from "@/features/auth/lib/auth-styles";
import { Button } from "@/ui/Button";

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <main className={authFallbackClass}>
      <h1>We couldn’t open your workspace</h1>
      <p>Please try again in a moment.</p>
      <Button type="button" className={authSubmitClass} onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
