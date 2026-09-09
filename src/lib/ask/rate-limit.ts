import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { usageCounters } from "@/db/schema";

/**
 * Fixed-window rate limit backed by Postgres, so it is shared across serverless
 * instances (not a per-process Map). Atomic upsert + increment.
 */
export interface LimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetAt: string;
}

export async function checkAndIncrement(
  scope: string,
  limit: number,
  windowMs: number,
): Promise<LimitResult> {
  const db = await getDb();
  const now = Date.now();
  const windowStart = new Date(now - (now % windowMs));
  const resetAt = new Date(windowStart.getTime() + windowMs).toISOString();

  // Upsert-and-increment in one statement.
  const [row] = await db
    .insert(usageCounters)
    .values({ scope, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [usageCounters.scope, usageCounters.windowStart],
      set: { count: sql`${usageCounters.count} + 1` },
    })
    .returning({ count: usageCounters.count });

  const count = row?.count ?? 1;
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    limit,
    resetAt,
  };
}

/** Best-effort cleanup of stale windows; safe to call opportunistically. */
export async function sweepUsage(olderThanMs = 24 * 3600_000): Promise<void> {
  const db = await getDb();
  await db
    .delete(usageCounters)
    .where(sql`${usageCounters.windowStart} < ${new Date(Date.now() - olderThanMs)}`);
}
