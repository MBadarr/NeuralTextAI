import type { NextRequest } from "next/server";
import { auth } from "@/features/auth/lib/auth-server";

const backend = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");
const allowedPaths =
  /^(health|analysis|sentiment|intent|emotions|summary|plagiarism|writing-feedback|autocomplete|documents(?:\/[a-zA-Z0-9-]+)?|insights|models|search|keywords)$/;

async function forward(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const path = (await params).path.join("/");
  if (!allowedPaths.test(path))
    return Response.json({ detail: "Not found." }, { status: 404 });
  if (
    request.method !== "GET" &&
    request.headers.get("origin") !== request.nextUrl.origin
  ) {
    return Response.json(
      { detail: "Invalid request origin." },
      { status: 403 },
    );
  }
  try {
    const session = await auth.getSession({
      query: { disableCookieCache: "true" },
    });
    if (session.error)
      return Response.json(
        { detail: "Session service unavailable." },
        { status: 503 },
      );
    if (!session.data?.user)
      return Response.json({ detail: "Sign in to continue." }, { status: 401 });
    if (!session.data.user.emailVerified)
      return Response.json(
        { detail: "Verify your email to continue." },
        { status: 403 },
      );
    const token = await auth.token();
    if (token.error || !token.data?.token)
      return Response.json(
        { detail: "Unable to authorize request." },
        { status: 503 },
      );
    const response = await fetch(
      `${backend}/${path}${request.nextUrl.search}`,
      {
        method: request.method,
        headers: {
          Authorization: `Bearer ${token.data.token}`,
          "Content-Type": "application/json",
        },
        body: request.method === "GET" ? undefined : await request.text(),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(120000),
      },
    );
    if (response.status === 401 || response.status === 403) {
      console.error("Backend rejected the Neon access token", {
        path,
        status: response.status,
        code: response.headers.get("X-Auth-Error"),
      });
      return Response.json(
        {
          detail: "The service could not authorize this request. Please retry.",
          code:
            response.headers.get("X-Auth-Error") ||
            "backend_authentication_failed",
        },
        { status: 502 },
      );
    }
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    // Keep diagnostics useful without logging credentials or provider responses.
    console.error("Backend proxy request failed", {
      path,
      category: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      { detail: "Service temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }
}

export const GET = forward;
export const POST = forward;
export const DELETE = forward;
