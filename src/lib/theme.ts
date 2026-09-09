/**
 * Shared, client-safe theme constants and helpers used by BOTH the public
 * welcome screen and the authenticated app. No server-only imports here so the
 * pre-paint script and the toggle button can use it.
 *
 * The user's choice lives in a first-party cookie so the server renders the
 * correct `data-theme` on the first paint (no FOUC, no hydration mismatch). For
 * signed-in users it is also mirrored into `user_preferences.theme` (see
 * `theme-actions.ts`); the legacy `obd-theme` localStorage key is migrated on
 * the client by the pre-paint script.
 */

export type ThemeChoice = "system" | "light" | "dark";
/** What actually gets written to `data-theme` (system is resolved away). */
export type ResolvedTheme = "light" | "dark";

export const THEME_COOKIE = "nw-theme";
export const LEGACY_THEME_KEY = "obd-theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isThemeChoice(v: unknown): v is ThemeChoice {
  return v === "system" || v === "light" || v === "dark";
}

/**
 * The theme to stamp on <html> during SSR. "system" can't be resolved on the
 * server, so it renders `dark` (the brand default) and the pre-paint script
 * corrects it to match the OS before the body renders.
 */
export function resolveForSSR(choice: ThemeChoice): ResolvedTheme {
  return choice === "light" ? "light" : "dark";
}
