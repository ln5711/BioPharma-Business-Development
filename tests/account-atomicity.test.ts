/**
 * Proves account creation is atomic against the REAL schema, on a throwaway
 * PGlite database (never touches dev/prod data).
 *
 * NOTE: PGlite is Postgres-in-WASM, so transaction + unique-constraint semantics
 * match Neon. This is a logic test — persistence against the real deployed Neon
 * database is verified separately from a preview deployment (see DEPLOYMENT.md).
 */
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = "";
process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), "nw-atomicity-"));

let db: any;
let client: any;
let schema: any;

before(async () => {
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  schema = await import("@/db/schema");
  client = new PGlite(process.env.PGLITE_DATA_DIR);
  db = drizzle(client, { schema });

  const dir = join(process.cwd(), "drizzle");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    const body = readFileSync(join(dir, f), "utf8").replace(/-->\s*statement-breakpoint/g, "");
    for (const stmt of body.split(";").map((s) => s.trim()).filter(Boolean)) {
      await client.exec(stmt);
    }
  }
});

after(async () => {
  await client?.close?.();
});

const count = async (t: any) => {
  const { sql } = await import("drizzle-orm");
  const [row] = await db.select({ n: sql`count(*)` }).from(t);
  return Number(row.n);
};

test("clean signup writes exactly one coherent row set", async () => {
  const { tenants, users, organizationMembers, userPreferences, capabilityProfiles, scoringProfiles } =
    schema;
  const out = await db.transaction(async (tx: any) => {
    const [t] = await tx.insert(tenants).values({ name: "Predicine", slug: "predicine" }).returning();
    const [u] = await tx
      .insert(users)
      .values({ tenantId: t.id, email: "a@predicine.com", name: "A", role: "owner", passwordHash: "s:h" })
      .returning();
    await tx.insert(organizationMembers).values({ tenantId: t.id, userId: u.id, role: "owner" });
    await tx.insert(userPreferences).values({ userId: u.id, tenantId: t.id, priorities: [], onboardedAt: new Date() });
    await tx.insert(capabilityProfiles).values({ tenantId: t.id, companyName: "Predicine" });
    await tx.insert(scoringProfiles).values({ tenantId: t.id, name: "Default", isDefault: true, weights: {} });
    return { userId: u.id };
  });
  assert.ok(out.userId);
  assert.equal(await count(tenants), 1);
  assert.equal(await count(users), 1);
  assert.equal(await count(organizationMembers), 1);
  assert.equal(await count(userPreferences), 1);
});

test("a mid-transaction failure rolls everything back (no orphan workspace)", async () => {
  const { tenants } = schema;
  const before = await count(tenants);
  await assert.rejects(
    db.transaction(async (tx: any) => {
      await tx.insert(tenants).values({ name: "Orphan", slug: "orphan-co" });
      throw new Error("boom");
    }),
  );
  assert.equal(await count(tenants), before, "tenant count unchanged after rollback");
});

test("duplicate email is rejected by the unique constraint (23505), nothing left behind", async () => {
  const { tenants, users } = schema;
  const before = await count(tenants);
  let code = "";
  try {
    await db.transaction(async (tx: any) => {
      const [t] = await tx.insert(tenants).values({ name: "Dup", slug: "dup-co" }).returning();
      await tx
        .insert(users)
        .values({ tenantId: t.id, email: "a@predicine.com", name: "B", role: "owner", passwordHash: "s:h" });
    });
  } catch (e: any) {
    for (let cur = e; cur && !code; cur = cur.cause) code = cur.code ?? "";
  }
  assert.equal(code, "23505");
  assert.equal(await count(tenants), before, "no leftover 'dup-co' tenant");
});
