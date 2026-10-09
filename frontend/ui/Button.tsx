import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "outline" | "ghost" | "unstyled";
};

const variants = {
  primary:
    "rounded-[10px] bg-workspace-accent px-4 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60",
  outline:
    "rounded-[10px] border border-workspace-border bg-workspace-surface px-4 py-3 text-sm text-workspace-text hover:border-workspace-accent disabled:opacity-60",
  ghost:
    "rounded-lg px-3 py-2 text-sm text-workspace-muted hover:text-workspace-accent disabled:opacity-60",
  unstyled: "",
};

export function Button({
  type = "button",
  variant = "unstyled",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`${variants[variant]} ${className}`.trim()}
    />
  );
}
