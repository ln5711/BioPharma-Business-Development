/**
 * Non-destructive backfill for event-date correctness.
 *
 *  1. trials.first_posted_date  ← ClinicalTrials.gov "Study First Posted" date,
 *     read from the trial's own preserved raw snapshot payload. Never invented;
 *     trials whose snapshot lacks the field are left NULL.
 *
 *  2. NEW_TRIAL signals that were stamped with `source_date = last CT.gov update`
 *     for a trial CT.gov actually posted > 45 days earlier are re-pointed at the
 *     real first-posted date, and their FACT summary is reworded from
 *     "New … trial posted" to "… added to your monitored set". Source history in
 *     `signal_sources` is untouched.
 *
 * Dry-run by default. Pass `--apply` to write. Prints every change.
 *
 *   npx tsx scripts/backfill-trial-dates.ts            # preview
 *   STORAGE_DATABASE_URL_UNPOOLED=... npx tsx scripts/backfill-trial-dates.ts --apply
 */
import "dotenv/config";
import { and, eq, isNull, sql } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");
const HISTORICAL_MS = 45 * 86_400_000;

function extractFirstPosted(raw: unknown): Date | null {
  const s = (raw as { protocolSection?: { statusModule?: Record<string, { date?: string }> } })
    ?.protocolSection?.statusModule;
  const d =
    s?.studyFirstPostDateStruct?.date ??
    s?.studyFirstSubmitDateStruct?.date ??
    s?.studyFirstSubmitQcDateStruct?.date;
  if (!d) return null;
  const parsed = new Date(/^\d{4}-\d{2}$/.test(d) ? `${d}-01` : d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function main() {
  const { getDb } = await import("@/db");
  const { trials, trialSnapshots, commercialSignals } = await import("@/db/schema");
  const db = await getDb();

  // ── 1. first_posted_date from snapshots ────────────────────────────────
  const missing = await db
    .select({ id: trials.id, nctId: trials.nctId })
    .from(trials)
    .where(isNull(trials.firstPostedDate));
  console.log(`trials missing first_posted_date: ${missing.length}`);

  let filled = 0;
  for (const t of missing) {
    const [snap] = await db
      .select({ raw: trialSnapshots.rawPayload })
      .from(trialSnapshots)
      .where(eq(trialSnapshots.trialId, t.id))
      .orderBy(sql`${trialSnapshots.capturedAt} asc`)
      .limit(1);
    const firstPosted = extractFirstPosted(snap?.raw);
    if (!firstPosted) continue;
    filled += 1;
    console.log(`  ${t.nctId}  first_posted_date ← ${firstPosted.toISOString().slice(0, 10)}`);
    if (APPLY) {
      await db.update(trials).set({ firstPostedDate: firstPosted }).where(eq(trials.id, t.id));
    }
  }
  console.log(`  ${APPLY ? "updated" : "would update"} ${filled} trials\n`);

  // ── 2. re-point mislabeled NEW_TRIAL signals ──────────────────────────
  const newTrialSignals = await db
    .select({
      id: commercialSignals.id,
      sourceDate: commercialSignals.sourceDate,
      factSummary: commercialSignals.factSummary,
      headline: commercialSignals.headline,
      firstPosted: trials.firstPostedDate,
      nctId: trials.nctId,
    })
    .from(commercialSignals)
    .innerJoin(trials, eq(trials.id, commercialSignals.trialId))
    .where(eq(commercialSignals.signalType, "NEW_TRIAL"));

  let repaired = 0;
  for (const s of newTrialSignals) {
    if (!s.firstPosted) continue;
    const stampedLate =
      !s.sourceDate || s.sourceDate.getTime() - s.firstPosted.getTime() > HISTORICAL_MS;
    const isHistorical = Date.now() - s.firstPosted.getTime() > HISTORICAL_MS;
    if (!stampedLate || !isHistorical) continue;

    repaired += 1;
    const day = s.firstPosted.toISOString().slice(0, 10);
    const newFact = /^New .*trial .*posted/i.test(s.factSummary)
      ? `Trial ${s.nctId} (first posted on ClinicalTrials.gov ${day}) added to your monitored set. ${s.factSummary.replace(/^New /, "Originally a new ")}`
      : s.factSummary;
    console.log(`  signal ${s.id} (${s.nctId})  source_date ${s.sourceDate?.toISOString().slice(0, 10) ?? "null"} → ${day}`);
    if (APPLY) {
      await db
        .update(commercialSignals)
        .set({ sourceDate: s.firstPosted, factSummary: newFact })
        .where(eq(commercialSignals.id, s.id));
    }
  }
  console.log(`  ${APPLY ? "repaired" : "would repair"} ${repaired} NEW_TRIAL signals`);

  console.log(APPLY ? "\n✔ backfill applied (non-destructive)" : "\n(dry run — pass --apply to write)");
  void and;
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
