import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import {
  type Theme,
  ThemeProvider,
} from "@/components/providers/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NeuralText | NLP workspace",
  description: "Understand your documents with intelligent NLP analysis.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const preference = (await cookies()).get("neuraltext-theme")?.value;
  const theme: Theme =
    preference === "light" || preference === "dark" ? preference : "system";
  return (
    <html
      lang="en"
      data-theme={theme}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scheme-light dark:scheme-dark`}
    >
      <body className="flex min-h-full flex-col bg-workspace-bg text-workspace-text selection:bg-workspace-highlight selection:text-workspace-text [&_input]:accent-workspace-primary [&_textarea]:accent-workspace-primary [&_select]:accent-workspace-primary [&_input]:placeholder:text-workspace-muted [&_textarea]:placeholder:text-workspace-muted **:focus-visible:outline-2 **:focus-visible:outline-workspace-accent **:focus-visible:outline-offset-3 motion-reduce:**:animate-none motion-reduce:**:transition-none motion-reduce:**:scroll-auto">
        <Script id="theme-initialization" strategy="beforeInteractive">
          {`if(document.documentElement.dataset.theme==='system'){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}`}
        </Script>
        <ThemeProvider initialTheme={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
