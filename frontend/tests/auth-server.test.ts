// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ cookie: "", cookieWrite: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ cookie: context.cookie, origin: "https://app.example" }),
  cookies: async () => ({ set: context.cookieWrite }),
}));

const session = {
  session: {
    id: "session-id",
    token: "fixture-token",
    userId: "user-id",
    expiresAt: "2030-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  user: {
    id: "user-id",
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("API_URL", "https://backend.example");
  vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example/neondb/auth");
  vi.stubEnv(
    "NEON_AUTH_COOKIE_SECRET",
    "test-cookie-secret-at-least-32-characters",
  );
  context.cookie = "";
  context.cookieWrite.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Neon server integration", () => {
  it.each([
    ["request-password-reset", { email: "test@example.com" }],
    [
      "check-verification-otp",
      { email: "test@example.com", otp: "123456", type: "forget-password" },
    ],
    [
      "reset-password",
      {
        email: "test@example.com",
        otp: "123456",
        password: "fixture-new-password",
      },
    ],
  ])("forwards the recovery %s endpoint to Neon without a session", async (endpoint, body) => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ success: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("@/app/api/auth/[...path]/route");
    const response = await POST(
      new NextRequest(`https://app.example/api/auth/email-otp/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "https://app.example",
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ path: ["email-otp", endpoint] }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `https://auth.example/neondb/auth/email-otp/${endpoint}`,
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual(body);
  });

  it.each([
    "forgot-password",
    "reset-password",
  ])("keeps %s accessible with a stale session during a session-service outage", async (view) => {
    context.cookie = "__Secure-neon-auth.session_token=expired-fixture";
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ message: "Unavailable" }, { status: 503 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { default: AuthPage } = await import("@/app/auth/[view]/page");
    const page = await AuthPage({
      params: Promise.resolve({ view }),
      searchParams: Promise.resolve({}),
    });
    expect(page.props.view).toBe(view);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps public auth pages available when no session cookie exists", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ message: "Unavailable" }, { status: 503 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { readSession } = await import("@/features/auth/lib/auth-server");
    expect(await readSession()).toEqual({ data: null, error: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats expired sessions as signed out while retaining provider outages as errors", async () => {
    context.cookie = "__Secure-neon-auth.session_token=expired-fixture";
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ message: "Expired session" }, { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { readSession } = await import("@/features/auth/lib/auth-server");
    expect(await readSession()).toEqual({ data: null, error: null });
    fetchMock.mockImplementation(async () =>
      Response.json({ message: "Unavailable" }, { status: 503 }),
    );
    expect((await readSession()).error?.status).toBe(503);
  });

  it("exchanges the Google callback verifier and persists SDK session cookies", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(session, {
        headers: {
          "Set-Cookie":
            "__Secure-neon-auth.session_token=fixture-token; Path=/; HttpOnly; Secure; SameSite=None; Partitioned",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { default: proxy } = await import("@/proxy");
    const response = await proxy(
      new NextRequest(
        "https://app.example/auth/callback?neon_auth_session_verifier=fixture-verifier",
        {
          headers: {
            cookie: "__Secure-neon-auth.session_challenge=fixture-challenge",
          },
        },
      ),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.example/auth/callback",
    );
    expect(
      response.headers
        .getSetCookie()
        .some((cookie) =>
          cookie.startsWith("__Secure-neon-auth.session_token="),
        ),
    ).toBe(true);
    expect(
      response.headers
        .getSetCookie()
        .some((cookie) =>
          cookie.startsWith("__Secure-neon-auth.local.session_data="),
        ),
    ).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "neon_auth_session_verifier=fixture-verifier",
    );
  });

  it("redirects unauthenticated workspace requests before rendering", async () => {
    const { default: proxy } = await import("@/proxy");
    const response = await proxy(new NextRequest("https://app.example/"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.example/auth/sign-in",
    );
  });

  it("validates sessions during RSC rendering without writing cookies", async () => {
    context.cookie = "__Secure-neon-auth.session_token=fixture-token";
    context.cookieWrite.mockImplementation(() => {
      throw new Error("Cookies cannot be modified in a Server Component");
    });
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(session, {
        headers: {
          "Set-Cookie":
            "__Secure-neon-auth.session_token=renewed-token; Path=/; Secure; HttpOnly",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { readSession } = await import("@/features/auth/lib/auth-server");
    const result = await readSession();
    expect(result.error).toBeNull();
    expect(result.data?.user.id).toBe("user-id");
    expect(context.cookieWrite).not.toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "disableCookieCache=true",
    );
  });
});

describe("authenticated backend proxy", () => {
  it("preserves capacity diagnostics so the client can safely retry busy requests", async () => {
    context.cookie = "__Secure-neon-auth.session_token=fixture-token";
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.includes("/get-session")) return Response.json(session);
        if (url.includes("/token"))
          return Response.json({ token: "fixture-jwt" });
        return Response.json(
          { detail: "Busy" },
          {
            status: 503,
            headers: { "Retry-After": "1", "X-Service-Error": "nlp_busy" },
          },
        );
      }),
    );
    const { GET } = await import("@/app/api/backend/[...path]/route");
    const response = await GET(
      new NextRequest("https://app.example/api/backend/insights"),
      {
        params: Promise.resolve({ path: ["insights"] }),
      },
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("1");
    expect(response.headers.get("X-Service-Error")).toBe("nlp_busy");
  });
  it("preserves signing-key configuration failures as 503 with a diagnostic code", async () => {
    context.cookie = "__Secure-neon-auth.session_token=fixture-token";
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.includes("/get-session")) return Response.json(session);
        if (url.includes("/token"))
          return Response.json({ token: "fixture-jwt" });
        return Response.json(
          { detail: "Configuration mismatch" },
          {
            status: 503,
            headers: { "X-Auth-Error": "jwks_configuration_mismatch" },
          },
        );
      }),
    );
    const { GET } = await import("@/app/api/backend/[...path]/route");
    const response = await GET(
      new NextRequest("https://app.example/api/backend/documents"),
      {
        params: Promise.resolve({ path: ["documents"] }),
      },
    );
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("jwks_configuration_mismatch");
  });
  it("obtains the JWT on the server and forwards it without exposing it to the browser", async () => {
    vi.stubEnv("API_URL", "https://backend.example");
    context.cookie = "__Secure-neon-auth.session_token=fixture-token";
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.startsWith("https://backend.example")) return Response.json([]);
      if (url.includes("/token"))
        return Response.json({ token: "fixture-jwt" });
      return Response.json(session);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/backend/[...path]/route");
    const response = await GET(
      new NextRequest("https://app.example/api/backend/documents"),
      { params: Promise.resolve({ path: ["documents"] }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    const forwarded = fetchMock.mock.calls.find(([url]) =>
      String(url).startsWith("https://backend.example"),
    );
    expect(forwarded?.[1]?.headers).toEqual({
      Authorization: "Bearer fixture-jwt",
      "Content-Type": "application/json",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects cross-origin writes before fetching any session or backend data", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("@/app/api/backend/[...path]/route");
    const response = await POST(
      new NextRequest("https://app.example/api/backend/analysis", {
        method: "POST",
        headers: { origin: "https://untrusted.example" },
      }),
      { params: Promise.resolve({ path: ["analysis"] }) },
    );
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unverified users before obtaining a JWT or contacting the backend", async () => {
    context.cookie = "__Secure-neon-auth.session_token=fixture-token";
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        ...session,
        user: { ...session.user, emailVerified: false },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/backend/[...path]/route");
    const response = await GET(
      new NextRequest("https://app.example/api/backend/documents"),
      { params: Promise.resolve({ path: ["documents"] }) },
    );
    expect(response.status).toBe(403);
    expect(
      fetchMock.mock.calls.every(([url]) =>
        String(url).includes("/get-session"),
      ),
    ).toBe(true);
  });

  it("does not turn a backend token rejection into an endless sign-in redirect", async () => {
    context.cookie = "__Secure-neon-auth.session_token=fixture-token";
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.startsWith("https://backend.example"))
          return Response.json(
            { detail: "Invalid token" },
            { status: 401, headers: { "X-Auth-Error": "InvalidIssuerError" } },
          );
        if (url.includes("/token"))
          return Response.json({ token: "fixture-jwt" });
        return Response.json(session);
      }),
    );
    const { GET } = await import("@/app/api/backend/[...path]/route");
    const response = await GET(
      new NextRequest("https://app.example/api/backend/documents"),
      { params: Promise.resolve({ path: ["documents"] }) },
    );
    expect(response.status).toBe(502);
    const failure = await response.json();
    expect(failure.detail).toContain("could not authorize");
    expect(failure.code).toBe("InvalidIssuerError");
  });
});
