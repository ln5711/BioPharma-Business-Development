import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userPreferences, type Priority } from "@/db/schema";
import { recommendedById } from "@/lib/priorities";

/**
 * Single source of truth for a user's saved priorities. A priority is a stored
 * preference that influences ranking — distinct from a task (an action) and a
 * workspace (a container). Recommended and custom priorities share this model.
 *
 * Every mutation here: validates + bounds input, keeps stable ids, renumbers
 * `order` densely, and writes the whole array back atomically.
 */

export const MAX_PRIORITIES = 20;
export const MAX_PRIORITY_LEN = 200;

export interface PriorityMutationResult {
  ok: boolean;
  error?: string;
  priorities: Priority[];
}

function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_PRIORITY_LEN);
}

async function load(userId: string): Promise<Priority[]> {
  const db = await getDb();
  const [row] = await db
    .select({ priorities: userPreferences.priorities })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return [...(row?.priorities ?? [])].sort((a, b) => a.order - b.order);
}

async function persist(
  userId: string,
  tenantId: string,
  list: Priority[],
): Promise<Priority[]> {
  const db = await getDb();
  const ordered = list.map((p, i) => ({ ...p, order: i }));
  await db
    .insert(userPreferences)
    .values({ userId, tenantId, priorities: ordered, onboardedAt: new Date() })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { priorities: ordered, updatedAt: new Date() },
    });
  return ordered;
}

export async function getPriorities(userId: string): Promise<Priority[]> {
  return load(userId);
}

/** Add a custom or recommended priority. Rejects blanks, dupes and overflow. */
export async function addPriority(
  userId: string,
  tenantId: string,
  input: { text?: string; recommendedId?: string },
): Promise<PriorityMutationResult> {
  const list = await load(userId);
  if (list.length >= MAX_PRIORITIES) {
    return { ok: false, error: `You can track up to ${MAX_PRIORITIES} priorities.`, priorities: list };
  }

  let text: string;
  let recommendedId: string | undefined;
  if (input.recommendedId) {
    const rec = recommendedById(input.recommendedId);
    if (!rec) return { ok: false, error: "Unknown recommended priority.", priorities: list };
    recommendedId = rec.id;
    text = rec.label;
    if (list.some((p) => p.recommendedId === rec.id)) {
      return { ok: false, error: "That priority is already on your list.", priorities: list };
    }
  } else {
    text = normalizeText(input.text ?? "");
    if (text.length < 2) {
      return { ok: false, error: "Enter a priority (at least 2 characters).", priorities: list };
    }
    if (list.some((p) => !p.recommendedId && p.text.toLowerCase() === text.toLowerCase())) {
      return { ok: false, error: "You already have that priority.", priorities: list };
    }
  }

  const next: Priority[] = [
    ...list,
    { id: randomUUID(), recommendedId, text, paused: false, order: list.length },
  ];
  return { ok: true, priorities: await persist(userId, tenantId, next) };
}

/** Rename a custom priority (recommended ones keep their catalogue label). */
export async function editPriority(
  userId: string,
  tenantId: string,
  id: string,
  rawText: string,
): Promise<PriorityMutationResult> {
  const list = await load(userId);
  const target = list.find((p) => p.id === id);
  if (!target) return { ok: false, error: "Priority not found.", priorities: list };
  if (target.recommendedId) {
    return { ok: false, error: "Recommended priorities can't be renamed.", priorities: list };
  }
  const text = normalizeText(rawText);
  if (text.length < 2) return { ok: false, error: "Enter at least 2 characters.", priorities: list };
  const next = list.map((p) => (p.id === id ? { ...p, text } : p));
  return { ok: true, priorities: await persist(userId, tenantId, next) };
}

export async function removePriority(
  userId: string,
  tenantId: string,
  id: string,
): Promise<PriorityMutationResult> {
  const list = await load(userId);
  const next = list.filter((p) => p.id !== id);
  if (next.length === list.length) {
    return { ok: false, error: "Priority not found.", priorities: list };
  }
  return { ok: true, priorities: await persist(userId, tenantId, next) };
}

export async function movePriority(
  userId: string,
  tenantId: string,
  id: string,
  dir: "up" | "down",
): Promise<PriorityMutationResult> {
  const list = await load(userId);
  const i = list.findIndex((p) => p.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true, priorities: list };
  [list[i], list[j]] = [list[j], list[i]];
  return { ok: true, priorities: await persist(userId, tenantId, list) };
}

export async function setPriorityPaused(
  userId: string,
  tenantId: string,
  id: string,
  paused: boolean,
): Promise<PriorityMutationResult> {
  const list = await load(userId);
  if (!list.some((p) => p.id === id)) {
    return { ok: false, error: "Priority not found.", priorities: list };
  }
  const next = list.map((p) => (p.id === id ? { ...p, paused } : p));
  return { ok: true, priorities: await persist(userId, tenantId, next) };
}
