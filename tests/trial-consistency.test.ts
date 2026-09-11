/**
 * CROSS-PAGE + UPSTREAM consistency for trial dates/status/phase/sponsor.
 *
 * Skipped in `npm test`. Run against the Neon preview branch:
 *   DOTENV_CONFIG_PATH=.env.preview.local TSX_TSCONFIG_PATH=tests/tsconfig.json \
 *     node --import tsx --test tests/trial-consistency.test.ts
 *
 * It pulls each NCT id LIVE from ClinicalTrials.gov and asserts newwin's stored
 * record + its search-card projection agree with the upstream payload. Never
 * trusts the DB as the source of truth.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { test, before, after } from "node:test";

process.env.AUTH_SECRET ||= "trial-consistency-local-secret-32-chars!!";

const DB_URL =
  process.env.STORAGE_DATABASE_URL_UNPOOLED || process.env.STORAGE_DATABASE_URL || "";
const SKIP = !/ep-wandering-frost-arbrtugw/.test(DB_URL);
const opts = { skip: SKIP && "run with DOTENV_CONFIG_PATH=.env.preview.local" };

const ANCHORS = [
  "NCT07621718", // RASolute 305 — the regression anchor
];
// A spread of other live trials filled in at runtime from a KRAS search.

let closeDb: () => Promise<void>;
let getDb: () => Promise<any>;
let CtgovClient: typeof import("@/integrations/clinicaltrials/client").CtgovClient;
let normalizeStudy: typeof import("@/integrations/clinicaltrials/normalize").normalizeStudy;
let ingestStudies: typeof import("@/integrations/clinicaltrials/ingest").ingestStudies;
let runSearch: typeof import("@/lib/search/search").runSearch;
let ctx: { tenantId: string; userId: string };

const dstr = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 10) : null);

before(async () => {
  if (SKIP) return;
  const dbmod = await import("@/db");
  const schema = await import("@/db/schema");
  const { like, eq } = await import("drizzle-orm");
  getDb = dbmod.getDb;
  closeDb = dbmod.closeDb;
  CtgovClient = (await import("@/integrations/clinicaltrials/client")).CtgovClient;
  normalizeStudy = (await import("@/integrations/clinicaltrials/normalize")).normalizeStudy;
  ingestStudies = (await import("@/integrations/clinicaltrials/ingest")).ingestStudies;
  runSearch = (await import("@/lib/search/search")).runSearch;

  const db = await getDb();
  const [t] = await db.select().from(schema.tenants).where(like(schema.tenants.slug, "preview-verify-%")).limit(1);
  const [m] = await db
    .select()
    .from(schema.organizationMembers)
    .where(eq(schema.organizationMembers.tenantId, t.id))
    .limit(1);
  ctx = { tenantId: t.id, userId: m.userId };
});

after(async () => {
  if (!SKIP) await closeDb();
});

test("NCT07621718: upstream dates vs newwin stored + search card", opts, async () => {
  const client = new CtgovClient();
  const raw = await client.fetchOne("NCT07621718");
  assert.ok(raw, "live CT.gov record fetched");
  const upstream = normalizeStudy(raw);
  const s = raw.protocolSection!.statusModule!;

  console.log("  UPSTREAM  firstPosted:", s.studyFirstPostDateStruct?.date,
    "| lastUpdatePosted:", s.lastUpdatePostDateStruct?.date,
    "| status:", s.overallStatus);

  // Ingest fresh so the DB reflects the current upstream record.
  const db = await getDb();
  await ingestStudies(db, ctx.tenantId, [raw], { cap: 1 });

  const { trials } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const [row] = await db
    .select()
    .from(trials)
    .where(and(eq(trials.tenantId, ctx.tenantId), eq(trials.nctId, "NCT07621718")))
    .limit(1);
  assert.ok(row, "stored");

  console.log("  NEWWIN    firstPosted:", dstr(row.firstPostedDate),
    "| lastCtgovUpdate:", dstr(row.lastCtgovUpdate),
    "| firstSeenAt:", dstr(row.firstSeenAt),
    "| lastRefreshedAt:", dstr(row.lastRefreshedAt),
    "| status:", row.status, "| phase:", row.phase);

  assert.equal(dstr(row.firstPostedDate), s.studyFirstPostDateStruct?.date, "firstPostedDate matches upstream Study First Posted");
  assert.equal(dstr(row.lastCtgovUpdate), s.lastUpdatePostDateStruct?.date, "lastCtgovUpdate matches upstream Last Update Posted, verbatim");
  // lastRefreshedAt is a fresh 'now' stamp from this run — an independent field,
  // never sourced from the payload (it may coincide with lastCtgovUpdate only by
  // chance when CT.gov happened to update the study today).
  assert.ok(
    Date.now() - new Date(row.lastRefreshedAt).getTime() < 5 * 60_000,
    "lastRefreshedAt was just written by this ingest",
  );
  assert.equal(row.status, upstream.status);
  assert.equal(row.phase, upstream.phase);
  assert.equal(row.sponsorName, upstream.sponsorName);

  // Search-card projection agrees.
  const res = await runSearch("NCT07621718", { tenantId: ctx.tenantId, live: true, persist: false });
  const card = res.trials.find((x) => x.nctId === "NCT07621718");
  assert.ok(card, "search returned the trial");
  assert.equal(card.lastUpdate, dstr(row.lastCtgovUpdate), "card.lastUpdate == stored lastCtgovUpdate");
  assert.equal(card.firstPosted, dstr(row.firstPostedDate), "card.firstPosted == stored firstPostedDate");
  assert.equal(card.status, row.status);
  assert.equal(card.phase, row.phase);
});

test("a spread of live trials: stored dates match the upstream payload exactly", opts, async () => {
  const client = new CtgovClient();
  const found = await runSearch("KRAS trials", { tenantId: ctx.tenantId, live: true, persist: true, trialLimit: 20 });
  const nctIds = [...new Set([...ANCHORS, ...found.trials.map((t) => t.nctId)])].slice(0, 12);
  assert.ok(nctIds.length >= 8, "have a decent spread to check");

  let checked = 0;
  for (const nct of nctIds) {
    const raw = await client.fetchOne(nct);
    if (!raw) continue;
    const s = raw.protocolSection!.statusModule!;
    const n = normalizeStudy(raw);
    const db = await getDb();
    const { trials } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(trials)
      .where(and(eq(trials.tenantId, ctx.tenantId), eq(trials.nctId, nct)))
      .limit(1);
    if (!row) continue;
    checked++;
    console.log(`  ${nct}  posted ${s.studyFirstPostDateStruct?.date}=${dstr(row.firstPostedDate)}  upd ${s.lastUpdatePostDateStruct?.date}=${dstr(row.lastCtgovUpdate)}  ${row.status}/${row.phase}  ${row.sponsorName}`);
    assert.equal(dstr(row.firstPostedDate), s.studyFirstPostDateStruct?.date ?? s.studyFirstSubmitDateStruct?.date, `${nct} first posted`);
    assert.equal(dstr(row.lastCtgovUpdate), s.lastUpdatePostDateStruct?.date, `${nct} last update`);
    assert.equal(row.status, n.status, `${nct} status`);
    assert.equal(row.phase, n.phase, `${nct} phase`);
    assert.equal(row.sponsorName, n.sponsorName, `${nct} sponsor`);
  }
  assert.ok(checked >= 8, `checked ${checked} trials against upstream`);
});
