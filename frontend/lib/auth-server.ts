import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import {
  createAuthServer,
  extractNeonAuthCookies,
} from "@neondatabase/auth/server";
import { headers } from "next/headers";

const baseUrl = process.env.NEON_AUTH_BASE_URL;
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
      getOrigin: () =>
        requestHeaders.get("origin") ||
        requestHeaders.get("referer")?.split("/").slice(0, 3).join("/") ||
        "",
      getFramework: () => "nextjs",
    };
  },
});

export function readSession() {
  return sessionReader.getSession({ query: { disableCookieCache: "true" } });
}
