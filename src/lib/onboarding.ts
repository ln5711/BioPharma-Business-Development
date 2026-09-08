import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userOnboarding } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";

export interface OnboardingStatus {
  tenantId: string;
  userId: string;
  userName: string;
  needsOnboarding: boolean;
}

/**
 * Whether the active user still needs the first-run welcome flow: no
 * `user_onboarding` row, or one without `completedAt`.
 */
export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();
  const [row] = await db
    .select({ completedAt: userOnboarding.completedAt })
    .from(userOnboarding)
    .where(eq(userOnboarding.userId, user.id))
    .limit(1);

  return {
    tenantId: tenant.id,
    userId: user.id,
    userName: user.name,
    needsOnboarding: !row || !row.completedAt,
  };
}
