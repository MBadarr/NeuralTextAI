"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "light" | "dark" | "system";
const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme: Theme;
}) {
  const [theme, updateTheme] = useState(initialTheme);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  function setTheme(value: Theme) {
    // biome-ignore lint/suspicious/noDocumentCookie: This non-sensitive preference needs broad browser support and server rendering.
    document.cookie = `neuraltext-theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    updateTheme(value);
  }
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeToggle() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeToggle requires ThemeProvider.");
  const { theme, setTheme } = context;
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Color theme: ${theme}. Change color theme`}
      onClick={() =>
        setTheme(
          theme === "system" ? "light" : theme === "light" ? "dark" : "system",
        )
      }
    >
      <span aria-hidden="true">
        {theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}
      </span>
      <span>
        {theme === "system" ? "System" : theme === "light" ? "Light" : "Dark"}
      </span>
    </button>
  );
}
