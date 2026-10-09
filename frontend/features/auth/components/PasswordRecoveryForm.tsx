"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAuthValidation } from "@/features/auth/hooks/use-auth-validation";
import { authClient } from "@/features/auth/lib/auth-client";
import {
  authErrorClass,
  authFieldClass,
  authMessageClass,
  authSubmitClass,
} from "@/features/auth/lib/auth-styles";
import { Button } from "@/ui/Button";
import { FieldError } from "@/ui/FieldError";
import { Input } from "@/ui/Input";
import { LoadingIndicator } from "@/ui/LoadingIndicator";

const recoveryKey = "neuraltext-password-recovery";
const resendDelay = 60_000;
type Recovery = { email: string; sentAt: number };

function rememberRecovery(value: Recovery) {
  try {
    sessionStorage.setItem(recoveryKey, JSON.stringify(value));
  } catch {
    // The reset form also supports manually entering the email address.
  }
}

export function PasswordRecoveryForm({
  view,
  ready,
}: {
  view: "forgot-password" | "reset-password";
  ready: boolean;
}) {
  const router = useRouter();
  const reset = view === "reset-password";
  const [verifiedCode, setVerifiedCode] = useState<{
    email: string;
    otp: string;
  } | null>(null);
  const passwordStep = reset && verifiedCode !== null;
  const codeStep = reset && !passwordStep;
  const validation = useAuthValidation(
    reset
      ? passwordStep
        ? "reset-password"
        : "reset-code"
      : "forgot-password",
  );
  const email = validation.values.email;
  const setEmail = validation.setEmail;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [hasPendingEmail, setHasPendingEmail] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    try {
      const pending: unknown = JSON.parse(
        sessionStorage.getItem(recoveryKey) || "null",
      );
      if (
        pending &&
        typeof pending === "object" &&
        "email" in pending &&
        typeof pending.email === "string"
      ) {
        setEmail(pending.email);
        setHasPendingEmail(true);
        if (
          "sentAt" in pending &&
          typeof pending.sentAt === "number" &&
          Number.isFinite(pending.sentAt)
        )
          setCooldown(
            Math.min(
              60,
              Math.max(
                0,
                Math.ceil((pending.sentAt + resendDelay - Date.now()) / 1000),
              ),
            ),
          );
      }
    } catch {
      // Unavailable or malformed storage never blocks account recovery.
    }
  }, [setEmail]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (passwordStep || reset) headingRef.current?.focus();
  }, [passwordStep, reset]);

  async function run(action: () => Promise<void>) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to complete this request. Please try again.",
      );
    } finally {
      pendingRef.current = false;
      setBusy(false);
    }
  }
  function checkError(result: {
    error?: { message?: string; code?: string; status?: number } | null;
  }) {
    if (!result.error) return;
    if (result.error.status === 429)
      throw new Error("Too many attempts. Please wait before trying again.");
    if (
      ["INVALID_OTP", "OTP_EXPIRED", "TOO_MANY_ATTEMPTS"].includes(
        result.error.code || "",
      )
    )
      throw new Error(
        "This code is invalid or expired. Request a new code and try again.",
      );
    throw new Error(
      result.error.message ||
        "Unable to complete this request. Please try again.",
    );
  }
  async function sendResetCode(targetEmail: string) {
    // Use the dedicated password-reset OTP endpoint, never a sign-in OTP.
    const result = await authClient.emailOtp.requestPasswordReset({
      email: targetEmail,
    });
    if (result.error?.code !== "USER_NOT_FOUND") checkError(result);
    rememberRecovery({ email: targetEmail, sentAt: Date.now() });
    setCooldown(60);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const invalid = validation.validate(fields);
    if (invalid) {
      setError(invalid);
      return;
    }
    const targetEmail = String(fields.get("email") || "").trim();
    await run(async () => {
      if (!reset) {
        if (cooldown > 0) return;
        await sendResetCode(targetEmail);
        router.push("/auth/reset-password");
        return;
      }
      if (codeStep) {
        const otp = String(fields.get("otp") || "").trim();
        const result = await authClient.emailOtp.checkVerificationOtp({
          email: targetEmail,
          otp,
          type: "forget-password",
        });
        checkError(result);
        if (result.data?.success !== true)
          throw new Error(
            "This code is invalid or expired. Request a new code and try again.",
          );
        setVerifiedCode({ email: targetEmail, otp });
        validation.setValue("otp", "");
        validation.resetFeedback();
        return;
      }
      if (!verifiedCode || verifiedCode.email !== targetEmail)
        throw new Error(
          "Verify your reset code before changing your password.",
        );
      const password = String(fields.get("password") || "");
      if (password.length < 8 || password.length > 128)
        throw new Error("Use a password between 8 and 128 characters.");
      if (password !== String(fields.get("confirmPassword") || ""))
        throw new Error(
          "Passwords do not match. Enter the same password in both fields.",
        );
      const result = await authClient.emailOtp.resetPassword({
        email: targetEmail,
        otp: verifiedCode.otp,
        password,
      });
      if (
        ["INVALID_OTP", "OTP_EXPIRED", "TOO_MANY_ATTEMPTS"].includes(
          result.error?.code || "",
        )
      ) {
        setVerifiedCode(null);
        validation.clearPasswords();
      }
      checkError(result);
      if (result.data?.success !== true)
        throw new Error("Your password could not be reset. Please try again.");
      form.reset();
      validation.clearPasswords();
      setVerifiedCode(null);
      try {
        sessionStorage.removeItem(recoveryKey);
      } catch {
        /* Optional form state. */
      }
      router.replace("/auth/sign-in?reset=1");
      router.refresh();
    });
  }

  return (
    <>
      <h2 id="auth-title" ref={headingRef} tabIndex={-1}>
        {!reset
          ? "Forgot your password?"
          : codeStep
            ? "Check your inbox"
            : "Set a new password"}
      </h2>
      <p className="mt-3.5 mb-6.75 text-[13px] leading-[1.7] text-workspace-muted">
        {!reset
          ? "Enter your account email and we’ll send a password reset code."
          : codeStep
            ? "Enter the reset code from your email to continue."
            : "Your code is verified. Choose a new password for your account."}
      </p>
      <form
        key={passwordStep ? "password" : "code"}
        method="post"
        noValidate
        onChange={() => setError("")}
        className="[&>fieldset]:m-0 [&>fieldset]:flex [&>fieldset]:min-w-0 [&>fieldset]:flex-col [&>fieldset]:gap-4.75 [&>fieldset]:border-0 [&>fieldset]:p-0"
        onSubmit={submit}
        aria-busy={busy || !ready}
      >
        <fieldset disabled={busy || !ready}>
          <div className={authFieldClass}>
            <label htmlFor="recovery-email">Email address</label>
            <Input
              variant="auth"
              id="recovery-email"
              name="email"
              {...validation.bind("email", "recovery-email")}
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="you@example.com"
              readOnly={passwordStep || (codeStep && hasPendingEmail)}
            />
            <FieldError
              id="recovery-email-error"
              message={validation.message("email")}
            />
          </div>
          {codeStep && (
            <div className={authFieldClass}>
              <label htmlFor="reset-otp">Reset code</label>
              <Input
                id="reset-otp"
                name="otp"
                {...validation.bind("otp", "reset-otp")}
                variant="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                placeholder="000000"
                required
                aria-describedby="reset-otp-help reset-otp-error"
              />
              <small id="reset-otp-help">
                If an account exists for this email, a reset code is on its way.
                Check your spam folder too.
              </small>
              <FieldError
                id="reset-otp-error"
                message={validation.message("otp")}
              />
            </div>
          )}
          {passwordStep && (
            <>
              <div className={authFieldClass}>
                <label htmlFor="reset-password">New password</label>
                <div className="relative [&>button]:absolute [&>button]:top-0 [&>button]:right-3.25 [&>button]:h-11.75 [&>button]:cursor-pointer [&>button]:text-[11px] [&>button]:font-semibold [&>button]:text-workspace-accent [&>button]:disabled:cursor-wait [&>button]:disabled:opacity-60">
                  <Input
                    variant="auth"
                    id="reset-password"
                    name="password"
                    {...validation.bind("password", "reset-password")}
                    className="pr-16"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                    placeholder="Create a strong password"
                    aria-describedby="reset-password-help reset-password-error"
                  />
                  <Button
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </Button>
                </div>
                <small id="reset-password-help">
                  Use at least 8 characters.
                </small>
                <FieldError
                  id="reset-password-error"
                  message={validation.message("password")}
                />
              </div>
              <div className={authFieldClass}>
                <label htmlFor="confirm-password">Confirm new password</label>
                <Input
                  variant="auth"
                  id="confirm-password"
                  name="confirmPassword"
                  {...validation.bind("confirmPassword", "confirm-password")}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  placeholder="Enter your new password again"
                />
                <FieldError
                  id="confirm-password-error"
                  message={validation.message("confirmPassword")}
                />
              </div>
            </>
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
        {notice && <output className={authMessageClass}>{notice}</output>}
        <Button
          className={authSubmitClass}
          type="submit"
          disabled={busy || !ready || (!reset && cooldown > 0)}
        >
          {busy || !ready ? (
            <LoadingIndicator
              label={
                passwordStep
                  ? "Resetting password"
                  : codeStep
                    ? "Verifying reset code"
                    : "Sending reset code"
              }
              compact
            />
          ) : passwordStep ? (
            "Reset password"
          ) : codeStep ? (
            "Verify reset code"
          ) : cooldown > 0 ? (
            `Send again in ${cooldown}s`
          ) : (
            "Send reset code"
          )}
        </Button>
      </form>
      {codeStep && (
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
                await sendResetCode(email.trim());
                setNotice(
                  "If an account exists for this email, a new reset code is on its way.",
                );
              });
            }}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Send a new reset code"}
          </Button>
        </p>
      )}
      {!reset && (
        <p className="mt-6 text-center text-xs leading-[1.7] text-workspace-muted [&>a]:cursor-pointer [&>a]:font-semibold [&>a]:text-workspace-accent [&>button]:cursor-pointer [&>button]:font-semibold [&>button]:text-workspace-accent [&>button]:disabled:cursor-default [&>button]:disabled:opacity-60">
          Already have a reset code?{" "}
          <Link href="/auth/reset-password">Enter your reset code</Link>
        </p>
      )}
      {reset && (
        <Link
          href="/auth/forgot-password"
          className="mx-auto mt-4 block w-fit text-[11px] text-workspace-accent hover:underline"
        >
          Use a different email
        </Link>
      )}
      {passwordStep && (
        <Button
          type="button"
          disabled={busy}
          className="mx-auto mt-4 block text-[11px] text-workspace-accent hover:underline disabled:opacity-60"
          onClick={() => {
            setVerifiedCode(null);
            validation.clearPasswords();
            setError("");
          }}
        >
          Enter a different reset code
        </Button>
      )}
      <Link
        className="mx-auto mt-4.25 block w-fit cursor-pointer text-center text-[11px] text-workspace-accent disabled:cursor-default disabled:opacity-60"
        href="/auth/sign-in"
      >
        ← Back to sign in
      </Link>
    </>
  );
}
