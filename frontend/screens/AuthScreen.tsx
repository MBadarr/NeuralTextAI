"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { PasswordRecoveryForm } from "@/features/auth/components/PasswordRecoveryForm";
import { useAuthValidation } from "@/features/auth/hooks/use-auth-validation";
import { authClient } from "@/features/auth/lib/auth-client";
import {
  authErrorClass,
  authFieldClass,
  authMessageClass,
  authSubmitClass,
} from "@/features/auth/lib/auth-styles";
import type { AuthView } from "@/features/auth/types/auth";
import { Button } from "@/ui/Button";
import { FieldError } from "@/ui/FieldError";
import { Icon } from "@/ui/Icon";
import { Input } from "@/ui/Input";
import { LoadingIndicator } from "@/ui/LoadingIndicator";

type Verification = {
  email: string;
  type: "email-verification" | "sign-in";
  sentAt: number;
};
const verificationKey = "neuraltext-verification";

function rememberVerification(value: Verification) {
  try {
    sessionStorage.setItem(verificationKey, JSON.stringify(value));
  } catch {
    /* Verification also supports manual email entry. */
  }
}

export function AuthScreen({
  view,
  callbackError = false,
  verified = false,
  passwordReset = false,
  initialEmail = "",
}: {
  view: AuthView;
  callbackError?: boolean;
  verified?: boolean;
  passwordReset?: boolean;
  initialEmail?: string;
}) {
  const router = useRouter();
  const validation = useAuthValidation(view, initialEmail);
  const email = validation.values.email;
  const setEmail = validation.setEmail;
  const [verificationType, setVerificationType] =
    useState<Verification["type"]>("email-verification");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(
    callbackError
      ? "Google sign-in could not be completed. Please try again."
      : "",
  );
  const [notice, setNotice] = useState(
    passwordReset
      ? "Password reset successfully. Sign in with your new password."
      : verified
        ? "Email verified. Sign in to open your workspace."
        : "",
  );
  const [cooldown, setCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const signup = view === "sign-up";
  const verify = view === "verify";
  const recovery = view === "forgot-password" || view === "reset-password";

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!verify) return;
    try {
      const pending = JSON.parse(
        sessionStorage.getItem(verificationKey) || "null",
      ) as Verification | null;
      if (
        pending &&
        typeof pending.email === "string" &&
        (!initialEmail || pending.email === initialEmail) &&
        (pending.type === "sign-in" || pending.type === "email-verification")
      ) {
        setEmail(pending.email);
        setVerificationType(pending.type);
        if (pending.sentAt === 0)
          setNotice("If a code hasn't arrived, select Send a new code below.");
        setCooldown(
          Math.max(0, Math.ceil((pending.sentAt + 60000 - Date.now()) / 1000)),
        );
      }
    } catch {
      /* A malformed or unavailable storage entry should not block verification. */
    }
  }, [verify, initialEmail, setEmail]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function checkError(result: { error?: { message?: string } | null }) {
    if (result.error)
      throw new Error(
        result.error.message || "Unable to complete this request.",
      );
  }
  async function sendCode(type: Verification["type"], targetEmail: string) {
    const result = await authClient.emailOtp.sendVerificationOtp({
      email: targetEmail,
      type,
    });
    checkError(result);
    rememberVerification({ email: targetEmail, type, sentAt: Date.now() });
    setCooldown(60);
  }
  async function openWorkspace() {
    const result = await authClient.getSession({
      query: { disableCookieCache: true },
    });
    checkError(result);
    if (!result.data?.user) {
      router.replace("/auth/sign-in?verified=1");
      return;
    }
    if (!result.data.user.emailVerified) {
      router.replace("/auth/verify");
      return;
    }
    try {
      sessionStorage.removeItem(verificationKey);
    } catch {
      /* Optional UI state. */
    }
    router.replace("/");
    router.refresh();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const invalid = validation.validate(fields);
    if (invalid) {
      setError(invalid);
      return;
    }
    const targetEmail = String(fields.get("email") || "").trim();
    await run(async () => {
      if (verify) {
        const otp = String(fields.get("otp") || "").trim();
        const result =
          verificationType === "sign-in"
            ? await authClient.signIn.emailOtp({ email: targetEmail, otp })
            : await authClient.emailOtp.verifyEmail({
                email: targetEmail,
                otp,
              });
        checkError(result);
        await openWorkspace();
      } else if (signup) {
        const result = await authClient.signUp.email({
          email: targetEmail,
          password: String(fields.get("password")),
          name: String(fields.get("name")).trim(),
        });
        checkError(result);
        // Preserve the email even if delivery fails; the verification screen can resend.
        rememberVerification({
          email: targetEmail,
          type: "email-verification",
          sentAt: 0,
        });
        try {
          await sendCode("email-verification", targetEmail);
        } catch {
          /* Account exists now; let the user retry delivery from the verification screen. */
        }
        router.push("/auth/verify");
      } else {
        const result = await authClient.signIn.email({
          email: targetEmail,
          password: String(fields.get("password")),
          rememberMe: true,
        });
        if (result.error?.code === "EMAIL_NOT_VERIFIED") {
          rememberVerification({
            email: targetEmail,
            type: "email-verification",
            sentAt: 0,
          });
          router.push("/auth/verify");
          return;
        }
        checkError(result);
        if (result.data?.user && !result.data.user.emailVerified) {
          rememberVerification({
            email: targetEmail,
            type: "email-verification",
            sentAt: 0,
          });
        }
        await openWorkspace();
      }
    });
  }
  function google() {
    void run(async () => {
      checkError(
        await authClient.signIn.social({
          provider: "google",
          callbackURL: `${location.origin}/auth/callback`,
          errorCallbackURL: `${location.origin}/auth/sign-in?error=oauth`,
        }),
      );
    });
  }

  return (
    <main className="grid min-h-svh grid-cols-1 bg-workspace-bg text-workspace-text min-[761px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section
        className="relative hidden flex-col overflow-hidden bg-[radial-gradient(ellipse_at_20%_85%,#7854c4_0%,transparent_58%),radial-gradient(ellipse_at_100%_0%,#7e58d4_0%,transparent_55%)] bg-[#362465] px-8 pt-8 pb-8 text-white min-[761px]:flex min-[1051px]:px-14 min-[1051px]:pt-10.5 before:pointer-events-none before:absolute before:-top-70 before:-left-65 before:size-175 before:rounded-full before:border before:border-white/7 before:shadow-[0_0_0_80px_#ffffff04,0_0_0_160px_#ffffff03] before:content-['']"
        aria-label="About NeuralText"
      >
        <Link
          href="/auth/sign-in"
          className="relative inline-flex w-fit items-center text-[25px] font-bold tracking-[-1px] [&>span:last-child]:text-[#d3c4ff]"
        >
          <span className="mr-3 grid size-9.75 place-items-center rounded-xl border border-white/20 bg-white/8">
            <Icon name="spark" size={22} />
          </span>
          Neural<span>TextAI</span>
        </Link>
        <div className="relative my-auto max-w-110 self-center pt-16.25 pb-11.25 [&>h1]:mt-5.25 [&>h1]:text-[clamp(36px,3.5vw,54px)] [&>h1]:font-semibold [&>h1]:leading-[1.14] [&>h1]:tracking-[-2px] [&>p]:mt-5.75 [&>p]:max-w-91.25 [&>p]:text-sm [&>p]:leading-[1.8] [&>p]:text-[#e2d8f7]">
          <span className="block text-[10px] font-bold tracking-[0.16em] text-[#e1d4ff]">
            YOUR WORDS. MORE POSSIBILITY.
          </span>
          <h1>
            A little clarity.
            <br />A lot of potential.
          </h1>
          <p>
            Turn everyday text into meaningful insights. Your ideas, documents,
            and discoveries — together in one workspace.
          </p>
          <div
            className="mt-10.5 -rotate-2 rounded-[20px] border border-white/20 bg-linear-120 from-white/10 to-white/4 p-6.25 shadow-[0_20px_60px_#170b3b26] [&>p]:mt-6.25 [&>p]:text-lg [&>p]:leading-[1.7] [&>p]:tracking-[-0.4px]"
            aria-hidden="true"
          >
            <div className="flex items-center gap-2.5 text-xs font-semibold text-[#eee5ff]">
              <Icon name="scan" size={18} />
              <span>Clarity, at a glance</span>
              <span className="ml-auto size-1.75 rounded-full bg-[#b8edcf] shadow-[0_0_0_4px_#b8edcf16]" />
            </div>
            <p>Great ideas begin with a better understanding.</p>
            <div className="mt-4.5 flex gap-2.25 [&>span]:rounded-lg [&>span]:border [&>span]:border-[#d6c4ff]/20 [&>span]:bg-[#d6c4ff]/10 [&>span]:px-2.5 [&>span]:py-2 [&>span]:text-[11px] [&_small]:mt-1.25 [&_small]:block [&_small]:text-[7px] [&_small]:tracking-[0.1em] [&_small]:text-[#e1d1ff]">
              <span>
                Great ideas <small>KEY PHRASE</small>
              </span>
              <span>
                understanding <small>INSIGHT</small>
              </span>
            </div>
            <div className="mt-4 flex h-13.75 items-end gap-2 [&>i]:h-[32%] [&>i]:flex-1 [&>i]:rounded-t [&>i]:bg-[#ddccff]/30 [&>i:nth-child(2n)]:h-[55%] [&>i:nth-child(3n)]:h-[75%] [&>i:nth-child(3n)]:bg-[#e9dcff]/55 [&>i:nth-child(5n)]:h-full [&>i:nth-child(5n)]:bg-[#e9dcff]">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="mt-4.5 flex justify-between border-t border-white/15 pt-4.5 text-[10px] text-[#dfd2fa]">
              <span>From words to insight</span>
              <Icon name="spark" size={15} />
            </div>
          </div>
          <div className="mt-8 flex items-center gap-2.5 text-[11px] text-[#e2d6fa]">
            <Icon name="layers" size={18} />
            <span>Analyze. Understand. Create.</span>
          </div>
        </div>
        <p className="text-[11px] text-[#e2d6fa]">Built for curious minds.</p>
      </section>
      <section
        className="flex min-h-svh flex-col p-5.5 min-[761px]:px-8 min-[761px]:pt-6 min-[761px]:pb-6 min-[1051px]:px-11 min-[1051px]:pt-7"
        aria-labelledby="auth-title"
      >
        <div className="flex items-center justify-between min-[761px]:justify-end">
          <Link
            href="/auth/sign-in"
            className="text-xl font-bold tracking-[-0.6px] min-[761px]:hidden"
          >
            neuraltext
          </Link>
          <ThemeToggle />
        </div>
        <div className="m-auto w-full max-w-97.5 py-10.5 min-[761px]:py-10 [&>h2]:mt-2.5 [&>h2]:text-[clamp(25px,2.3vw,32px)] [&>h2]:font-semibold [&>h2]:leading-[1.2] [&>h2]:tracking-[-1px]">
          <div className="mb-5.75 grid size-12 place-items-center rounded-[15px] border border-workspace-border bg-workspace-accent-soft text-workspace-accent">
            <Icon name={verify ? "file" : "spark"} size={24} />
          </div>
          <p className="block text-[10px] font-bold tracking-[0.16em] text-workspace-accent">
            {recovery
              ? "LET’S GET YOU BACK IN"
              : verify
                ? "ONE LAST STEP"
                : signup
                  ? "START SOMETHING GREAT"
                  : "YOUR WORKSPACE AWAITS"}
          </p>
          {!recovery && (
            <>
              <h2 id="auth-title">
                {verify
                  ? "Check your inbox"
                  : signup
                    ? "Make room for your ideas"
                    : "Welcome back"}
              </h2>
              <p className="mt-3.5 mb-6.75 text-[13px] leading-[1.7] text-workspace-muted">
                {verify
                  ? "Enter the verification code from your email to continue."
                  : signup
                    ? "Create your NeuralText account and find the insight in every word."
                    : "Sign in to pick up where your curiosity left off."}
              </p>
            </>
          )}
          {!verify && !recovery && (
            <>
              <Button
                type="button"
                className="flex min-h-11.75 w-full cursor-pointer items-center justify-center gap-2.75 rounded-[10px] border border-workspace-border bg-workspace-surface text-xs font-semibold text-workspace-text hover:border-workspace-accent disabled:cursor-wait disabled:opacity-60"
                disabled={busy || !ready}
                onClick={google}
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.31 2.98-7.36ZM12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.61 0-4.82-1.77-5.61-4.15H3.05v2.59A10 10 0 0 0 12 22Zm-5.61-8.11a6 6 0 0 1 0-3.78V7.52H3.05a10 10 0 0 0 0 8.96l3.34-2.59ZM12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.95 5.52l3.34 2.59C7.18 7.73 9.39 5.96 12 5.96Z"
                  />
                </svg>
                Continue with Google
              </Button>
              <div className="my-6 flex items-center gap-3.75 text-[10px] text-workspace-muted before:h-px before:flex-1 before:bg-workspace-border before:content-[''] after:h-px after:flex-1 after:bg-workspace-border after:content-['']">
                <span>or continue with email</span>
              </div>
            </>
          )}
          <noscript>
            <p className={authMessageClass}>
              Enable JavaScript to sign in securely.
            </p>
          </noscript>
          {recovery ? (
            <PasswordRecoveryForm key={view} view={view} ready={ready} />
          ) : (
            <>
              <form
                method="post"
                noValidate
                onChange={() => setError("")}
                onSubmit={submit}
                className="[&>fieldset]:m-0 [&>fieldset]:flex [&>fieldset]:min-w-0 [&>fieldset]:flex-col [&>fieldset]:gap-4.75 [&>fieldset]:border-0 [&>fieldset]:p-0"
                aria-busy={busy || !ready}
              >
                <fieldset disabled={busy || !ready}>
                  {signup && (
                    <div className={authFieldClass}>
                      <label htmlFor="name">Full name</label>
                      <Input
                        variant="auth"
                        id="name"
                        name="name"
                        {...validation.bind("name")}
                        autoComplete="name"
                        placeholder="Enter your full name"
                        required
                        minLength={2}
                        maxLength={100}
                      />
                      <FieldError
                        id="name-error"
                        message={validation.message("name")}
                      />
                    </div>
                  )}
                  <div className={authFieldClass}>
                    <label htmlFor="email">Email address</label>
                    <Input
                      variant="auth"
                      id="email"
                      name="email"
                      {...validation.bind("email")}
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      required
                      maxLength={254}
                    />
                    <FieldError
                      id="email-error"
                      message={validation.message("email")}
                    />
                  </div>
                  {verify ? (
                    <div className={authFieldClass}>
                      <label htmlFor="otp">Verification code</label>
                      <Input
                        id="otp"
                        name="otp"
                        {...validation.bind("otp")}
                        variant="otp"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        minLength={6}
                        maxLength={6}
                        placeholder="000000"
                        required
                        aria-describedby="otp-help otp-error"
                      />
                      <small id="otp-help">
                        Enter the 6-digit code. You can paste it directly.
                      </small>
                      <FieldError
                        id="otp-error"
                        message={validation.message("otp")}
                      />
                    </div>
                  ) : (
                    <div className={authFieldClass}>
                      <label htmlFor="password">Password</label>
                      <div className="relative [&>button]:absolute [&>button]:top-0 [&>button]:right-3.25 [&>button]:h-11.75 [&>button]:cursor-pointer [&>button]:text-[11px] [&>button]:font-semibold [&>button]:text-workspace-accent [&>button]:disabled:cursor-wait [&>button]:disabled:opacity-60">
                        <Input
                          variant="auth"
                          id="password"
                          name="password"
                          {...validation.bind("password")}
                          className="pr-16"
                          type={showPassword ? "text" : "password"}
                          autoComplete={
                            signup ? "new-password" : "current-password"
                          }
                          minLength={signup ? 8 : undefined}
                          maxLength={128}
                          required
                          placeholder={
                            signup
                              ? "Create a password (8+ characters)"
                              : "Enter your password"
                          }
                          aria-describedby={
                            signup
                              ? "password-help password-error"
                              : "password-error"
                          }
                        />
                        <Button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? "Hide" : "Show"}
                        </Button>
                      </div>
                      {signup && (
                        <small id="password-help">
                          Use at least 8 characters.
                        </small>
                      )}
                      <FieldError
                        id="password-error"
                        message={validation.message("password")}
                      />
                    </div>
                  )}
                </fieldset>
                {error && (
                  <p
                    className={authErrorClass}
                    role="alert"
                    ref={errorRef}
                    tabIndex={-1}
                  >
                    {error}
                  </p>
                )}
                {notice && (
                  <output className={authMessageClass}>{notice}</output>
                )}
                {view === "sign-in" && (
                  <div className="mt-3 flex justify-end">
                    <Link
                      className="text-right text-[11px] font-semibold text-workspace-accent hover:underline"
                      href="/auth/forgot-password"
                    >
                      Forgot password?
                    </Link>
                  </div>
                )}
                <Button
                  className={authSubmitClass}
                  type="submit"
                  disabled={busy || !ready}
                >
                  {!ready || busy ? (
                    <LoadingIndicator label="Please wait" compact />
                  ) : verify ? (
                    "Verify and continue"
                  ) : signup ? (
                    "Create account"
                  ) : (
                    "Sign in"
                  )}
                  {ready && !busy && <span aria-hidden="true">→</span>}
                </Button>
              </form>
              {verify ? (
                <>
                  <p className="mt-6 text-center text-xs leading-[1.7] text-workspace-muted [&>a]:cursor-pointer [&>a]:font-semibold [&>a]:text-workspace-accent [&>button]:cursor-pointer [&>button]:font-semibold [&>button]:text-workspace-accent [&>button]:disabled:cursor-default [&>button]:disabled:opacity-60">
                    No code yet?{" "}
                    <Button
                      type="button"
                      disabled={busy || !ready || cooldown > 0 || !email.trim()}
                      onClick={() => {
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                          setError("Enter a valid email address first.");
                          return;
                        }
                        void run(async () => {
                          await sendCode(verificationType, email.trim());
                          setNotice(
                            "A new code is on its way. Check your spam folder too.",
                          );
                        });
                      }}
                    >
                      {cooldown > 0
                        ? `Resend in ${cooldown}s`
                        : "Send a new code"}
                    </Button>
                  </p>
                  <Link
                    className="mx-auto mt-4.25 block w-fit cursor-pointer text-center text-[11px] text-workspace-accent disabled:cursor-default disabled:opacity-60"
                    href="/auth/sign-in"
                  >
                    ← Back to sign in
                  </Link>
                </>
              ) : (
                <>
                  <p className="mt-6 text-center text-xs leading-[1.7] text-workspace-muted [&>a]:cursor-pointer [&>a]:font-semibold [&>a]:text-workspace-accent [&>button]:cursor-pointer [&>button]:font-semibold [&>button]:text-workspace-accent [&>button]:disabled:cursor-default [&>button]:disabled:opacity-60">
                    {signup ? "Already have an account?" : "New to NeuralText?"}{" "}
                    <Link href={signup ? "/auth/sign-in" : "/auth/sign-up"}>
                      {signup ? "Sign in" : "Create an account"}
                    </Link>
                  </p>
                  {!signup && (
                    <Button
                      className="mx-auto mt-4.25 block w-fit cursor-pointer text-center text-[11px] text-workspace-accent disabled:cursor-default disabled:opacity-60"
                      type="button"
                      disabled={busy || !ready}
                      onClick={() => {
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                          setError(
                            "Enter your email address above to receive a sign-in code.",
                          );
                          return;
                        }
                        void run(async () => {
                          await sendCode("sign-in", email.trim());
                          router.push("/auth/verify");
                        });
                      }}
                    >
                      Sign in with an email code instead
                    </Button>
                  )}
                </>
              )}
            </>
          )}
          <p className="mt-7.75 text-center text-[10px] text-workspace-muted">
            Your workspace, securely connected.
          </p>
        </div>
        <footer className="text-center text-[10px] text-workspace-muted">
          NeuralText · A clearer way to work with words
        </footer>
      </section>
    </main>
  );
}
