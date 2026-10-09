import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthScreen, type AuthView } from "@/components/AuthScreen";
import { SessionGuard } from "@/components/SessionGuard";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useWorkspaceStore } from "@/lib/workspace-store";

const mock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  signup: vi.fn(),
  login: vi.fn(),
  social: vi.fn(),
  sendCode: vi.fn(),
  verify: vi.fn(),
  otpLogin: vi.fn(),
  getSession: vi.fn(),
  useSession: vi.fn(),
  requestReset: vi.fn(),
  resetPassword: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mock.push,
    replace: mock.replace,
    refresh: mock.refresh,
  }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: { email: mock.signup },
    signIn: { email: mock.login, social: mock.social, emailOtp: mock.otpLogin },
    emailOtp: {
      sendVerificationOtp: mock.sendCode,
      verifyEmail: mock.verify,
      requestPasswordReset: mock.requestReset,
      resetPassword: mock.resetPassword,
    },
    getSession: mock.getSession,
    useSession: mock.useSession,
  },
}));

function show(view: AuthView) {
  return render(
    <ThemeProvider initialTheme="light">
      <AuthScreen view={view} />
    </ThemeProvider>,
  );
}
function credentials() {
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "alex@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "secure-password" },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  for (const method of [
    mock.signup,
    mock.login,
    mock.social,
    mock.sendCode,
    mock.verify,
    mock.otpLogin,
    mock.requestReset,
    mock.resetPassword,
  ])
    method.mockResolvedValue({ data: {}, error: null });
  mock.getSession.mockResolvedValue({
    data: { user: { id: "alex", emailVerified: true } },
    error: null,
  });
});
afterEach(cleanup);

describe("authentication flows", () => {
  it("links sign-in to the password recovery screen", () => {
    show("sign-in");
    expect(
      screen
        .getByRole("link", { name: "Forgot password?" })
        .getAttribute("href"),
    ).toBe("/auth/forgot-password");
    const link = screen.getByRole("link", { name: "Forgot password?" });
    const submit = screen.getByRole("button", { name: /^Sign in$/ });
    expect(
      link.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(link.parentElement?.classList.contains("justify-end")).toBe(true);
  });

  it.each([
    "sign-in",
    "sign-up",
  ] as const)("updates password validation while typing on %s without submitting credentials", (view) => {
    show(view);
    const password = screen.getByLabelText("Password");
    fireEvent.change(password, { target: { value: "abc" } });
    expect(
      screen.getByText("Use at least 8 characters (5 more needed)."),
    ).toBeTruthy();
    expect(password.getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(password, { target: { value: "longer-password" } });
    expect(password.getAttribute("aria-invalid")).toBe("false");
    expect(
      screen.queryByText("Use at least 8 characters (5 more needed)."),
    ).toBeNull();
    expect(mock.signup).not.toHaveBeenCalled();
  });

  it("blocks invalid email and empty password locally and clears stale errors on edit", async () => {
    show("sign-in");
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "invalid" },
    });
    fireEvent.blur(screen.getByLabelText("Email address"));
    expect(
      screen.getByLabelText("Email address").getAttribute("aria-invalid"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "valid email address",
    );
    expect(mock.login).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alex@example.com" },
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByLabelText("Email address").getAttribute("aria-invalid"),
    ).toBe("false");
    expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("blocks malformed verification codes before reaching Neon", async () => {
    show("verify");
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "12ab" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify and continue" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "6-digit code",
    );
    expect(mock.verify).not.toHaveBeenCalled();
  });

  it("checks confirmation immediately and rechecks it when the password changes", () => {
    show("reset-password");
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-password" },
    });
    const confirm = screen.getByLabelText("Confirm new password");
    fireEvent.change(confirm, { target: { value: "different-password" } });
    expect(
      screen.getByText(
        "Passwords do not match. Enter the same password in both fields.",
      ),
    ).toBeTruthy();
    fireEvent.change(confirm, { target: { value: "new-password" } });
    expect(confirm.getAttribute("aria-invalid")).toBe("false");
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "changed-password" },
    });
    expect(confirm.getAttribute("aria-invalid")).toBe("true");
  });

  it("requests a dedicated reset OTP and stores only email and cooldown", async () => {
    show("forgot-password");
    expect(
      screen.queryByRole("button", { name: "Continue with Google" }),
    ).toBeNull();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset code" }));
    await waitFor(() =>
      expect(mock.push).toHaveBeenCalledWith("/auth/reset-password"),
    );
    expect(mock.requestReset).toHaveBeenCalledWith({
      email: "alex@example.com",
    });
    const pending = JSON.parse(
      sessionStorage.getItem("neuraltext-password-recovery") || "{}",
    );
    expect(Object.keys(pending).sort()).toEqual(["email", "sentAt"]);
    expect(mock.sendCode).not.toHaveBeenCalled();
    expect(mock.login).not.toHaveBeenCalled();
  });

  it("does not reveal whether the recovery email exists", async () => {
    mock.requestReset.mockResolvedValue({
      error: { code: "USER_NOT_FOUND", message: "User not found" },
    });
    show("forgot-password");
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "unknown@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset code" }));
    await waitFor(() =>
      expect(mock.push).toHaveBeenCalledWith("/auth/reset-password"),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  function resetFields(confirmation = "new-secure-password") {
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Reset code"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-secure-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: confirmation },
    });
  }

  it("restores email and resend cooldown after refresh and resets the password", async () => {
    sessionStorage.setItem(
      "neuraltext-password-recovery",
      JSON.stringify({ email: "alex@example.com", sentAt: Date.now() }),
    );
    show("reset-password");
    expect(
      (screen.getByLabelText("Email address") as HTMLInputElement).value,
    ).toBe("alex@example.com");
    expect(
      (screen.getByRole("button", { name: /Resend in/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    resetFields();
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() =>
      expect(mock.replace).toHaveBeenCalledWith("/auth/sign-in?reset=1"),
    );
    expect(mock.resetPassword).toHaveBeenCalledWith({
      email: "alex@example.com",
      otp: "123456",
      password: "new-secure-password",
    });
    expect(sessionStorage.getItem("neuraltext-password-recovery")).toBeNull();
    expect(mock.login).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords before calling Neon", async () => {
    show("reset-password");
    resetFields("different-password");
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Passwords do not match",
    );
    expect(mock.resetPassword).not.toHaveBeenCalled();
  });

  it("keeps expired reset codes recoverable and supports resending", async () => {
    mock.resetPassword.mockResolvedValue({
      error: { code: "OTP_EXPIRED", message: "Expired" },
    });
    show("reset-password");
    resetFields();
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "invalid or expired",
    );
    expect(mock.replace).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Send a new reset code" }),
    );
    await waitFor(() =>
      expect(mock.requestReset).toHaveBeenCalledWith({
        email: "alex@example.com",
      }),
    );
    expect(
      (
        (await screen.findByRole("button", {
          name: /Resend in/,
        })) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      sessionStorage.getItem("neuraltext-password-recovery"),
    ).not.toContain("new-secure-password");
    expect(
      sessionStorage.getItem("neuraltext-password-recovery"),
    ).not.toContain("123456");
  });

  it("shows a spinner while recovery is pending and handles delivery failures", async () => {
    let rejectRequest: (error: Error) => void = () => {};
    mock.requestReset.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectRequest = reject;
        }),
    );
    show("forgot-password");
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset code" }));
    expect(
      screen.getByRole("status", { name: "Sending reset code" }),
    ).toBeTruthy();
    rejectRequest(new Error("Service unavailable"));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Service unavailable",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Send reset code",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(mock.push).not.toHaveBeenCalled();
  });
  it("prevents credentials from entering the URL before hydration", () => {
    const markup = renderToString(
      <ThemeProvider initialTheme="light">
        <AuthScreen view="sign-up" />
      </ThemeProvider>,
    );
    const document = new DOMParser().parseFromString(markup, "text/html");
    expect(document.querySelector("form")?.method).toBe("post");
    expect(document.querySelector("fieldset")?.disabled).toBe(true);
    expect(
      document.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
  });

  it("changes the theme and persists the preference for server rendering", () => {
    show("sign-in");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Color theme: light. Change color theme",
      }),
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.cookie).toContain("neuraltext-theme=dark");
  });
  it("creates an account and preserves only verification details across refresh", async () => {
    show("sign-up");
    credentials();
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Alex Morgan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(mock.push).toHaveBeenCalledWith("/auth/verify"));
    expect(mock.sendCode).toHaveBeenCalledWith({
      email: "alex@example.com",
      type: "email-verification",
    });
    expect(sessionStorage.getItem("neuraltext-verification")).not.toContain(
      "secure-password",
    );
  });

  it("keeps verification recoverable when OTP delivery fails after signup", async () => {
    mock.sendCode.mockResolvedValue({
      error: { message: "Delivery unavailable" },
    });
    show("sign-up");
    credentials();
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Alex Morgan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(mock.push).toHaveBeenCalledWith("/auth/verify"));
    expect(
      JSON.parse(sessionStorage.getItem("neuraltext-verification") || "{}")
        .sentAt,
    ).toBe(0);
  });

  it("routes unverified password logins to verification instead of the workspace", async () => {
    mock.login.mockResolvedValue({
      error: { code: "EMAIL_NOT_VERIFIED", message: "Verify email" },
    });
    show("sign-in");
    credentials();
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));
    await waitFor(() => expect(mock.push).toHaveBeenCalledWith("/auth/verify"));
    expect(mock.replace).not.toHaveBeenCalledWith("/");
  });

  it("shows sign-in errors and reenables the form", async () => {
    mock.login.mockResolvedValue({ error: { message: "Invalid credentials" } });
    show("sign-in");
    credentials();
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Invalid credentials",
    );
    expect(
      (screen.getByLabelText("Password") as HTMLInputElement).disabled,
    ).toBe(false);
  });

  it("restores pending OTP and uses the correct passwordless verification endpoint", async () => {
    sessionStorage.setItem(
      "neuraltext-verification",
      JSON.stringify({
        email: "alex@example.com",
        type: "sign-in",
        sentAt: Date.now(),
      }),
    );
    show("verify");
    expect(
      (screen.getByLabelText("Email address") as HTMLInputElement).value,
    ).toBe("alex@example.com");
    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify and continue" }),
    );
    await waitFor(() => expect(mock.replace).toHaveBeenCalledWith("/"));
    expect(mock.otpLogin).toHaveBeenCalledWith({
      email: "alex@example.com",
      otp: "123456",
    });
    expect(mock.verify).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("neuraltext-verification")).toBeNull();
  });

  it("does not assume email verification creates a session", async () => {
    mock.getSession.mockResolvedValue({ data: null, error: null });
    show("verify");
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify and continue" }),
    );
    await waitFor(() =>
      expect(mock.replace).toHaveBeenCalledWith("/auth/sign-in?verified=1"),
    );
  });

  it("initiates Google OAuth with local success and error callbacks", async () => {
    show("sign-in");
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    await waitFor(() =>
      expect(mock.social).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: `${location.origin}/auth/callback`,
        errorCallbackURL: `${location.origin}/auth/sign-in?error=oauth`,
      }),
    );
  });
});

describe("persistent sessions and preferences", () => {
  it("shows a loader while checking the session and hides private content", () => {
    mock.useSession.mockReturnValue({
      data: null,
      isPending: true,
      error: null,
      refetch: vi.fn(),
    });
    render(
      <SessionGuard>
        <p>Private workspace</p>
      </SessionGuard>,
    );
    expect(
      screen.getByRole("status", { name: "Loading workspace" }),
    ).toBeTruthy();
    expect(screen.queryByText("Private workspace")).toBeNull();
    expect(screen.queryByText("Opening your workspace…")).toBeNull();
  });
  it("restores the current user's saved navigation after session validation", async () => {
    localStorage.setItem(
      "neuraltext-workspace:alex",
      JSON.stringify({
        state: { active: "Documents", collapsed: true },
        version: 0,
      }),
    );
    mock.useSession.mockReturnValue({
      data: { user: { id: "alex", emailVerified: true } },
      isPending: false,
      error: null,
      refetch: vi.fn(),
    });
    render(
      <SessionGuard>
        <p>Workspace content</p>
      </SessionGuard>,
    );
    await screen.findByText("Workspace content");
    expect(useWorkspaceStore.getState().active).toBe("Documents");
    expect(useWorkspaceStore.getState().collapsed).toBe(true);
  });

  it("clears the previous user's preferences when the next user has none", async () => {
    useWorkspaceStore.persist.setOptions({
      name: "neuraltext-workspace:previous",
    });
    useWorkspaceStore.setState({
      active: "Documents",
      collapsed: true,
      query: "private search",
    });
    mock.useSession.mockReturnValue({
      data: { user: { id: "new-user", emailVerified: true } },
      isPending: false,
      error: null,
      refetch: vi.fn(),
    });
    render(
      <SessionGuard>
        <p>New workspace</p>
      </SessionGuard>,
    );
    await screen.findByText("New workspace");
    expect(useWorkspaceStore.getState().active).toBe("Overview");
    expect(useWorkspaceStore.getState().query).toBe("");
  });

  it("keeps workspace content hidden and redirects when the session expires", async () => {
    mock.useSession.mockReturnValue({
      data: null,
      isPending: false,
      error: null,
      refetch: vi.fn(),
    });
    render(
      <SessionGuard>
        <p>Private workspace</p>
      </SessionGuard>,
    );
    await waitFor(() =>
      expect(mock.replace).toHaveBeenCalledWith("/auth/sign-in"),
    );
    expect(screen.queryByText("Private workspace")).toBeNull();
  });
});
