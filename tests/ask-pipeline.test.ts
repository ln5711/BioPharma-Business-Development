/**
 * Ask newwin pipeline against PGlite fixtures, with NO model configured (the
 * deterministic path). Proves: retrieval is tenant-scoped, an explicit company
 * question is answered from that company's records only, missing results give an
 * explicit explanation (never an unrelated feed), and conversations are private.
 */
import assert from "node:assert/strict";
import { test, before } from "node:test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = "";
process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), "nw-ask-"));
process.env.LLM_PROVIDER = "mock"; // deterministic path — no network
process.env.ANTHROPIC_API_KEY = "";

let client: any;
let db: any;
let schema: any;
let pipeline: typeof import("@/lib/ask/pipeline");
let conversations: typeof import("@/lib/ask/conversations");

const T1 = { tenantId: "", userId: "" };
const T2 = { tenantId: "", userId: "" };

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
  pipeline = await import("@/lib/ask/pipeline");
  conversations = await import("@/lib/ask/conversations");

  const now = new Date();
  const recent = new Date(now.getTime() - 2 * 86_400_000);
  const old = new Date(now.getTime() - 400 * 86_400_000);

  for (const [slug, holder, orgName, headline, when] of [
    ["t1", T1, "AcmeBio", "AcmeBio starts Phase 2 KRAS trial", recent],
    ["t2", T2, "OtherPharma", "OtherPharma reports Q3 financing", recent],
  ] as const) {
    const [t] = await db.insert(schema.tenants).values({ name: orgName, slug }).returning();
    const [u] = await db
      .insert(schema.users)
      .values({ tenantId: t.id, email: `${slug}@x.com`, name: "U", role: "owner", passwordHash: "s:h" })
      .returning();
    await db.insert(schema.organizationMembers).values({ tenantId: t.id, userId: u.id, role: "owner" });
    holder.tenantId = t.id;
    holder.userId = u.id;

    const [org] = await db
      .insert(schema.organizations)
      .values({ tenantId: t.id, canonicalName: orgName, organizationType: "biotech" })
      .returning();
    await db.insert(schema.commercialSignals).values({
      tenantId: t.id,
      signalType: "NEW_TRIAL",
      category: "clinical_trial",
      organizationId: org.id,
      headline,
      factSummary: headline,
      dedupeKey: `${slug}-1`,
      opportunityScore: 72,
      detectedAt: when,
      sourceDate: when,
    });
    // An OLD signal that must NOT appear for "this week".
    await db.insert(schema.commercialSignals).values({
      tenantId: t.id,
      signalType: "NEW_PUBLICATION",
      category: "publication",
      organizationId: org.id,
      headline: `${orgName} legacy result`,
      factSummary: "old",
      dedupeKey: `${slug}-old`,
      opportunityScore: 90,
      detectedAt: old,
      sourceDate: old,
    });
  }
});

test("an explicit company question is answered from THAT company's recent records only", async () => {
  const res = await pipeline.runAsk({
    query: "What changed at AcmeBio this week?",
    ctx: T1,
    page: {},
  });
  assert.equal(res.status, "ok");
  assert.equal(res.meta.intent, "company_developments");
  assert.ok(res.cards.length >= 1);
  assert.ok(res.cards.every((c) => /AcmeBio/i.test(`${c.title} ${c.subtitle ?? ""}`)));
  // The 400-day-old high-score signal is excluded by the "this week" window.
  assert.ok(!res.cards.some((c) => /legacy/i.test(c.title)));
  // Never leaks the other tenant.
  assert.ok(!JSON.stringify(res).includes("OtherPharma"));
});

test("unknown company → explicit no-results, NOT an unrelated feed", async () => {
  const res = await pipeline.runAsk({
    query: "What changed at Nonexistent Corp this week?",
    ctx: T1,
    page: {},
  });
  assert.equal(res.status, "no_results");
  assert.equal(res.cards.length, 0);
  assert.match(res.answer, /no account called|not.*in your workspace|no developments/i);
});

test("nonsense keyword → explicit no-results, no substitution", async () => {
  const res = await pipeline.runAsk({
    query: "zzzqqq unrelated gibberish",
    ctx: T1,
    page: {},
  });
  assert.equal(res.status, "no_results");
  assert.equal(res.cards.length, 0);
  assert.match(res.answer, /nothing in your workspace|did not substitute/i);
});

test("retrieval is tenant-scoped: T2 asking about AcmeBio sees nothing", async () => {
  const res = await pipeline.runAsk({
    query: "What changed at AcmeBio this week?",
    ctx: T2,
    page: {},
  });
  assert.equal(res.status, "no_results");
  assert.ok(!JSON.stringify(res).includes("AcmeBio starts Phase 2"));
});

test("conversations are private to their owner", async () => {
  const res = await pipeline.runAsk({ query: "hello", ctx: T1, page: {} });
  const convId = await conversations.recordTurn({
    tenantId: T1.tenantId,
    userId: T1.userId,
    conversationId: null,
    question: "hello",
    response: res,
  });
  const mine = await conversations.loadConversation(convId, T1.tenantId, T1.userId);
  assert.ok(mine && mine.length === 2);
  const theirs = await conversations.loadConversation(convId, T2.tenantId, T2.userId);
  assert.equal(theirs, null);
});
