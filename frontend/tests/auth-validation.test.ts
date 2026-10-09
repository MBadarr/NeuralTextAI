import { describe, expect, it } from "vitest";
import {
  emailError,
  emptyAuthValues,
  passwordError,
  validateAuthValues,
} from "@/features/auth/lib/auth-validation";

describe("auth validation policy", () => {
  it("validates recovery codes separately from new passwords", () => {
    const values = {
      ...emptyAuthValues,
      email: "test@example.com",
      otp: "123456",
    };
    expect(validateAuthValues("reset-code", values)).toEqual({});
    expect(
      validateAuthValues("reset-code", { ...values, otp: "12ab" }).otp,
    ).toBeTruthy();
    expect(
      validateAuthValues("reset-password", {
        ...values,
        otp: "",
        password: "new-password",
        confirmPassword: "new-password",
      }),
    ).toEqual({});
  });
  it("uses the provider-compatible password limits on all password forms", () => {
    expect(passwordError("1234567")).toContain("8 characters");
    expect(passwordError("12345678")).toBe("");
    expect(passwordError("a".repeat(128))).toBe("");
    expect(passwordError("a".repeat(129))).toContain("128");
    expect(passwordError("        ")).toBe("Enter a password.");
    expect(
      validateAuthValues("sign-in", {
        ...emptyAuthValues,
        email: "test@example.com",
        password: "short",
      }).password,
    ).toContain("8 characters");
  });
  it("validates email without altering the password or requiring invented character rules", () => {
    expect(emailError(" user@example.com ")).toBe("");
    expect(emailError("user@example")).not.toBe("");
    expect(emailError("user name@example.com")).not.toBe("");
    expect(passwordError("eight spaces and words")).toBe("");
  });
  it("rejects whitespace names and malformed codes on the correct forms", () => {
    const values = {
      ...emptyAuthValues,
      email: "test@example.com",
      password: "valid-password",
      name: "  ",
      otp: "12345a",
    };
    expect(validateAuthValues("sign-up", values).name).toBeTruthy();
    expect(validateAuthValues("verify", values).otp).toBeTruthy();
    expect(validateAuthValues("forgot-password", values)).toEqual({});
  });
});
