import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { readSession } from "@/features/auth/lib/auth-server";
import type { AuthView } from "@/features/auth/types/auth";
import { AuthScreen } from "@/screens/AuthScreen";

const titles = {
  "sign-in": "Sign in",
  "sign-up": "Create account",
  verify: "Verify email",
  callback: "Connecting",
  "forgot-password": "Forgot password",
  "reset-password": "Reset password",
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
    reset?: string;
  }>;
}) {
  const { view } = await params;
  if (!Object.hasOwn(titles, view)) notFound();
  const query = await searchParams;
  // Remove fields from any legacy GET form submission; current forms only use POST.
  if (query.password !== undefined) redirect(`/auth/${view}`);
  if (view === "forgot-password" || view === "reset-password")
    return <AuthScreen key={view} view={view} />;
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
      key={view}
      view={view as AuthView}
      callbackError={query.error === "oauth"}
      verified={query.verified === "1"}
      passwordReset={query.reset === "1"}
      initialEmail={view === "verify" ? session?.user.email : undefined}
    />
  );
}
