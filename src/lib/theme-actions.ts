import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userPreferences } from "@/db/schema";
import { getOptionalAuth } from "@/lib/tenant";
import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  isThemeChoice,
  type ThemeChoice,
} from "@/lib/theme";

/** Server-side: the stored theme choice, defaulting to "system". */
export async function getThemeCookie(): Promise<ThemeChoice> {
  const raw = (await cookies()).get(THEME_COOKIE)?.value;
  return isThemeChoice(raw) ? raw : "system";
}

/**
 * Writes the theme choice to the first-party cookie (server-authoritative for
 * SSR) and, for a signed-in user, to `user_preferences.theme` so it follows them
 * across devices.
 */
export async function setThemeChoice(choice: ThemeChoice): Promise<void> {
  if (!isThemeChoice(choice)) return;

  (await cookies()).set(THEME_COOKIE, choice, {
    httpOnly: false, // the pre-paint script and toggle read it in JS
    sameSite: "lax",
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
  });

  const auth = await getOptionalAuth();
  if (!auth) return;
  const db = await getDb();
  await db
    .update(userPreferences)
    .set({ theme: choice, updatedAt: new Date() })
    .where(eq(userPreferences.userId, auth.user.id));
}
