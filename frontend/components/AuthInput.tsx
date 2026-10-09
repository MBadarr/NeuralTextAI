import type { ComponentProps } from "react";

export function AuthInput({
  className = "",
  variant,
  ...props
}: ComponentProps<"input"> & { variant?: "otp" }) {
  return (
    <input
      {...props}
      className={`w-full rounded-[10px] border border-workspace-border bg-workspace-surface px-3.5 text-workspace-text outline-none transition placeholder:text-workspace-muted/85 focus:border-workspace-accent focus:ring-3 focus:ring-workspace-accent-soft aria-invalid:border-workspace-danger aria-invalid:focus:ring-workspace-danger-soft motion-reduce:transition-none ${variant === "otp" ? "h-15 text-center text-[25px] tracking-[0.4em] tabular-nums" : "h-11.75 text-[13px]"} ${className}`}
    />
  );
}
