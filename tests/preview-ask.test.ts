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

test("a bare biomarker is public research: sourced results, never a no-results wall", { ...opts, skip: opts.skip || !HAS_LLM }, async () => {
  const r = await runAsk({ query: "KRAS", ctx, page: {} });
  console.log("  ->", r.status, r.meta.intent, "mode:", r.mode, "cards:", r.cards.length, "| retrieval:", JSON.stringify(r.meta.retrieval));
  console.log("  answer:", r.answer.slice(0, 220).replace(/\n/g, " "));
  assert.equal(r.meta.intent, "public_research");
  assert.equal(r.status, "ok");
  assert.ok(!/no account called|no results|nothing in your workspace/i.test(r.answer), "must not be a no-results wall");
  assert.ok(r.cards.some((c) => c.origin === "public"), "expected public research cards");
  assert.ok(r.suggestions.length > 0, "a broad query should offer narrowing options");
  assert.ok(r.answer.length > 150, "expected a real orientation briefing");
});

test("public research works on a zero-record topic (empty workspace never blocks it)", { ...opts, skip: opts.skip || !HAS_LLM }, async () => {
  const r = await runAsk({ query: "Novartis oncology", ctx, page: {} });
  const external = r.sources.filter((s) => s.kind === "external");
  console.log("  mode:", r.mode, "| synthesis:", r.meta.synthesis, "| researchRequestId:", r.meta.researchRequestId);
  console.log("  citations:", external.length, "| workspaceNote:", r.workspaceNote);
  assert.equal(r.meta.intent, "public_research");
  assert.equal(r.mode, "external+ai");
  assert.equal(r.meta.synthesis, "ok");
  assert.ok(r.meta.researchRequestId, "expected the web_search call's Anthropic request id");
  assert.ok(external.length > 0, "expected web_search citations");
  assert.ok(r.answer.length > 200, "answer should be a real briefing");
  assert.ok(
    !/no account called|add it as a monitored company|ask me to search external/i.test(r.answer),
    "the primary answer must NOT be a workspace no-results message",
  );
  assert.ok(r.workspaceNote && /workspace/i.test(r.workspaceNote), "workspace state is a separate note");
});

test("the caller's seeded records surface alongside public research, clearly separated", { ...opts, skip: opts.skip || !HAS_LLM }, async () => {
  const r = await runAsk({ query: "KRAS G12C trials in pancreatic cancer", ctx, page: {} });
  console.log("  public cards:", r.cards.filter((c) => c.origin === "public").length,
    "| workspace cards:", r.cards.filter((c) => c.origin === "workspace").length);
  assert.equal(r.meta.intent, "public_research");
  assert.ok(r.cards.some((c) => c.origin === "workspace"), "seeded KRAS trials should appear as workspace-origin cards");
  assert.ok(r.workspaceNote && /related saved record/i.test(r.workspaceNote));
});

test("a nonsense keyword never substitutes an unrelated feed", { ...opts, skip: opts.skip || !HAS_LLM }, async () => {
  const r = await runAsk({ query: "zzzqqq unrelated gibberish token", ctx, page: {} });
  assert.equal(r.meta.intent, "public_research");
  assert.ok(!r.cards.some((c) => c.origin === "workspace"), "no workspace cards for a term nothing matches");
});

test("a personal request stays scoped to the signed-in user", opts, async () => {
  const r = await runAsk({ query: "What are my priorities?", ctx, page: {} });
  console.log("  ->", r.status, r.meta.intent, "| answer:", r.answer.slice(0, 160).replace(/\n/g, " "));
  assert.equal(r.meta.intent, "personal");
  assert.ok(r.cards.every((c) => c.origin === "workspace"), "personal answers only cite the user's own records");
  assert.ok(!/clinicaltrials\.gov|web sources/i.test(r.answer), "a personal request must not run public web search");
});

test("Save action persists a public trial into the workspace", { ...opts, skip: opts.skip || !HAS_LLM }, async () => {
  const r = await runAsk({ query: "SHP2 inhibitor trials", ctx, page: {} });
  const saveable = r.cards.find((c) => c.save?.kind === "trial");
  assert.ok(saveable?.save, "expected at least one public trial card with a Save action");
  const nctId = saveable!.save!.payload.nctId;
  const { importTrialByNct } = await import("@/integrations/clinicaltrials/ingest");
  const { getDb } = await import("@/db");
  const db = await getDb();
  const res = await importTrialByNct(db, ctx.tenantId, nctId);
  console.log("  saved", nctId, "->", JSON.stringify(res));
  assert.ok(res.imported, "trial should import from ClinicalTrials.gov");
  // It is now findable in the workspace.
  const again = await runAsk({ query: `trial ${nctId}`, ctx, page: {} });
  assert.ok(
    JSON.stringify(again).includes(nctId),
    "the saved trial should be retrievable after saving",
  );
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
