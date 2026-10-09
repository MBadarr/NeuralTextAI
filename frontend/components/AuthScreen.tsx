"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeProvider";
import { authClient } from "@/lib/auth-client";

export type AuthView = "sign-in" | "sign-up" | "verify";
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
  initialEmail = "",
}: {
  view: AuthView;
  callbackError?: boolean;
  verified?: boolean;
  initialEmail?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
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
    verified ? "Email verified. Sign in to open your workspace." : "",
  );
  const [cooldown, setCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const signup = view === "sign-up";
  const verify = view === "verify";

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
  }, [verify, initialEmail]);
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
    <main className="auth-shell">
      <section className="auth-story" aria-label="About NeuralText">
        <Link href="/auth/sign-in" className="auth-brand">
          <span className="auth-brand-icon">
            <Icon name="spark" size={22} />
          </span>
          neural<span>text</span>
        </Link>
        <div className="auth-story-body">
          <span className="auth-eyebrow">YOUR WORDS. MORE POSSIBILITY.</span>
          <h1>
            A little clarity.
            <br />A lot of potential.
          </h1>
          <p>
            Turn everyday text into meaningful insights. Your ideas, documents,
            and discoveries — together in one workspace.
          </p>
          <div className="auth-preview" aria-hidden="true">
            <div className="auth-preview-heading">
              <Icon name="scan" size={18} />
              <span>Clarity, at a glance</span>
              <span className="auth-preview-dot" />
            </div>
            <p>Great ideas begin with a better understanding.</p>
            <div className="auth-preview-tags">
              <span>
                Great ideas <small>KEY PHRASE</small>
              </span>
              <span>
                understanding <small>INSIGHT</small>
              </span>
            </div>
            <div className="auth-preview-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="auth-preview-footer">
              <span>From words to insight</span>
              <Icon name="spark" size={15} />
            </div>
          </div>
          <div className="auth-story-note">
            <Icon name="layers" size={18} />
            <span>Analyze. Understand. Create.</span>
          </div>
        </div>
        <p className="auth-story-bottom">Built for curious minds.</p>
      </section>
      <section className="auth-content" aria-labelledby="auth-title">
        <div className="auth-toolbar">
          <Link href="/auth/sign-in" className="auth-mobile-brand">
            neuraltext
          </Link>
          <ThemeToggle />
        </div>
        <div className="auth-card">
          <div className="auth-card-icon">
            <Icon name={verify ? "file" : "spark"} size={24} />
          </div>
          <p className="auth-eyebrow">
            {verify
              ? "ONE LAST STEP"
              : signup
                ? "START SOMETHING GREAT"
                : "YOUR WORKSPACE AWAITS"}
          </p>
          <h2 id="auth-title">
            {verify
              ? "Check your inbox"
              : signup
                ? "Make room for your ideas"
                : "Welcome back"}
          </h2>
          <p className="auth-description">
            {verify
              ? "Enter the verification code from your email to continue."
              : signup
                ? "Create your NeuralText account and find the insight in every word."
                : "Sign in to pick up where your curiosity left off."}
          </p>
          {!verify && (
            <>
              <button
                type="button"
                className="auth-google"
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
              </button>
              <div className="auth-divider">
                <span>or continue with email</span>
              </div>
            </>
          )}
          <noscript>
            <p className="auth-message">
              Enable JavaScript to sign in securely.
            </p>
          </noscript>
          <form
            method="post"
            onSubmit={submit}
            className="auth-form"
            aria-busy={busy || !ready}
          >
            <fieldset disabled={busy || !ready}>
              {signup && (
                <div className="auth-field">
                  <label htmlFor="name">Full name</label>
                  <input
                    id="name"
                    name="name"
                    autoComplete="name"
                    placeholder="Alex Morgan"
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </div>
              )}
              <div className="auth-field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              {verify ? (
                <div className="auth-field">
                  <label htmlFor="otp">Verification code</label>
                  <input
                    id="otp"
                    name="otp"
                    className="auth-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    placeholder="000000"
                    required
                    aria-describedby="otp-help"
                  />
                  <small id="otp-help">
                    Enter the 6-digit code. You can paste it directly.
                  </small>
                </div>
              ) : (
                <div className="auth-field">
                  <label htmlFor="password">Password</label>
                  <div className="auth-password">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        signup ? "new-password" : "current-password"
                      }
                      minLength={signup ? 8 : undefined}
                      maxLength={128}
                      required
                      placeholder={
                        signup
                          ? "Create a strong password"
                          : "Enter your password"
                      }
                      aria-describedby={signup ? "password-help" : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {signup && (
                    <small id="password-help">Use at least 8 characters.</small>
                  )}
                </div>
              )}
            </fieldset>
            {error && (
              <p
                className="auth-message auth-error"
                role="alert"
                ref={errorRef}
                tabIndex={-1}
              >
                {error}
              </p>
            )}
            {notice && <output className="auth-message">{notice}</output>}
            <button
              className="auth-submit"
              type="submit"
              disabled={busy || !ready}
            >
              {!ready
                ? "Preparing secure sign-in…"
                : busy
                  ? "Please wait…"
                  : verify
                    ? "Verify and continue"
                    : signup
                      ? "Create account"
                      : "Sign in"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          {verify ? (
            <>
              <p className="auth-switch">
                No code yet?{" "}
                <button
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
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Send a new code"}
                </button>
              </p>
              <Link className="auth-back" href="/auth/sign-in">
                ← Back to sign in
              </Link>
            </>
          ) : (
            <>
              <p className="auth-switch">
                {signup ? "Already have an account?" : "New to NeuralText?"}{" "}
                <Link href={signup ? "/auth/sign-in" : "/auth/sign-up"}>
                  {signup ? "Sign in" : "Create an account"}
                </Link>
              </p>
              {!signup && (
                <button
                  className="auth-back"
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
                </button>
              )}
            </>
          )}
          <p className="auth-security">Your workspace, securely connected.</p>
        </div>
        <footer className="auth-footer">
          NeuralText · A clearer way to work with words
        </footer>
      </section>
    </main>
  );
}
