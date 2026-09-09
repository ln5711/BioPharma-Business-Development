import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userPreferences } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";

export interface OnboardingStatus {
  tenantId: string;
  userId: string;
  userName: string;
  authenticated: boolean;
  needsOnboarding: boolean;
}

/**
 * A user still needs onboarding when there is no session at all, or their
 * `user_preferences` row has no `onboardedAt`.
 */
export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const { tenant, user, authenticated } = await getActiveTenant();
  const db = await getDb();
  const [prefs] = await db
    .select({ onboardedAt: userPreferences.onboardedAt })
    .from(userPreferences)
    .where(eq(userPreferences.userId, user.id))
    .limit(1);

  return {
    tenantId: tenant.id,
    userId: user.id,
    userName: user.name,
    authenticated,
    // The seeded demo workspace (no session) is treated as already onboarded so
    // the demo data renders; a real signed-in user must have completed prefs.
    needsOnboarding: authenticated ? !prefs?.onboardedAt : false,
  };
}
