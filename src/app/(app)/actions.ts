"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { revokeSessions, signOut } from "@/lib/auth";
import { getOptionalAuth } from "@/lib/tenant";
import { setThemeChoice } from "@/lib/theme-actions";
import type { ResolvedTheme } from "@/lib/theme";

export async function signOutAction() {
  await signOut();
  revalidatePath("/", "layout");
  redirect("/welcome");
}

/** Sign out of this device AND invalidate every other session for the user. */
export async function signOutEverywhereAction() {
  const auth = await getOptionalAuth();
  if (auth) await revokeSessions(auth.user.id);
  await signOut();
  revalidatePath("/", "layout");
  redirect("/welcome");
}

/** Persist the signed-in user's theme choice to their preferences + cookie. */
export async function persistThemeAction(theme: ResolvedTheme) {
  await setThemeChoice(theme);
}
