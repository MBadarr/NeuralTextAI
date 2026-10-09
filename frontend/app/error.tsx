"use client";

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <main className="auth-fallback">
      <h1>We couldn’t open your workspace</h1>
      <p>Please try again in a moment.</p>
      <button type="button" className="auth-submit" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
