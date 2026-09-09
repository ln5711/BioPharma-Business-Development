import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userPreferences, type Priority } from "@/db/schema";
import { recommendedById } from "@/lib/priorities";

export type HomeRange = "24h" | "7d" | "30d";

export const RANGE_MS: Record<HomeRange, number> = {
  "24h": 24 * 3600_000,
  "7d": 7 * 24 * 3600_000,
  "30d": 30 * 24 * 3600_000,
};

export interface UserPrefs {
  priorities: Priority[];
  watchCompanies: string[];
  therapeuticAreas: string[];
  biomarkers: string[];
  pathways: string[];
  homeRange: HomeRange;
  onboardedAt: Date | null;
}

const EMPTY: UserPrefs = {
  priorities: [],
  watchCompanies: [],
  therapeuticAreas: [],
  biomarkers: [],
  pathways: [],
  homeRange: "24h",
  onboardedAt: null,
};

export async function getUserPrefs(userId: string): Promise<UserPrefs> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  if (!row) return EMPTY;
  return {
    priorities: [...row.priorities].sort((a, b) => a.order - b.order),
    watchCompanies: row.watchCompanies,
    therapeuticAreas: row.therapeuticAreas,
    biomarkers: row.biomarkers,
    pathways: row.pathways,
    homeRange: (["24h", "7d", "30d"].includes(row.homeRange) ? row.homeRange : "24h") as HomeRange,
    onboardedAt: row.onboardedAt,
  };
}

/** Build Priority rows from onboarding input (recommended ids + custom text). */
export function buildPriorities(recommendedIds: string[], customTexts: string[]): Priority[] {
  const out: Priority[] = [];
  let order = 0;
  for (const id of recommendedIds) {
    const rec = recommendedById(id);
    if (!rec) continue;
    out.push({ id: randomUUID(), recommendedId: id, text: rec.label, paused: false, order: order++ });
  }
  for (const text of customTexts.map((t) => t.trim()).filter(Boolean)) {
    out.push({ id: randomUUID(), text, paused: false, order: order++ });
  }
  return out;
}

/** Keywords a priority contributes to matching (recommended catalogue + its own words). */
export function priorityKeywords(p: Priority): string[] {
  const rec = p.recommendedId ? recommendedById(p.recommendedId) : undefined;
  const own = p.text
    .toLowerCase()
    .replace(/[^a-z0-9 /-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
  return [...(rec?.match ?? []), ...own];
}

const STOP = new Set([
  "find",
  "help",
  "with",
  "that",
  "this",
  "from",
  "into",
  "companies",
  "company",
  "track",
  "tracking",
  "focus",
  "prepare",
  "meeting",
  "meetings",
  "identify",
  "research",
  "opportunities",
  "prospective",
  "starting",
  "entering",
  "expand",
  "business",
]);
