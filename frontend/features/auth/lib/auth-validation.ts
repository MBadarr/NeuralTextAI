export type AuthFormMode =
  | "sign-in"
  | "sign-up"
  | "verify"
  | "forgot-password"
  | "reset-code"
  | "reset-password";
export type AuthField =
  | "name"
  | "email"
  | "password"
  | "otp"
  | "confirmPassword";
export type AuthValues = Record<AuthField, string>;
export const emptyAuthValues: AuthValues = {
  name: "",
  email: "",
  password: "",
  otp: "",
  confirmPassword: "",
};

export function emailError(value: string): string {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "Enter a valid email address, such as you@example.com.";
  return "";
}
export function passwordError(value: string): string {
  if (!value.trim()) return "Enter a password.";
  if (value.length < 8)
    return `Use at least 8 characters (${8 - value.length} more needed).`;
  if (value.length > 128) return "Use no more than 128 characters.";
  return "";
}
export function validateAuthValues(
  mode: AuthFormMode,
  values: AuthValues,
): Partial<Record<AuthField, string>> {
  const errors: Partial<Record<AuthField, string>> = {};
  const email = emailError(values.email);
  if (email) errors.email = email;
  if (mode === "sign-up") {
    if (values.name.trim().length < 2)
      errors.name = "Enter your full name using at least 2 characters.";
    else if (values.name.trim().length > 100)
      errors.name = "Use no more than 100 characters for your name.";
  }
  if (["sign-in", "sign-up", "reset-password"].includes(mode)) {
    const password = passwordError(values.password);
    if (password) errors.password = password;
  }
  if (mode === "verify" || mode === "reset-code") {
    if (!/^\d{6}$/.test(values.otp.trim()))
      errors.otp = "Enter the 6-digit code from your email.";
  }
  if (mode === "reset-password") {
    if (!values.confirmPassword)
      errors.confirmPassword = "Confirm your new password.";
    else if (values.password !== values.confirmPassword)
      errors.confirmPassword =
        "Passwords do not match. Enter the same password in both fields.";
  }
  return errors;
}
