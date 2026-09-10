/**
 * LIVE checks against the connected database — intended for the Neon preview
 * branch. Run explicitly:
 *
 *   DOTENV_CONFIG_PATH=.env.preview.local \
 *     TSX_TSCONFIG_PATH=tests/tsconfig.json \
 *     node --import tsx --test tests/preview-live.test.ts
 *
 * Writes two `preview-verify-*` tenants (safe on the isolated schema-only
 * branch). Prints a cleanup line. NOT part of `npm test`.
 */
import "dotenv/config"; // honours DOTENV_CONFIG_PATH=.env.preview.local
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { randomUUID } from "node:crypto";

process.env.AUTH_SECRET ||= "preview-live-local-signing-secret-32-chars!!";

const DB_URL = process.env.STORAGE_DATABASE_URL_UNPOOLED || process.env.STORAGE_DATABASE_URL || "";
if (!/ep-wandering-frost-arbrtugw/.test(DB_URL)) {
  throw new Error(
    "Refusing to run: STORAGE_DATABASE_URL is not the Neon preview branch " +
      "(ep-wandering-frost-arbrtugw). Run with DOTENV_CONFIG_PATH=.env.preview.local.",
  );
}

let db: any;
let schema: any;
let auth: typeof import("@/lib/auth");
let eq: typeof import("drizzle-orm").eq;
let and: typeof import("drizzle-orm").and;

const stamp = Date.now();
const A = { email: `preview-verify-a-${stamp}@example.com`, org: `Preview Verify A ${stamp}`, pw: "preview-a-pass-1234" };
const B = { email: `preview-verify-b-${stamp}@example.com`, org: `Preview Verify B ${stamp}`, pw: "preview-b-pass-1234" };
let a: { tenantId: string; userId: string };
let b: { tenantId: string; userId: string };

before(async () => {
  db = await (await import("@/db")).getDb();
  schema = await import("@/db/schema");
  auth = await import("@/lib/auth");
  ({ eq, and } = await import("drizzle-orm"));

  const host = (() => {
    try {
      return new URL(process.env.STORAGE_DATABASE_URL_UNPOOLED || process.env.STORAGE_DATABASE_URL || "").host;
    } catch {
      return "?";
    }
  })();
  console.log(`\n  DB host: ${host}\n`);

  const signup = (u: typeof A, prio: string) =>
    db.transaction(async (tx: any) => {
      const slug = `preview-verify-${u.email.split("@")[0]}`.slice(0, 40);
      const [t] = await tx.insert(schema.tenants).values({ name: u.org, slug }).returning();
      const [user] = await tx
        .insert(schema.users)
        .values({
          tenantId: t.id,
          email: u.email.toLowerCase(),
          name: "Tester",
          role: "owner",
          passwordHash: auth.hashPassword(u.pw),
          lastLoginAt: new Date(),
        })
        .returning();
      await tx.insert(schema.organizationMembers).values({ tenantId: t.id, userId: user.id, role: "owner" });
      await tx.insert(schema.userPreferences).values({
        userId: user.id,
        tenantId: t.id,
        priorities: [{ id: randomUUID(), text: prio, paused: false, order: 0 }],
        onboardedAt: new Date(),
      });
      await tx.insert(schema.capabilityProfiles).values({ tenantId: t.id, companyName: u.org });
      return { tenantId: t.id, userId: user.id };
    });

  a = await signup(A, "Track KRAS G12C resistance");
  b = await signup(B, "MET exon 14 skipping partners");
});

after(() => {
  console.log(`\n  cleanup: delete from tenants where slug like 'preview-verify-%';\n`);
  // The postgres pool keeps the event loop alive; this is a one-off manual
  // verification, so exit deliberately once assertions are done.
  setTimeout(() => process.exit(0), 300).unref();
});

test("signup persists two distinct accounts", async () => {
  assert.notEqual(a.userId, b.userId);
  assert.notEqual(a.tenantId, b.tenantId);
  const users = await db.select().from(schema.users).where(eq(schema.users.email, A.email.toLowerCase()));
  assert.equal(users.length, 1);
});

test("priorities persist per user with no cross-bleed", async () => {
  const [ap] = await db.select().from(schema.userPreferences).where(eq(schema.userPreferences.userId, a.userId));
  const [bp] = await db.select().from(schema.userPreferences).where(eq(schema.userPreferences.userId, b.userId));
  assert.ok(ap.priorities.some((p: any) => /KRAS/.test(p.text)));
  assert.ok(bp.priorities.some((p: any) => /MET exon 14/.test(p.text)));
  assert.ok(!ap.priorities.some((p: any) => /MET exon 14/.test(p.text)));
  assert.ok(!bp.priorities.some((p: any) => /KRAS/.test(p.text)));
});

test("login: wrong password rejected, right password accepted, resolves to own tenant", async () => {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, A.email.toLowerCase()));
  assert.equal(auth.verifyPassword("wrong", u.passwordHash), false);
  assert.equal(auth.verifyPassword(A.pw, u.passwordHash), true);
  const [m] = await db
    .select({ tenantId: schema.organizationMembers.tenantId })
    .from(schema.organizationMembers)
    .where(eq(schema.organizationMembers.userId, u.id));
  assert.equal(m.tenantId, a.tenantId);
});

test("isolation: A's tenant-scoped query never returns B's rows", async () => {
  const rows = await db
    .select()
    .from(schema.userPreferences)
    .where(and(eq(schema.userPreferences.tenantId, a.tenantId), eq(schema.userPreferences.userId, a.userId)));
  assert.ok(!rows.some((r: any) => r.userId === b.userId));

  const bScopedByA = await db
    .select()
    .from(schema.userPreferences)
    .where(eq(schema.userPreferences.tenantId, a.tenantId));
  assert.ok(!bScopedByA.some((r: any) => r.userId === b.userId));
});

test("duplicate email rejected by unique constraint (23505)", async () => {
  let code = "";
  try {
    await db.insert(schema.users).values({
      tenantId: a.tenantId,
      email: A.email.toLowerCase(),
      name: "Dup",
      role: "owner",
      passwordHash: "x:y",
    });
  } catch (e: any) {
    for (let cur = e; cur && !code; cur = cur.cause) code = cur.code ?? "";
  }
  assert.equal(code, "23505");
});
