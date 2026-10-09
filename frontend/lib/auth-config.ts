/** Validate server configuration without including environment values in errors. */
export function validateAuthBaseUrl(value: string | undefined): string {
  let url: URL;
  try {
    url = new URL(value?.trim() || "");
  } catch {
    throw new Error("NEON_AUTH_BASE_URL must be a valid Neon Auth base URL.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "NEON_AUTH_BASE_URL must be a plain HTTP(S) auth base URL.",
    );
  }
  if (/\/(?:\.well-known\/jwks\.json|jwks|jwt)\/?$/.test(url.pathname)) {
    throw new Error(
      "NEON_AUTH_BASE_URL must point to the auth service, not the JWKS signing-key document.",
    );
  }
  return url.toString().replace(/\/$/, "");
}

export function requestOrigin(requestHeaders: Headers): string {
  const supplied =
    requestHeaders.get("origin") || requestHeaders.get("referer");
  if (supplied) {
    try {
      return new URL(supplied).origin;
    } catch {
      // Direct page requests often have neither Origin nor Referer.
    }
  }
  const host =
    requestHeaders.get("x-forwarded-host")?.split(",")[0].trim() ||
    requestHeaders.get("host");
  if (!host) return "";
  const protocol =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim() ||
    (process.env.NODE_ENV === "production" ? "https" : "http");
  return new URL(`${protocol}://${host}`).origin;
}
