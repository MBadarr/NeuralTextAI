"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeProvider";
import { getHealth } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useWorkspaceStore } from "@/lib/workspace-store";

export function Topbar() {
  const { active, query, setQuery, toggleMobile } = useWorkspaceStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [showStatus, setShowStatus] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const { data: session } = authClient.useSession();
  async function signOut() {
    setSigningOut(true);
    setSignOutError("");
    try {
      const result = await authClient.signOut();
      if (result.error)
        throw new Error(result.error.message || "Sign out failed.");
      window.location.replace("/auth/sign-in");
    } catch (reason) {
      setSignOutError(
        reason instanceof Error
          ? reason.message
          : "Sign out failed. Please retry.",
      );
      setSigningOut(false);
    }
  }
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  async function checkStatus() {
    setShowStatus(true);
    setStatus("Checking service...");
    try {
      const health = await getHealth();
      setStatus(
        `${health.trained ? "NLP ready" : "Limited model"} · ${health.model} · ${health.storage}`,
      );
    } catch (reason) {
      setStatus(
        reason instanceof Error ? reason.message : "Service unavailable.",
      );
    }
  }
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-workspace-border bg-workspace-surface/95 px-3.5 backdrop-blur-md sm:h-18 sm:px-4.5 lg:px-10.5">
      <button
        type="button"
        className="block text-workspace-muted lg:hidden"
        onClick={toggleMobile}
        aria-label="Toggle navigation"
      >
        <span className="text-lg transition-transform duration-200">☰</span>
      </button>
      <div className="flex items-center gap-2.5 text-xs text-workspace-muted">
        <span>Workspace</span>
        <b>/</b>
        <strong className="text-workspace-text">{active}</strong>
      </div>
      <div className="flex items-center gap-4.25">
        <ThemeToggle />
        <span
          className="hidden max-w-32 truncate text-xs sm:block"
          title={session?.user.email}
        >
          {session?.user.name || session?.user.email}
        </span>
        <div className="relative">
          <button
            type="button"
            className="text-xs text-workspace-accent"
            disabled={signingOut}
            onClick={signOut}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          {signOutError && (
            <p
              role="alert"
              className="auth-message auth-error absolute right-0 top-8 w-64"
            >
              {signOutError}
            </p>
          )}
        </div>
        <div className="hidden w-57.5 items-center gap-2 rounded-lg border border-workspace-border bg-workspace-bg p-2.5 text-workspace-muted sm:flex">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            aria-label="Search workspace documents"
            maxLength={1000}
            className="w-full bg-transparent text-[11px] outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents..."
          />
          <kbd className="whitespace-nowrap rounded border border-workspace-border bg-workspace-surface px-1.5 py-0.5 text-[9px]">
            Ctrl K
          </kbd>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => (showStatus ? setShowStatus(false) : checkStatus())}
            aria-expanded={showStatus}
            className="text-xs text-workspace-accent"
          >
            Service status
          </button>
          {showStatus && (
            <output className="absolute right-0 top-8 w-64 rounded-lg border border-workspace-border bg-workspace-surface p-3 text-xs leading-6 shadow-lg">
              {status}
            </output>
          )}
        </div>
      </div>
    </header>
  );
}
