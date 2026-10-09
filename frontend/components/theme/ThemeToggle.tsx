"use client";

import { useTheme } from "@/components/providers/ThemeProvider";
import { Button } from "@/ui/Button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      type="button"
      className="inline-flex cursor-pointer items-center gap-2 rounded-[9px] border border-workspace-border bg-workspace-surface px-2.75 py-2 text-[11px] text-workspace-muted"
      aria-label={`Color theme: ${theme}. Change color theme`}
      onClick={() =>
        setTheme(
          theme === "system" ? "light" : theme === "light" ? "dark" : "system",
        )
      }
    >
      <span className="text-base leading-none" aria-hidden="true">
        {theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}
      </span>
      <span>
        {theme === "system" ? "System" : theme === "light" ? "Light" : "Dark"}
      </span>
    </Button>
  );
}
