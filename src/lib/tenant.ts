import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { organizationMembers, tenants, users } from "@/db/schema";
import { getSession } from "@/lib/auth";

export type ActiveTenant = {
  tenant: typeof tenants.$inferSelect;
  user: typeof users.$inferSelect;
  /** null when falling back to the seeded demo workspace (no session). */
  authenticated: boolean;
};

/**
 * Resolves the active USER + ORGANIZATION/WORKSPACE.
 *
 *  1. A valid signed session → that user + their organization (membership checked).
 *  2. No session → the first seeded tenant/user, so the demo data still renders.
 */
export async function getActiveTenant(): Promise<ActiveTenant> {
  const db = await getDb();
  const session = await getSession();

  if (session) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (user) {
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
      const tenantId = member?.tenantId ?? user.tenantId;
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      if (tenant) return { tenant, user, authenticated: true };
    }
  }

  const [tenant] = await db.select().from(tenants).orderBy(asc(tenants.createdAt)).limit(1);
  if (!tenant) {
    throw new Error("No workspace found. Run `npm run db:migrate && npm run seed` first.");
  }
  const [user] = await db.select().from(users).orderBy(asc(users.createdAt)).limit(1);
  return { tenant, user, authenticated: false };
}
