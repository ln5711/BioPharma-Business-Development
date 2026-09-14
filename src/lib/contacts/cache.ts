import "server-only";
import { createHash } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { researchCache } from "@/db/schema";
import type { Extraction } from "./types";

/**
 * Reuses the shared `research_cache` table (also used by Ask newwin's public
 * research) under a distinct key namespace. Never contains tenant-specific
 * state — only the public research findings — so it is safe to reuse across
 * tenants searching the same company/query.
 */
const TTL_MS = 7 * 24 * 3600_000; // 7 days — "refresh controls" via forceRefresh

export function contactDiscoveryCacheKey(companyKey: string, querySig: string): string {
  const shape = JSON.stringify({ c: companyKey.trim().toLowerCase(), q: querySig.trim().toLowerCase() });
  return "cd_v1_" + createHash("sha256").update(shape).digest("hex").slice(0, 40);
}

export async function getCachedExtraction(key: string): Promise<{ extraction: Extraction; ageMs: number } | null> {
  try {
    const db = await getDb();
    const [row] = await db
      .select({ payload: researchCache.payload, createdAt: researchCache.createdAt })
      .from(researchCache)
      .where(eq(researchCache.key, key))
      .limit(1);
    if (!row) return null;
    const ageMs = Date.now() - new Date(row.createdAt as unknown as string).getTime();
    if (ageMs > TTL_MS) return null;
    return { extraction: row.payload as unknown as Extraction, ageMs };
  } catch {
    return null; // cache is best-effort
  }
}

export async function putCachedExtraction(key: string, extraction: Extraction): Promise<void> {
  try {
    const db = await getDb();
    await db
      .insert(researchCache)
      .values({ key, payload: extraction as unknown as Record<string, unknown>, createdAt: new Date() })
      .onConflictDoUpdate({
        target: researchCache.key,
        set: { payload: extraction as unknown as Record<string, unknown>, createdAt: new Date() },
      });
    await db.delete(researchCache).where(lt(researchCache.createdAt, new Date(Date.now() - TTL_MS)));
  } catch {
    /* best-effort */
  }
}
