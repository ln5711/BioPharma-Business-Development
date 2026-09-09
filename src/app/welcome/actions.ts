"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, isThemeChoice } from "@/lib/theme";
import {
  capabilityProfiles,
  organizationMembers,
  scoringProfiles,
  tenants,
  userPreferences,
  users,
} from "@/db/schema";
import { authConfigured, createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { buildPriorities } from "@/lib/user-prefs";
import { recommendedById } from "@/lib/priorities";
import { getOptionalAuth } from "@/lib/tenant";
import { DEFAULT_WEIGHTS } from "@/lib/scoring/model";

export type AuthResult = { ok: true } | { ok: false; error: string };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "workspace";

/** Bare host name, no scheme/path/port. Empty string means "not provided". */
function normalizeDomain(raw: string): string {
  const host = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "");
  return host;
}
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid work email").max(200),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  orgName: z.string().trim().min(1, "Organization name is required").max(160),
  orgDomain: z.string().trim().max(200).optional().default(""),
  recommendedIds: z.array(z.string().max(60)).max(30).default([]),
  customPriorities: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  customDraft: z.string().trim().max(200).optional().default(""),
});

/**
 * Postgres / PGlite unique-violation (SQLSTATE 23505). Drizzle wraps driver
 * errors, so the real code/detail can sit on `err.cause` — unwrap a couple of
 * levels and also fall back to matching the constraint name in the message.
 */
function isUniqueViolation(err: unknown): { email: boolean; slug: boolean } | null {
  let hay = "";
  let hit = false;
  let cur: unknown = err;
  for (let i = 0; i < 4 && cur; i++) {
    const e = cur as {
      code?: string;
      constraint_name?: string;
      constraint?: string;
      detail?: string;
      message?: string;
      cause?: unknown;
    };
    if (e.code === "23505") hit = true;
    hay += ` ${e.constraint_name ?? ""} ${e.constraint ?? ""} ${e.detail ?? ""} ${e.message ?? ""}`;
    cur = e.cause;
  }
  hay = hay.toLowerCase();
  if (!hit && !hay.includes("unique") && !hay.includes("duplicate")) return null;
  return {
    email: hay.includes("email"),
    slug: hay.includes("slug") || hay.includes("tenants_slug"),
  };
}

/** Create the USER + ORGANIZATION/WORKSPACE, link them, store priorities, sign in. */
export async function createAccount(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  if (!authConfigured()) {
    return {
      ok: false,
      error: "Sign-up is temporarily unavailable (server auth is not configured). Please try again later.",
    };
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    orgName: formData.get("orgName"),
    orgDomain: formData.get("orgDomain") ?? "",
    recommendedIds: formData.getAll("recommendedIds").map(String),
    customPriorities: formData.getAll("customPriorities").map(String),
    customDraft: formData.get("customDraft") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const d = parsed.data;

  // ── Normalize & validate priorities ──────────────────────────────────────
  // Unknown recommended ids are a client/version mismatch — reject rather than
  // silently drop them.
  const recIds = [...new Set(d.recommendedIds)];
  const unknown = recIds.filter((id) => !recommendedById(id));
  if (unknown.length) {
    return { ok: false, error: "Some selected priorities are no longer available. Reload and try again." };
  }
  // A priority the user typed but never added with "+" must not be lost.
  const customs: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...d.customPriorities, d.customDraft]) {
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    customs.push(v.slice(0, 200));
    if (customs.length >= 30) break;
  }

  // ── Validate domain ──────────────────────────────────────────────────────
  const domain = normalizeDomain(d.orgDomain);
  if (domain && !DOMAIN_RE.test(domain)) {
    return { ok: false, error: "Enter a valid website or domain (e.g. company.com)." };
  }

  const db = await getDb();

  // Friendly fast-path check; the unique constraint below is the real guard.
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, d.email))
    .limit(1);
  if (existing) {
    return { ok: false, error: "An account with that email already exists. Sign in instead." };
  }

  const now = new Date();
  const base = slugify(d.orgName);
  const priorities = buildPriorities(recIds, customs);
  const passwordHash = hashPassword(d.password);

  // ── Atomic account creation ──────────────────────────────────────────────
  // Every related row is written in ONE transaction: a mid-way failure rolls
  // the whole thing back, so a retry never leaves an orphaned workspace/user.
  // Concurrency is handled by the unique constraints (email, slug), not by the
  // pre-insert SELECT above.
  let created: { userId: string; tenantId: string } | null = null;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < 4 && !created; attempt++) {
    const slug =
      attempt === 0
        ? base
        : `${base}-${Math.random().toString(36).slice(2, 7)}`.slice(0, 40);
    try {
      created = await db.transaction(async (tx) => {
        const [tenant] = await tx
          .insert(tenants)
          .values({
            name: d.orgName,
            slug,
            domain: domain || null,
            website: d.orgDomain.trim() || null,
          })
          .returning({ id: tenants.id });

        const [user] = await tx
          .insert(users)
          .values({
            tenantId: tenant.id,
            email: d.email,
            name: d.name,
            role: "owner",
            passwordHash,
            lastLoginAt: now,
          })
          .returning({ id: users.id });

        await tx.insert(organizationMembers).values({
          tenantId: tenant.id,
          userId: user.id,
          role: "owner",
        });

        await tx.insert(userPreferences).values({
          userId: user.id,
          tenantId: tenant.id,
          priorities,
          onboardedAt: now,
        });

        await tx
          .insert(capabilityProfiles)
          .values({ tenantId: tenant.id, companyName: d.orgName });

        await tx.insert(scoringProfiles).values({
          tenantId: tenant.id,
          name: "Default (balanced)",
          isDefault: true,
          weights: DEFAULT_WEIGHTS,
        });

        return { userId: user.id, tenantId: tenant.id };
      });
    } catch (err) {
      lastErr = err;
      const dup = isUniqueViolation(err);
      if (dup?.email) {
        return { ok: false, error: "An account with that email already exists. Sign in instead." };
      }
      if (dup?.slug) continue; // race on the workspace slug — retry with a fresh one
      throw err; // unexpected: let it surface, transaction already rolled back
    }
  }

  if (!created) {
    console.error("[signup] exhausted slug retries", lastErr);
    return { ok: false, error: "Could not create the workspace. Please try again." };
  }

  // Session + redirect happen only after a committed transaction, and the
  // redirect stays outside every try/catch.
  await createSession(created);
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Finish onboarding for an ALREADY-authenticated user who has no `onboardedAt`
 * yet (e.g. account row exists from a partial signup, or a future invite flow).
 * Does NOT create a user/tenant/membership — just writes their priorities and
 * stamps `onboardedAt`. The single canonical completion flag.
 */
export async function completeOnboarding(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const auth = await getOptionalAuth();
  if (!auth) return { ok: false, error: "Please sign in again." };

  const recIds = [...new Set(formData.getAll("recommendedIds").map(String))].filter((id) =>
    recommendedById(id),
  );
  const customs: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...formData.getAll("customPriorities").map(String), String(formData.get("customDraft") ?? "")]) {
    const v = raw.trim().slice(0, 200);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    customs.push(v);
    if (customs.length >= 30) break;
  }
  if (recIds.length === 0 && customs.length === 0) {
    return { ok: false, error: "Pick at least one priority to continue." };
  }

  const db = await getDb();
  const now = new Date();
  await db
    .insert(userPreferences)
    .values({
      userId: auth.user.id,
      tenantId: auth.tenant.id,
      priorities: buildPriorities(recIds, customs),
      onboardedAt: now,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { priorities: buildPriorities(recIds, customs), onboardedAt: now, updatedAt: now },
    });

  revalidatePath("/", "layout");
  redirect("/");
}

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export async function signIn(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  if (!authConfigured()) {
    return { ok: false, error: "Sign-in is temporarily unavailable. Please try again later." };
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  // Same generic message whether the email is unknown or the password is wrong.
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return { ok: false, error: "Email or password is incorrect." };
  }

  // The session's tenant must come from an authoritative membership row.
  const [member] = await db
    .select({ tenantId: organizationMembers.tenantId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, user.id))
    .orderBy(organizationMembers.joinedAt)
    .limit(1);
  if (!member) {
    console.error("[signin] user has no organization_members row", user.id);
    return { ok: false, error: "Your account is not linked to a workspace. Contact support." };
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession({ userId: user.id, tenantId: member.tenantId });

  // Carry the user's saved theme onto this device.
  const [prefs] = await db
    .select({ theme: userPreferences.theme })
    .from(userPreferences)
    .where(eq(userPreferences.userId, user.id))
    .limit(1);
  if (prefs?.theme && isThemeChoice(prefs.theme)) {
    (await cookies()).set(THEME_COOKIE, prefs.theme, {
      sameSite: "lax",
      path: "/",
      maxAge: THEME_COOKIE_MAX_AGE,
    });
  }

  revalidatePath("/", "layout");
  redirect("/");
}
