import { redirect } from "next/navigation";
import { SessionGuard } from "@/components/SessionGuard";
import Workspace from "@/components/Workspace";
import { readSession } from "@/lib/auth-server";

export default async function Home() {
  const { data: session, error } = await readSession();
  if (error) throw new Error("Authentication is temporarily unavailable.");
  if (!session?.user) redirect("/auth/sign-in");
  if (!session.user.emailVerified) redirect("/auth/verify");
  return (
    <SessionGuard>
      <Workspace />
    </SessionGuard>
  );
}
