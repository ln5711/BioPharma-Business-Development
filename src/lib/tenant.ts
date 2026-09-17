import "server-only";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { organizationMembers, tenants, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { DEMO_USER_EMAIL } from "@/lib/demo/constants";

export type AuthContext = {
  tenant: typeof tenants.$inferSelect;
  user: typeof users.$inferSelect;
  /** Always true for a resolved context — kept for call-site compatibility. */
  authenticated: true;
};

/**
 * Resolves the signed-in USER and their ORGANIZATION/WORKSPACE from a verified
 * session, or `null`.
 *
 * There is deliberately NO fallback to "the first user / first tenant in the
 * database": production identity must come from an authenticated session and an
 * authoritative `organization_members` row. If the session names a tenant the
 * user is not a member of, that is a failure — we do not silently substitute
 * `user.tenantId`.
 */
export async function getOptionalAuth(): Promise<AuthContext | null> {
  // Demo build: no real login. Every visitor is the seeded demo user — see
  // src/lib/demo/seed.ts. This never consults a session cookie, so it is
  // unaffected by AUTH_SECRET being unset/default in this environment.
  if (env.DEMO_MODE) {
    const db = await getDb();
    const [demoUser] = await db.select().from(users).where(eq(users.email, DEMO_USER_EMAIL)).limit(1);
    if (!demoUser) return null; // seeding hasn't run yet — should not happen once getDb() resolves
    const [demoTenant] = await db.select().from(tenants).where(eq(tenants.id, demoUser.tenantId)).limit(1);
    if (!demoTenant) return null;
    return { tenant: demoTenant, user: demoUser, authenticated: true };
  }

  const session = await getSession();
  if (!session) return null;

  const db = await getDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) return null;

  // Revocation: any session issued at or before `sessions_revoked_at` is dead
  // (password change, "sign out everywhere", forced revocation).
  if (
    user.sessionsRevokedAt &&
    (typeof session.iat !== "number" || session.iat <= user.sessionsRevokedAt.getTime())
  ) {
    return null;
  }

  const [member] = await db
    .select({ tenantId: organizationMembers.tenantId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, user.id),
        eq(organizationMembers.tenantId, session.tenantId),
      ),
    )
    .limit(1);
  if (!member) return null;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, member.tenantId))
    .limit(1);
  if (!tenant) return null;

  return { tenant, user, authenticated: true };
}

/**
 * Page/action guard: returns the authenticated context or redirects to the
 * public welcome screen. Use this from anything that renders or mutates
 * tenant-scoped data.
 */
export async function getActiveTenant(): Promise<AuthContext> {
  const ctx = await getOptionalAuth();
  if (!ctx) redirect("/welcome");
  return ctx;
}
