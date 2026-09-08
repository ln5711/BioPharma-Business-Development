import "server-only";
import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { tenants, users } from "@/db/schema";

/**
 * MVP 1 runs single-tenant: the active tenant is simply the first one seeded.
 * Auth + real tenant resolution arrive with MVP 3 (spec §64 / §80). Every query
 * already filters by `tenantId`, so multi-tenant is a drop-in later.
 */
export async function getActiveTenant() {
  const db = await getDb();
  const [tenant] = await db.select().from(tenants).orderBy(asc(tenants.createdAt)).limit(1);
  if (!tenant) {
    throw new Error(
      "No tenant found. Run `npm run db:migrate && npm run seed` first.",
    );
  }
  const [user] = await db
    .select()
    .from(users)
    .orderBy(asc(users.createdAt))
    .limit(1);
  return { tenant, user };
}
