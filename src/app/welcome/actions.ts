"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  capabilityProfiles,
  organizationMembers,
  scoringProfiles,
  tenants,
  userPreferences,
  users,
} from "@/db/schema";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { buildPriorities } from "@/lib/user-prefs";
import { DEFAULT_WEIGHTS } from "@/lib/scoring/model";

export type AuthResult = { ok: true } | { ok: false; error: string };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "workspace";

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid work email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  orgName: z.string().trim().min(1, "Organization name is required").max(160),
  orgDomain: z.string().trim().max(160).optional().default(""),
  recommendedIds: z.array(z.string()).default([]),
  customPriorities: z.array(z.string().trim().max(200)).default([]),
});

/** Create the USER + ORGANIZATION/WORKSPACE, link them, store priorities, sign in. */
export async function createAccount(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    orgName: formData.get("orgName"),
    orgDomain: formData.get("orgDomain") ?? "",
    recommendedIds: formData.getAll("recommendedIds").map(String),
    customPriorities: formData.getAll("customPriorities").map(String),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const d = parsed.data;
  const db = await getDb();

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
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const [clash] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (!clash) break;
    slug = `${base}-${i}`;
  }

  const domain = d.orgDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  const [tenant] = await db
    .insert(tenants)
    .values({ name: d.orgName, slug, domain: domain || null, website: d.orgDomain || null })
    .returning();

  const [user] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: d.email,
      name: d.name,
      role: "owner",
      passwordHash: hashPassword(d.password),
      lastLoginAt: now,
    })
    .returning();

  await db.insert(organizationMembers).values({
    tenantId: tenant.id,
    userId: user.id,
    role: "owner",
  });

  await db.insert(userPreferences).values({
    userId: user.id,
    tenantId: tenant.id,
    priorities: buildPriorities(d.recommendedIds, d.customPriorities),
    onboardedAt: now,
  });

  // Minimal profile rows so scoring / settings have something to read.
  await db.insert(capabilityProfiles).values({ tenantId: tenant.id, companyName: d.orgName });
  await db.insert(scoringProfiles).values({
    tenantId: tenant.id,
    name: "Default (balanced)",
    isDefault: true,
    weights: DEFAULT_WEIGHTS,
  });

  await createSession({ userId: user.id, tenantId: tenant.id });
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
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return { ok: false, error: "Email or password is incorrect." };
  }

  const [member] = await db
    .select({ tenantId: organizationMembers.tenantId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, user.id))
    .limit(1);

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession({ userId: user.id, tenantId: member?.tenantId ?? user.tenantId });
  revalidatePath("/", "layout");
  redirect("/");
}
