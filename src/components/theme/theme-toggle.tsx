"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import {
  LEGACY_THEME_KEY,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  type ResolvedTheme,
} from "@/lib/theme";

/**
 * Light/dark switch. Reads the theme the pre-paint script already resolved
 * (`<html data-theme>`), and on change writes the cookie (server-authoritative),
 * mirrors the legacy localStorage key, updates `data-theme`, and — when signed
 * in — persists to `user_preferences` via the optional `onPersist` action.
 */
export function ThemeToggle({
  onPersist,
}: {
  onPersist?: (theme: ResolvedTheme) => void | Promise<void>;
}) {
  const [theme, setThemeState] = useState<ResolvedTheme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setThemeState(current === "light" ? "light" : "dark");
    setMounted(true);
  }, []);

  function apply(next: ResolvedTheme) {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next};path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax`;
    try {
      localStorage.setItem(LEGACY_THEME_KEY, next);
    } catch {
      /* ignore */
    }
    void onPersist?.(next);
  }

  return (
    <button
      type="button"
      onClick={() => apply(theme === "dark" ? "light" : "dark")}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="grid h-8 w-8 place-items-center rounded-[9px] border border-default text-secondary transition-colors hover:text-primary"
    >
      {/* Render nothing theme-specific until mounted to avoid a hydration flip. */}
      {mounted ? theme === "dark" ? <Sun size={15} /> : <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}
