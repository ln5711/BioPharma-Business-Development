/**
 * End-to-end auth flow against the REAL createAccount / signIn / completeOnboarding
 * server actions and the REAL schema (throwaway PGlite — Postgres-in-WASM, so
 * transaction + constraint semantics match Neon).
 *
 * Covers: two distinct people on the SAME email domain get separate user ids,
 * separate workspaces (NO domain auto-join), private data; existing email is
 * pushed to sign-in; sign-in retrieves the existing account (no new rows);
 * incomplete onboarding is finished without re-registering; each user's identity
 * resolves only to their own tenant.
 */
import assert from "node:assert/strict";
import { test, before } from "node:test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = "";
process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), "nw-authflow-"));
process.env.AUTH_SECRET = "integration-test-secret-32-chars-minimum!!";
process.env.NODE_ENV = "test";

let client: any;
let db: any;
let schema: any;
let actions: typeof import("@/app/welcome/actions");
let tenantLib: typeof import("@/lib/tenant");
let stubNav: typeof import("./_stubs/next-navigation.ts");
let stubHeaders: typeof import("./_stubs/next-headers.ts");

const form = (o: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else fd.append(k, v);
  }
  return fd;
};

/** Run a server action, returning either its AuthResult or the redirect target. */
async function runAction(
  fn: (prev: unknown, fd: FormData) => Promise<unknown>,
  fd: FormData,
): Promise<{ result?: unknown; redirect?: string }> {
  try {
    const result = await fn(null, fd);
    return { result };
  } catch (e: any) {
    if (e instanceof stubNav.RedirectError) return { redirect: e.url };
    throw e;
  }
}

before(async () => {
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  schema = await import("@/db/schema");
  client = new PGlite(process.env.PGLITE_DATA_DIR);
  db = drizzle(client, { schema });

  const dir = join(process.cwd(), "drizzle");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    const body = readFileSync(join(dir, f), "utf8").replace(/-->\s*statement-breakpoint/g, "");
    for (const s of body.split(";").map((x) => x.trim()).filter(Boolean)) await client.exec(s);
  }

  (globalThis as any).__db = Promise.resolve(db);
  actions = await import("@/app/welcome/actions");
  tenantLib = await import("@/lib/tenant");
  stubNav = await import("./_stubs/next-navigation.ts");
  stubHeaders = await import("./_stubs/next-headers.ts");
});

const countAll = async (t: any) => {
  const { sql } = await import("drizzle-orm");
  const [r] = await db.select({ n: sql`count(*)` }).from(t);
  return Number(r.n);
};

test("two people on the same email domain get separate users + workspaces", async () => {
  stubHeaders.__clearCookies();
  const a = await runAction(actions.createAccount as any, form({
    name: "Alice Adams",
    email: "alice@predicine.com",
    password: "alice-password-1",
    orgName: "Predicine",
    orgDomain: "predicine.com",
    recommendedIds: ["trials", "evidence"],
    customPriorities: ["Track KRAS G12C resistance"],
    customDraft: "",
  }));
  assert.equal(a.redirect, "/", "Alice lands on Home");

  stubHeaders.__clearCookies();
  const b = await runAction(actions.createAccount as any, form({
    name: "Bob Brown",
    email: "bob@predicine.com", // SAME domain
    password: "bob-password-1",
    orgName: "Predicine", // SAME org name
    orgDomain: "predicine.com",
    recommendedIds: ["partnerships"],
    customPriorities: ["MET exon 14 skipping partners"],
    customDraft: "",
  }));
  assert.equal(b.redirect, "/", "Bob lands on Home");

  const users = await db.select().from(schema.users);
  const tenants = await db.select().from(schema.tenants);
  const members = await db.select().from(schema.organizationMembers);

  assert.equal(users.length, 2, "two distinct users");
  assert.notEqual(users[0].id, users[1].id, "distinct user ids");
  assert.equal(tenants.length, 2, "two distinct workspaces — NOT joined by domain");
  assert.notEqual(tenants[0].slug, tenants[1].slug, "distinct workspace slugs");
  assert.equal(members.length, 2);
  // Each membership links one user to their own tenant only.
  for (const m of members) {
    const u = users.find((x: any) => x.id === m.userId);
    assert.equal(m.tenantId, u.tenantId, "member's tenant == that user's own tenant");
    assert.equal(m.role, "owner");
  }
});

test("saved priorities are private per user", async () => {
  const prefs = await db.select().from(schema.userPreferences);
  assert.equal(prefs.length, 2);
  const alice = prefs.find((p: any) => p.priorities.some((x: any) => /KRAS/i.test(x.text)));
  const bob = prefs.find((p: any) => p.priorities.some((x: any) => /MET exon 14/i.test(x.text)));
  assert.ok(alice && bob, "each user's custom priority is saved to their own prefs");
  assert.notEqual(alice.userId, bob.userId);
  assert.ok(!alice.priorities.some((x: any) => /MET exon 14/i.test(x.text)), "no cross-bleed");
});

test("an existing email is pushed to sign-in, not a second account", async () => {
  stubHeaders.__clearCookies();
  const before = await countAll(schema.users);
  const dup = await runAction(actions.createAccount as any, form({
    name: "Alice Again",
    email: "ALICE@predicine.com", // same, different case
    password: "another-password",
    orgName: "Predicine 2",
    orgDomain: "",
    recommendedIds: [],
    customPriorities: [],
    customDraft: "",
  }));
  assert.ok((dup.result as any)?.error?.match(/already exists/i));
  assert.equal(await countAll(schema.users), before, "no new user row");
  assert.equal(await countAll(schema.tenants), before, "no new workspace row");
});

test("sign-in retrieves the existing account (no new rows) and resolves to that user's own tenant", async () => {
  const beforeUsers = await countAll(schema.users);
  const beforeTenants = await countAll(schema.tenants);

  stubHeaders.__clearCookies();
  const wrong = await runAction(actions.signIn as any, form({ email: "alice@predicine.com", password: "nope" }));
  assert.ok((wrong.result as any)?.error?.match(/incorrect/i));

  stubHeaders.__clearCookies();
  const ok = await runAction(actions.signIn as any, form({ email: "alice@predicine.com", password: "alice-password-1" }));
  assert.equal(ok.redirect, "/");
  assert.equal(await countAll(schema.users), beforeUsers, "sign-in created no user");
  assert.equal(await countAll(schema.tenants), beforeTenants, "sign-in created no workspace");

  // The session cookie now belongs to Alice; identity resolves to Alice's tenant.
  const ctx = await tenantLib.getOptionalAuth();
  assert.ok(ctx, "authenticated context");
  assert.equal(ctx!.user.email, "alice@predicine.com");
  const [aliceUser] = await db
    .select()
    .from(schema.users)
    .where((await import("drizzle-orm")).eq(schema.users.email, "alice@predicine.com"));
  assert.equal(ctx!.tenant.id, aliceUser.tenantId, "resolved tenant is Alice's own");
});

test("incomplete onboarding is finished without re-registering", async () => {
  // Create a user whose preferences row has no onboardedAt (partial state).
  const { eq } = await import("drizzle-orm");
  const [t] = await db.insert(schema.tenants).values({ name: "Carol Co", slug: "carol-co" }).returning();
  const [u] = await db
    .insert(schema.users)
    .values({ tenantId: t.id, email: "carol@carol.co", name: "Carol", role: "owner", passwordHash: "s:h" })
    .returning();
  await db.insert(schema.organizationMembers).values({ tenantId: t.id, userId: u.id, role: "owner" });
  await db.insert(schema.userPreferences).values({ userId: u.id, tenantId: t.id, priorities: [], onboardedAt: null });

  // Sign Carol in by planting a valid session cookie.
  const auth = await import("@/lib/auth");
  stubHeaders.__clearCookies();
  await auth.createSession({ userId: u.id, tenantId: t.id });

  const beforeUsers = await countAll(schema.users);
  const done = await runAction(actions.completeOnboarding as any, form({
    recommendedIds: ["trials"],
    customPriorities: ["Carol's custom priority"],
    customDraft: "",
  }));
  assert.equal(done.redirect, "/");
  assert.equal(await countAll(schema.users), beforeUsers, "no new user created");

  const [prefs] = await db
    .select()
    .from(schema.userPreferences)
    .where(eq(schema.userPreferences.userId, u.id));
  assert.ok(prefs.onboardedAt, "onboardedAt is now set");
  assert.ok(prefs.priorities.some((p: any) => /Carol's custom/i.test(p.text)));
});
