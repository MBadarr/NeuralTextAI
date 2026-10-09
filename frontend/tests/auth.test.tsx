import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthScreen } from "@/components/AuthScreen";
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
    emailOtp: { sendVerificationOtp: mock.sendCode, verifyEmail: mock.verify },
    getSession: mock.getSession,
    useSession: mock.useSession,
  },
}));

function show(view: "sign-in" | "sign-up" | "verify") {
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
  ])
    method.mockResolvedValue({ data: {}, error: null });
  mock.getSession.mockResolvedValue({
    data: { user: { id: "alex", emailVerified: true } },
    error: null,
  });
});
afterEach(cleanup);

describe("authentication flows", () => {
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
