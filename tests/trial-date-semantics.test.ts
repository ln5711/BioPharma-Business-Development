/**
 * Data-integrity regression tests for trial DATE and SIGNAL semantics.
 *
 * Anchored on the NCT07621718 bug: newwin conflated "first posted", "last
 * ClinicalTrials.gov update", and "imported today", and emitted a NEW_TRIAL
 * signal for a 100-day-old historical import.
 *
 * Offline (PGlite), no network — CtgovStudy payloads are hand-built.
 */
import assert from "node:assert/strict";
import { test, before } from "node:test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = "";
process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), "nw-dates-"));
process.env.LLM_PROVIDER = "mock";
process.env.ANTHROPIC_API_KEY = "";

let db: any;
let schema: any;
let normalizeStudy: typeof import("@/integrations/clinicaltrials/normalize").normalizeStudy;
let ingestStudies: typeof import("@/integrations/clinicaltrials/ingest").ingestStudies;
let getDashboardCounts: typeof import("@/lib/queries").getDashboardCounts;
const T = { tenantId: "" };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/** Minimal but realistic ClinicalTrials.gov v2 study. */
function study(opts: {
  nctId: string;
  firstPosted: string;
  lastUpdate: string;
  status?: string;
  phase?: string;
  sponsor?: string;
  title?: string;
  eligibility?: string;
}) {
  return {
    protocolSection: {
      identificationModule: {
        nctId: opts.nctId,
        briefTitle: opts.title ?? `Study ${opts.nctId}`,
        organization: { fullName: opts.sponsor ?? "Test Sponsor Inc." },
      },
      statusModule: {
        overallStatus: opts.status ?? "RECRUITING",
        studyFirstSubmitDate: opts.firstPosted,
        studyFirstPostDateStruct: { date: opts.firstPosted, type: "ACTUAL" },
        lastUpdateSubmitDate: opts.lastUpdate,
        lastUpdatePostDateStruct: { date: opts.lastUpdate, type: "ACTUAL" },
        startDateStruct: { date: opts.firstPosted, type: "ACTUAL" },
      },
      sponsorCollaboratorsModule: { leadSponsor: { name: opts.sponsor ?? "Test Sponsor Inc.", class: "INDUSTRY" } },
      designModule: { phases: [opts.phase ?? "PHASE3"], enrollmentInfo: { count: 100, type: "ESTIMATED" } },
      conditionsModule: { conditions: ["Pancreatic Adenocarcinoma"] },
      armsInterventionsModule: { interventions: [{ type: "DRUG", name: "TestDrug-100" }] },
      eligibilityModule: { eligibilityCriteria: opts.eligibility ?? "Adults with measurable disease." },
      descriptionModule: { briefSummary: "A study." },
    },
  } as any;
}

before(async () => {
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  schema = await import("@/db/schema");
  const client = new PGlite(process.env.PGLITE_DATA_DIR);
  db = drizzle(client, { schema });
  const dir = join(process.cwd(), "drizzle");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    const body = readFileSync(join(dir, f), "utf8").replace(/-->\s*statement-breakpoint/g, "");
    for (const s of body.split(";").map((x) => x.trim()).filter(Boolean)) await client.exec(s);
  }
  (globalThis as any).__db = Promise.resolve(db);

  normalizeStudy = (await import("@/integrations/clinicaltrials/normalize")).normalizeStudy;
  ingestStudies = (await import("@/integrations/clinicaltrials/ingest")).ingestStudies;
  getDashboardCounts = (await import("@/lib/queries")).getDashboardCounts;

  const [t] = await db.insert(schema.tenants).values({ name: "DateCo", slug: "dateco" }).returning();
  T.tenantId = t.id;
  await db.insert(schema.capabilityProfiles).values({ tenantId: t.id, companyName: "DateCo" });
});

// ── 1. normalizeStudy maps the right upstream fields ──────────────────────

test("normalizeStudy: lastCtgovUpdate ← lastUpdatePostDateStruct.date, firstPostedDate ← studyFirstPostDateStruct.date", () => {
  const n = normalizeStudy(study({ nctId: "NCT00000001", firstPosted: "2026-06-02", lastUpdate: "2026-08-21" }));
  assert.equal(iso(n.firstPostedDate!), "2026-06-02");
  assert.equal(iso(n.lastCtgovUpdate!), "2026-08-21");
  assert.notEqual(iso(n.firstPostedDate!), iso(n.lastCtgovUpdate!));
});

test("normalizeStudy: submit date is only a FALLBACK for first posted", () => {
  const s = study({ nctId: "NCT00000002", firstPosted: "2026-01-01", lastUpdate: "2026-02-02" });
  delete s.protocolSection.statusModule.studyFirstPostDateStruct;
  s.protocolSection.statusModule.studyFirstSubmitDateStruct = { date: "2025-12-20" };
  const n = normalizeStudy(s);
  assert.equal(iso(n.firstPostedDate!), "2025-12-20");
});

// ── 2. historical import ≠ new trial ─────────────────────────────────────

test("a trial first posted 120 days ago → TRIAL_MONITORING_STARTED, not NEW_TRIAL", async () => {
  await ingestStudies(db, T.tenantId, [
    study({ nctId: "NCT07621718", firstPosted: iso(daysAgo(120)), lastUpdate: iso(new Date()), title: "RASolute 305" }),
  ]);
  const trial = (await db.select().from(schema.trials)).find((r: any) => r.nctId === "NCT07621718");
  assert.ok(trial, "trial row exists");
  // stored dates are each correct and distinct
  assert.equal(iso(trial.firstPostedDate), iso(daysAgo(120)));
  assert.equal(iso(trial.lastCtgovUpdate), iso(new Date()));
  assert.equal(iso(trial.firstSeenAt), iso(new Date()), "imported today");

  const sig = (await db.select().from(schema.commercialSignals)).find((s: any) => s.factSummary.includes("NCT07621718"));
  assert.ok(sig, "a signal was emitted");
  assert.equal(sig.signalType, "TRIAL_MONITORING_STARTED");
  assert.notEqual(sig.signalType, "NEW_TRIAL");
  // sourceDate is the real first-posted date, never the import date
  assert.equal(iso(sig.sourceDate), iso(daysAgo(120)));
  // whyNow talks about "first posted", never "updated"
  assert.match(sig.whyNow, /first posted/i);
  assert.doesNotMatch(sig.whyNow, /updated|last update posted/i);
  assert.doesNotMatch(sig.headline, /^New trial/i);
});

test("a trial first posted 5 days ago → NEW_TRIAL with a real first-posted recency", async () => {
  await ingestStudies(db, T.tenantId, [
    study({ nctId: "NCT09999001", firstPosted: iso(daysAgo(5)), lastUpdate: iso(daysAgo(1)) }),
  ]);
  const sig = (await db.select().from(schema.commercialSignals)).find((s: any) => s.factSummary.includes("NCT09999001"));
  assert.equal(sig.signalType, "NEW_TRIAL");
  assert.match(sig.whyNow, /first posted on clinicaltrials\.gov/i);
  assert.match(sig.whyNow, /5 days ago/);
});

// ── 3. baseline import is not a change; unchanged refresh is a no-op ──────

test("baseline import records a snapshot but NOT a trial change", async () => {
  await ingestStudies(db, T.tenantId, [
    study({ nctId: "NCT09999002", firstPosted: iso(daysAgo(3)), lastUpdate: iso(daysAgo(3)) }),
  ]);
  const trial = (await db.select().from(schema.trials)).find((r: any) => r.nctId === "NCT09999002");
  const snaps = (await db.select().from(schema.trialSnapshots)).filter((s: any) => s.trialId === trial.id);
  const changes = (await db.select().from(schema.trialChanges)).filter((c: any) => c.trialId === trial.id);
  assert.equal(snaps.length, 1, "one baseline snapshot");
  assert.equal(changes.length, 0, "no change rows for a baseline import");
});

test("an unchanged refresh adds no snapshot / signal and advances lastRefreshedAt only", async () => {
  const s = study({ nctId: "NCT09999003", firstPosted: iso(daysAgo(3)), lastUpdate: iso(daysAgo(3)) });
  await ingestStudies(db, T.tenantId, [s]);
  const before = (await db.select().from(schema.trials)).find((r: any) => r.nctId === "NCT09999003");
  const sigBefore = (await db.select().from(schema.commercialSignals)).length;
  const snapBefore = (await db.select().from(schema.trialSnapshots)).length;

  await new Promise((r) => setTimeout(r, 10));
  await ingestStudies(db, T.tenantId, [s]); // identical payload

  const after = (await db.select().from(schema.trials)).find((r: any) => r.nctId === "NCT09999003");
  assert.equal((await db.select().from(schema.commercialSignals)).length, sigBefore, "no new signal");
  assert.equal((await db.select().from(schema.trialSnapshots)).length, snapBefore, "no new snapshot");
  assert.equal(iso(after.lastCtgovUpdate), iso(before.lastCtgovUpdate), "CT.gov update date unchanged");
  assert.ok(new Date(after.lastRefreshedAt).getTime() >= new Date(before.lastRefreshedAt).getTime(), "lastRefreshedAt advanced");
});

// ── 4. invariant: refresh date is not the CT.gov update date ─────────────

test("lastRefreshedAt is independent of lastCtgovUpdate", async () => {
  await ingestStudies(db, T.tenantId, [
    study({ nctId: "NCT09999004", firstPosted: "2026-01-10", lastUpdate: "2026-03-15" }),
  ]);
  const trial = (await db.select().from(schema.trials)).find((r: any) => r.nctId === "NCT09999004");
  assert.equal(iso(trial.lastCtgovUpdate), "2026-03-15", "from the payload, verbatim");
  assert.notEqual(iso(trial.lastRefreshedAt), "2026-03-15", "refresh stamp is 'now', not the payload date");
});

// ── 5. landscape-only signals stay out of the feeds ─────────────────────

test("TRIAL_MONITORING_STARTED does not count toward 'signals this week'", async () => {
  // Only historical imports so far in this tenant besides the two NEW_TRIALs.
  const counts = await getDashboardCounts(T.tenantId, 7 * 86_400_000);
  const monitoring = (await db.select().from(schema.commercialSignals)).filter(
    (s: any) => s.signalType === "TRIAL_MONITORING_STARTED",
  ).length;
  assert.ok(monitoring >= 1, "we did create at least one monitoring-started signal");
  const newTrials = (await db.select().from(schema.commercialSignals)).filter(
    (s: any) => s.signalType === "NEW_TRIAL" && new Date(s.detectedAt).getTime() >= Date.now() - 7 * 86_400_000,
  ).length;
  assert.equal(counts.meaningfulSignals, newTrials, "count excludes the monitoring-started rows");
});
