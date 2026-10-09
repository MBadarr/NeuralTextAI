import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import {
  createAuthServer,
  extractNeonAuthCookies,
  NEON_AUTH_SESSION_COOKIE_NAME,
  parseCookieValue,
} from "@neondatabase/auth/server";
import { headers } from "next/headers";
import {
  requestOrigin,
  validateAuthBaseUrl,
} from "@/features/auth/lib/auth-config";

const baseUrl = validateAuthBaseUrl(process.env.NEON_AUTH_BASE_URL);
const secret = process.env.NEON_AUTH_COOKIE_SECRET;
if (!baseUrl || !secret || secret.length < 32) {
  throw new Error(
    "Neon Auth requires NEON_AUTH_BASE_URL and a 32+ character NEON_AUTH_COOKIE_SECRET.",
  );
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: { secret, sessionDataTtl: 60 },
});

// RSCs can read sessions but cannot set cookies. The proxy and auth route handle
// renewal; this read-only SDK context keeps provider validation live without
// attempting a cookie write while a Server Component is rendering.
const sessionReader = createAuthServer({
  baseUrl,
  cookieSecret: secret,
  sessionDataTtl: 60,
  context: async () => {
    const requestHeaders = await headers();
    return {
      getCookies: () => extractNeonAuthCookies(requestHeaders),
      setCookie: () => {},
      getHeader: (name) => requestHeaders.get(name),
      getOrigin: () => requestOrigin(requestHeaders),
      getFramework: () => "nextjs",
    };
  },
});

export async function readSession() {
  const requestCookies = extractNeonAuthCookies(await headers());
  if (!parseCookieValue(requestCookies, NEON_AUTH_SESSION_COOKIE_NAME)) {
    return { data: null, error: null };
  }
  const result = await sessionReader.getSession({
    query: { disableCookieCache: "true" },
  });
  if (result.error?.status === 401) return { data: null, error: null };
  if (result.error) {
    console.error("Neon session verification failed", {
      status: result.error.status,
      code: result.error.code || "session_service_error",
    });
  }
  return result;
}
