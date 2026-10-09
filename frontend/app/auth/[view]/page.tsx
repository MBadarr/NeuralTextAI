import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthScreen, type AuthView } from "@/components/AuthScreen";
import { readSession } from "@/lib/auth-server";

const titles = {
  "sign-in": "Sign in",
  "sign-up": "Create account",
  verify: "Verify email",
  callback: "Connecting",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ view: string }>;
}): Promise<Metadata> {
  const { view } = await params;
  return {
    title: `${titles[view as keyof typeof titles] || "Authentication"} | NeuralText`,
    robots: { index: false, follow: false },
  };
}

export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<{
    error?: string;
    verified?: string;
    password?: string;
  }>;
}) {
  const { view } = await params;
  if (!Object.hasOwn(titles, view)) notFound();
  const query = await searchParams;
  // Remove fields from any legacy GET form submission; current forms only use POST.
  if (query.password !== undefined) redirect(`/auth/${view}`);
  const { data: session, error } = await readSession();
  if (error)
    throw new Error(
      "Authentication is temporarily unavailable. Please try again.",
    );
  if (view === "callback") {
    if (!session?.user) redirect("/auth/sign-in?error=oauth");
    redirect(session.user.emailVerified ? "/" : "/auth/verify");
  }
  if (session?.user.emailVerified) redirect("/");
  return (
    <AuthScreen
      view={view as AuthView}
      callbackError={query.error === "oauth"}
      verified={query.verified === "1"}
      initialEmail={view === "verify" ? session?.user.email : undefined}
    />
  );
}
