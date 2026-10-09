import { redirect } from "next/navigation";
import { SessionGuard } from "@/features/auth/components/SessionGuard";
import { readSession } from "@/features/auth/lib/auth-server";
import WorkspaceScreen from "@/screens/WorkspaceScreen";

export default async function Home() {
  const { data: session, error } = await readSession();
  if (error) throw new Error("Authentication is temporarily unavailable.");
  if (!session?.user) redirect("/auth/sign-in");
  if (!session.user.emailVerified) redirect("/auth/verify");
  return (
    <SessionGuard>
      <WorkspaceScreen />
    </SessionGuard>
  );
}
