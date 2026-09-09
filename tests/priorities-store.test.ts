/**
 * Exercises the priorities store (add / edit / pause / reorder / remove, dedupe,
 * max count) against the real schema on a throwaway PGlite database.
 */
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = "";
process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), "nw-prefs-"));

let client: any;
let store: any;
let userId = "";
let tenantId = "";

before(async () => {
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const schema = await import("@/db/schema");
  client = new PGlite(process.env.PGLITE_DATA_DIR);
  const db = drizzle(client, { schema });

  const dir = join(process.cwd(), "drizzle");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    const body = readFileSync(join(dir, f), "utf8").replace(/-->\s*statement-breakpoint/g, "");
    for (const s of body.split(";").map((x) => x.trim()).filter(Boolean)) await client.exec(s);
  }

  const [t] = await db.insert(schema.tenants).values({ name: "T", slug: "t" }).returning();
  const [u] = await db
    .insert(schema.users)
    .values({ tenantId: t.id, email: "u@t.com", name: "U", role: "owner", passwordHash: "s:h" })
    .returning();
  tenantId = t.id;
  userId = u.id;

  // getDb() inside the store must reach THIS PGlite dir.
  const dbMod = await import("@/db");
  (globalThis as any).__db = Promise.resolve(db);
  void dbMod;

  store = await import("@/lib/priorities-store");
});

after(async () => {
  await client?.close?.();
});

test("add custom + recommended, reject dupes and unknown ids", async () => {
  let r = await store.addPriority(userId, tenantId, { text: "Track KRAS G12C resistance" });
  assert.equal(r.ok, true);
  assert.equal(r.priorities.length, 1);

  r = await store.addPriority(userId, tenantId, { text: "  track kras g12c resistance " });
  assert.equal(r.ok, false, "case/space-insensitive duplicate rejected");

  r = await store.addPriority(userId, tenantId, { recommendedId: "trials" });
  assert.equal(r.ok, true);
  r = await store.addPriority(userId, tenantId, { recommendedId: "trials" });
  assert.equal(r.ok, false, "same recommended id rejected twice");

  r = await store.addPriority(userId, tenantId, { recommendedId: "not-a-real-id" });
  assert.equal(r.ok, false, "unknown recommended id rejected");
});

test("edit only custom priorities; reorder; pause; remove", async () => {
  const list = await store.getPriorities(userId);
  const custom = list.find((p: any) => !p.recommendedId);
  const rec = list.find((p: any) => p.recommendedId);

  let r = await store.editPriority(userId, tenantId, custom.id, "Track KRAS resistance mechanisms");
  assert.equal(r.ok, true);
  assert.equal(r.priorities.find((p: any) => p.id === custom.id).text, "Track KRAS resistance mechanisms");

  r = await store.editPriority(userId, tenantId, rec.id, "nope");
  assert.equal(r.ok, false, "recommended priorities cannot be renamed");

  r = await store.setPriorityPaused(userId, tenantId, custom.id, true);
  assert.equal(r.priorities.find((p: any) => p.id === custom.id).paused, true);

  const before = (await store.getPriorities(userId)).map((p: any) => p.id);
  r = await store.movePriority(userId, tenantId, before[1], "up");
  const afterIds = r.priorities.map((p: any) => p.id);
  assert.deepEqual(afterIds, [before[1], before[0]]);

  r = await store.removePriority(userId, tenantId, custom.id);
  assert.equal(r.ok, true);
  assert.equal((await store.getPriorities(userId)).some((p: any) => p.id === custom.id), false);
});

test("enforces the max count", async () => {
  // already 1 (the recommended "trials"); add up to the cap
  let added = 1;
  for (let i = 0; i < store.MAX_PRIORITIES + 5; i++) {
    const r = await store.addPriority(userId, tenantId, { text: `priority number ${i}` });
    if (r.ok) added++;
    else {
      assert.match(r.error, /up to 20/i);
      break;
    }
  }
  assert.equal(added, store.MAX_PRIORITIES);
});
