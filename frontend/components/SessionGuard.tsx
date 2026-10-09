"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { authClient } from "@/lib/auth-client";
import { authFallbackClass, authSubmitClass } from "@/lib/auth-styles";
import { useWorkspaceStore } from "@/lib/workspace-store";

export function SessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data, isPending, error, refetch } = authClient.useSession();
  const [hydratedUser, setHydratedUser] = useState<string | null>(null);
  const userId = data?.user.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    useWorkspaceStore.persist.setOptions({
      name: `neuraltext-workspace:${userId}`,
    });
    void Promise.resolve(useWorkspaceStore.persist.rehydrate()).then(() => {
      if (!cancelled) setHydratedUser(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  useEffect(() => {
    if (!isPending && !error) {
      if (!data?.user) router.replace("/auth/sign-in");
      else if (!data.user.emailVerified) router.replace("/auth/verify");
    }
  }, [data, isPending, error, router]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void refetch();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [refetch]);
  if (error)
    return (
      <main className={authFallbackClass}>
        <h1>Session check unavailable</h1>
        <p>We couldn’t confirm your session. Please retry.</p>
        <button
          type="button"
          className={authSubmitClass}
          onClick={() => {
            void refetch();
          }}
        >
          Try again
        </button>
      </main>
    );
  if (isPending || !data?.user.emailVerified || hydratedUser !== userId)
    return <LoadingIndicator fullScreen label="Loading workspace" />;
  return children;
}
