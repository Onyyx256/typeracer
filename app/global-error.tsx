"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";
import { ErrorMessage } from "@/app/components/error-message";
import { localeFromPathname } from "@/lib/i18n/config";
import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

/**
 * Replaces the whole document when the root layout itself crashes, so it
 * brings its own <html>, styles and theme (the layout's theme script is gone).
 */
export default function GlobalError({ error, retry }: GlobalErrorProps) {
  const locale = localeFromPathname(usePathname());

  useLayoutEffect(() => {
    let theme: string | null = null;
    try {
      theme = localStorage.getItem("theme");
    } catch {
      // Storage unavailable: fall back to the system theme.
    }
    if (theme !== "light" && theme !== "dark") {
      theme = matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={locale} data-theme="light" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <ErrorMessage locale={locale} retry={retry} />
      </body>
    </html>
  );
}
