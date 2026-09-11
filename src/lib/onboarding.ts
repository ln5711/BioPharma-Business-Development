import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userPreferences } from "@/db/schema";
import { getOptionalAuth } from "@/lib/tenant";

export interface OnboardingStatus {
  tenantId: string | null;
  userId: string | null;
  userName: string | null;
  authenticated: boolean;
  needsOnboarding: boolean;
}

const SIGNED_OUT: OnboardingStatus = {
  tenantId: null,
  userId: null,
  userName: null,
  authenticated: false,
  needsOnboarding: false,
};

/**
 * Server-side routing state. Never throws for a signed-out visitor and never
 * touches tenant data without a verified session — so the public welcome screen
 * renders on a completely empty database.
 *
 *  - no / invalid / expired session      → signed out
 *  - authenticated, no `onboardedAt`     → needs the short completion form
 *  - authenticated, `onboardedAt` set    → ready for Home
 */
export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const auth = await getOptionalAuth();
  if (!auth) return SIGNED_OUT;

  const db = await getDb();
  const [prefs] = await db
    .select({ onboardedAt: userPreferences.onboardedAt })
    .from(userPreferences)
    .where(eq(userPreferences.userId, auth.user.id))
    .limit(1);

  return {
    tenantId: auth.tenant.id,
    userId: auth.user.id,
    userName: auth.user.name,
    authenticated: true,
    needsOnboarding: !prefs?.onboardedAt,
  };
}
