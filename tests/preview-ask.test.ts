/**
 * LIVE Ask newwin pipeline checks against the Neon preview branch (real seeded
 * ClinicalTrials.gov data). Skipped in `npm test`. Run:
 *
 *   DOTENV_CONFIG_PATH=.env.preview.local TSX_TSCONFIG_PATH=tests/tsconfig.json \
 *     node --import tsx --test tests/preview-ask.test.ts
 *
 * With ANTHROPIC_API_KEY + LLM_PROVIDER=anthropic in the env it also does a real
 * Claude call and (if asked) a real web_search, printing the request id + usage.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { test, before, after } from "node:test";

process.env.AUTH_SECRET ||= "preview-ask-local-signing-secret-32-chars!";

const DB_URL =
  process.env.STORAGE_DATABASE_URL_UNPOOLED || process.env.STORAGE_DATABASE_URL || "";
const SKIP = !/ep-wandering-frost-arbrtugw/.test(DB_URL);
const opts = { skip: SKIP && "run with DOTENV_CONFIG_PATH=.env.preview.local" };
const HAS_LLM = process.env.LLM_PROVIDER === "anthropic" && !!process.env.ANTHROPIC_API_KEY;

let runAsk: typeof import("@/lib/ask/pipeline").runAsk;
let llmStatus: typeof import("@/lib/llm/status").llmStatus;
let closeDb: () => Promise<void>;
let ctx: { tenantId: string; userId: string };

before(async () => {
  if (SKIP) return;
  const dbmod = await import("@/db");
  const schema = await import("@/db/schema");
  const { like, eq } = await import("drizzle-orm");
  const db = await dbmod.getDb();
  closeDb = dbmod.closeDb;
  runAsk = (await import("@/lib/ask/pipeline")).runAsk;
  llmStatus = (await import("@/lib/llm/status")).llmStatus;

  const [t] = await db
    .select()
    .from(schema.tenants)
    .where(like(schema.tenants.slug, "preview-verify-%"))
    .limit(1);
  const [m] = await db
    .select()
    .from(schema.organizationMembers)
    .where(eq(schema.organizationMembers.tenantId, t.id))
    .limit(1);
  ctx = { tenantId: t.id, userId: m.userId };
  console.log(`\n  workspace ${t.slug}  |  LLM: ${JSON.stringify(llmStatus())}\n`);
});

after(async () => {
  if (!SKIP) await closeDb();
});

test("relevant DB query returns results from seeded ClinicalTrials.gov data", opts, async () => {
  const r = await runAsk({ query: "Find KRAS trials", ctx, page: {} });
  console.log("  ->", r.status, r.meta.intent, "cards:", r.cards.length, "| retrieval:", JSON.stringify(r.meta.retrieval));
  console.log("  answer:", r.answer.slice(0, 200).replace(/\n/g, " "));
  assert.equal(r.status, "ok");
  assert.ok(r.cards.length > 0, "expected trial cards");
  assert.ok(r.answer.length > 0);
});

test("unknown company → explicit no-results, never an unrelated feed", opts, async () => {
  const r = await runAsk({ query: "What changed at Nonexistent Corp this week?", ctx, page: {} });
  console.log("  ->", r.status, "| answer:", r.answer.slice(0, 160).replace(/\n/g, " "));
  assert.equal(r.status, "no_results");
  assert.equal(r.cards.length, 0);
  assert.match(r.answer, /no account called|not.*in your workspace|no developments/i);
});

test("nonsense keyword → explicit no-results", opts, async () => {
  const r = await runAsk({ query: "zzzqqq unrelated gibberish token", ctx, page: {} });
  assert.equal(r.status, "no_results");
  assert.equal(r.cards.length, 0);
});

test("real Claude answer over workspace evidence (records request id + usage)", { ...opts, skip: opts.skip || !HAS_LLM }, async () => {
  const r = await runAsk({ query: "Summarise the KRAS trial landscape in this workspace", ctx, page: {} });
  console.log("  synthesis:", r.meta.synthesis, "| model:", r.meta.model, "| requestId:", r.meta.requestId, "| usage:", JSON.stringify(r.meta.usage));
  assert.equal(r.meta.synthesis, "ok");
  assert.ok(r.meta.model, "expected a model id");
  assert.ok(r.meta.requestId, "expected an Anthropic request id for the final answer");
  assert.ok(r.answer.length > 120, "expected a substantive summary");
  assert.ok(!/no matching records|AI summary unavailable/i.test(r.answer), "must not be the fallback text");
});

test("explicit web-search returns a SUBSTANTIVE dated summary, not a no-results message + links", { ...opts, skip: opts.skip || !HAS_LLM }, async () => {
  const r = await runAsk({
    query: "Search the web for the latest FDA news on Novartis oncology developments",
    ctx,
    page: {},
  });
  const external = r.sources.filter((s) => s.kind === "external");
  console.log("  mode:", r.mode, "| synthesis:", r.meta.synthesis);
  console.log("  researchRequestId:", r.meta.researchRequestId, "| finalRequestId:", r.meta.requestId, "| usage:", JSON.stringify(r.meta.usage));
  console.log("  citations:", external.length, "| workspaceNote:", r.workspaceNote);
  console.log("  answer[0..400]:", r.answer.slice(0, 400).replace(/\n/g, " "));

  assert.equal(r.mode, "external+ai");
  assert.equal(r.meta.synthesis, "ok");
  assert.ok(r.meta.researchRequestId, "expected the web_search call's Anthropic request id");
  assert.ok(external.length > 0, "expected web_search citations");
  // The PRIMARY answer must be a real summary — not the workspace no-results text.
  assert.ok(r.answer.length > 200, "answer should be a real briefing");
  assert.ok(
    !/no account called|is in your workspace|add it as a monitored company|ask me to search external/i.test(r.answer),
    "the primary answer must NOT be the workspace no-results message",
  );
  // Workspace state is a SEPARATE note.
  assert.ok(r.workspaceNote && /workspace/i.test(r.workspaceNote));
  assert.ok(!/no account called/i.test(r.workspaceNote), "workspaceNote is a plain note, not the old message");
});

test("web-search citations are deduplicated (no regional/syndicated repeats)", { ...opts, skip: opts.skip || !HAS_LLM }, async () => {
  const r = await runAsk({
    query: "Search the web for recent Pfizer oncology press releases",
    ctx,
    page: {},
  });
  const urls = r.sources.filter((s) => s.kind === "external").map((s) => s.url);
  assert.equal(new Set(urls).size, urls.length, "no duplicate URLs");
  console.log("  distinct citation hosts:", [...new Set(urls.map((u) => { try { return new URL(u!).hostname; } catch { return u; } }))]);
});
