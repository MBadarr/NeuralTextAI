import { describe, expect, it } from "vitest";
import {
  requestOrigin,
  validateAuthBaseUrl,
} from "@/features/auth/lib/auth-config";

describe("auth provider configuration", () => {
  it("rejects a JWKS URL used in place of the auth base URL", () => {
    expect(() =>
      validateAuthBaseUrl(
        "https://auth.example/neondb/auth/.well-known/jwks.json",
      ),
    ).toThrow("not the JWKS");
    expect(validateAuthBaseUrl("https://auth.example/neondb/auth/")).toBe(
      "https://auth.example/neondb/auth",
    );
  });

  it("rejects missing configuration and credentials embedded in a URL", () => {
    expect(() => validateAuthBaseUrl(undefined)).toThrow("valid Neon Auth");
    expect(() =>
      validateAuthBaseUrl("https://user:password@auth.example/auth"),
    ).toThrow("plain HTTP(S)");
  });

  it("derives the origin for refresh requests without Origin or Referer", () => {
    expect(requestOrigin(new Headers({ host: "localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
    expect(
      requestOrigin(
        new Headers({
          "x-forwarded-host": "app.example",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://app.example");
  });
});
