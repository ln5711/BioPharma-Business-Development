/**
 * Ask newwin pipeline against PGlite fixtures with NO model configured (the
 * deterministic path — LLM_PROVIDER=mock, no ANTHROPIC_API_KEY).
 *
 * newwin is a RESEARCH ASSISTANT FIRST. These tests prove the offline invariants:
 *   • an outside-world query is classified public_research and produces a usable
 *     outcome even when the workspace is empty — never a bare "no account" wall;
 *   • when AI is not configured the answer says so honestly and never fabricates
 *     a briefing or substitutes an unrelated feed;
 *   • workspace retrieval that runs alongside public research stays tenant-scoped
 *     — one tenant can never see another tenant's saved records;
 *   • "my …" requests are PERSONAL and scoped to the signed-in user;
 *   • conversations are private to their owner.
 *
 * The live ClinicalTrials.gov call is exercised by tests/preview-ask.test.ts
 * against the preview branch; here we keep queries that do not trigger it so the
 * suite runs offline and deterministically.
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
process.env.SEARCH_DISABLE_LIVE = "1"; // keep the structured-search branch offline

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

  const recent = new Date(Date.now() - 2 * 86_400_000);

  for (const [slug, holder, orgName, headline, priorities] of [
    ["t1", T1, "AcmeBio", "AcmeBio starts Phase 2 KRAS trial", ["Grow KRAS franchise", "Watch BridgeBio"]],
    ["t2", T2, "OtherPharma", "OtherPharma reports Q3 financing", ["Close Series B"]],
  ] as const) {
    const [t] = await db.insert(schema.tenants).values({ name: orgName, slug }).returning();
    const [u] = await db
      .insert(schema.users)
      .values({ tenantId: t.id, email: `${slug}@x.com`, name: "U", role: "owner", passwordHash: "s:h" })
      .returning();
    await db.insert(schema.organizationMembers).values({ tenantId: t.id, userId: u.id, role: "owner" });
    holder.tenantId = t.id;
    holder.userId = u.id;

    await db.insert(schema.userPreferences).values({
      userId: u.id,
      tenantId: t.id,
      priorities: priorities.map((text, i) => ({
        id: `p${i}`,
        text,
        order: i,
        paused: false,
        recommendedId: null,
      })),
    });

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
      detectedAt: recent,
      sourceDate: recent,
    });
  }
});

test("an entity/role query routes to structured SEARCH, never the Home feed", async () => {
  const res = await pipeline.runAsk({
    query: "Genmab bioinformatics leaders",
    ctx: T1,
    page: {},
  });
  assert.equal(res.meta.intent, "search");
  // offline (no model) → a deterministic result, never a fabricated briefing
  assert.equal(res.mode, "database");
  assert.doesNotMatch(res.answer, /no account called/i);
  assert.notEqual(res.status, "error");
});

test("freshness words do not hijack a search into the Home feed", async () => {
  for (const q of ["KRAS trials today", "trials updated this week", "phase 3 KRAS trials"]) {
    const res = await pipeline.runAsk({ query: q, ctx: T1, page: {} });
    assert.equal(res.meta.intent, "search", q);
  }
});

test("structured search stays tenant-scoped", async () => {
  const res = await pipeline.runAsk({
    query: "AcmeBio news this week",
    ctx: T2,
    page: {},
  });
  assert.equal(res.meta.intent, "search");
  assert.ok(
    !JSON.stringify(res).includes("AcmeBio starts Phase 2"),
    "T2 must not see T1's saved signal",
  );
});

test("the caller's own signals surface in structured search", async () => {
  const res = await pipeline.runAsk({
    query: "AcmeBio news this week",
    ctx: T1,
    page: {},
  });
  assert.equal(res.meta.intent, "search");
  assert.ok(
    res.cards.some((c) => c.origin === "workspace" && /AcmeBio starts Phase 2/i.test(c.title)),
    "T1's own signal should appear as a workspace-origin card",
  );
});

test("'my priorities' is PERSONAL and scoped to the signed-in user", async () => {
  const res = await pipeline.runAsk({ query: "What are my priorities?", ctx: T1, page: {} });
  assert.equal(res.meta.intent, "personal");
  assert.equal(res.status, "ok");
  assert.match(res.answer, /Grow KRAS franchise/);
  assert.ok(!JSON.stringify(res).includes("Close Series B"), "must not leak T2's priorities");
  assert.ok(res.cards.every((c) => c.origin === "workspace"));
});

test("'overdue follow-ups' is PERSONAL / overdue_tasks and honest when there are none", async () => {
  const res = await pipeline.runAsk({ query: "Which follow-ups are overdue?", ctx: T1, page: {} });
  assert.equal(res.meta.intent, "personal");
  assert.equal(res.status, "no_results");
  assert.match(res.answer, /no overdue/i);
  assert.equal(res.cards.length, 0);
});

test("a nonsense query returns an honest empty result, no substituted feed", async () => {
  const res = await pipeline.runAsk({ query: "zzzqqq gibberish leaders", ctx: T1, page: {} });
  assert.equal(res.status, "no_results");
  assert.ok(!res.cards.some((c) => c.origin === "workspace"));
  assert.ok(!JSON.stringify(res).includes("AcmeBio starts Phase 2"));
});

test("conversations are private to their owner", async () => {
  const res = await pipeline.runAsk({ query: "Genmab leaders", ctx: T1, page: {} });
  const convId = await conversations.recordTurn({
    tenantId: T1.tenantId,
    userId: T1.userId,
    conversationId: null,
    question: "Genmab leaders",
    response: res,
  });
  const mine = await conversations.loadConversation(convId, T1.tenantId, T1.userId);
  assert.ok(mine && mine.length === 2);
  const theirs = await conversations.loadConversation(convId, T2.tenantId, T2.userId);
  assert.equal(theirs, null);
});
