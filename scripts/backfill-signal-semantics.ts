/**
 * One-off data-quality backfill.
 *
 * Older ingests emitted `NEW_TRIAL` for trials that were already historical when
 * newwin first imported them, with a `whyNow` that mislabelled the first-posted
 * date as an "update". This reclassifies those rows to
 * `TRIAL_MONITORING_STARTED` and rewrites headline / whyNow / factSummary with
 * the correct date semantics. Nothing else is touched.
 *
 *   DOTENV_CONFIG_PATH=.env.preview.local npx tsx scripts/backfill-signal-semantics.ts          # dry run
 *   DOTENV_CONFIG_PATH=.env.preview.local npx tsx scripts/backfill-signal-semantics.ts --apply
 */
import "dotenv/config";
import { and, inArray, lt, eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "@/db";
import { commercialSignals, trials } from "@/db/schema";
import { NEW_TRIAL_RECENCY_DAYS } from "@/integrations/clinicaltrials/ingest";
import { buildWhyNow } from "@/lib/signals/emit";

const APPLY = process.argv.includes("--apply");
const iso = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "unknown");

async function main() {
  const db = await getDb();

  // NEW_TRIAL signals whose trial was first posted more than the recency window
  // before the signal was detected → should have been "Added to monitoring".
  const rows = await db
    .select({
      id: commercialSignals.id,
      detectedAt: commercialSignals.detectedAt,
      sourceDate: commercialSignals.sourceDate,
      signalType: commercialSignals.signalType,
      factSummary: commercialSignals.factSummary,
      nctId: trials.nctId,
      title: trials.title,
      phase: trials.phase,
      sponsorName: trials.sponsorName,
      firstPostedDate: trials.firstPostedDate,
      lastCtgovUpdate: trials.lastCtgovUpdate,
    })
    .from(commercialSignals)
    .innerJoin(trials, eq(trials.id, commercialSignals.trialId))
    .where(
      and(
        // Re-runnable: also re-normalises rows a prior pass already converted.
        inArray(commercialSignals.signalType, ["NEW_TRIAL", "TRIAL_MONITORING_STARTED"] as never[]),
        lt(
          trials.firstPostedDate,
          sql`${commercialSignals.detectedAt} - make_interval(days => ${NEW_TRIAL_RECENCY_DAYS})`,
        ),
      ),
    );

  console.log(
    `${rows.length} NEW_TRIAL signal(s) are historical imports (first posted > ${NEW_TRIAL_RECENCY_DAYS}d before detection).`,
  );

  for (const r of rows) {
    const sourceDate = r.sourceDate ? new Date(r.sourceDate) : r.firstPostedDate ? new Date(r.firstPostedDate) : null;
    const ageDays = sourceDate
      ? Math.max(0, Math.floor((Date.now() - sourceDate.getTime()) / 86_400_000))
      : 0;
    const whyNow = buildWhyNow("TRIAL_MONITORING_STARTED", sourceDate, ageDays);
    const headline = `Added to monitoring — ${r.title ?? r.nctId}`;
    const factSummary =
      `Now monitoring ${r.nctId} (${String(r.phase).replace(/_/g, " ")}). ` +
      `First posted on ClinicalTrials.gov ${iso(r.firstPostedDate)}; last CT.gov update ${iso(r.lastCtgovUpdate)}; ` +
      `imported into newwin ${iso(r.detectedAt)}. Sponsor: ${r.sponsorName ?? "unknown"}. "${r.title ?? ""}".`;

    console.log(`  ${r.nctId}  ${r.signalType} → TRIAL_MONITORING_STARTED`);
    console.log(`    whyNow: ${whyNow}`);

    if (APPLY) {
      await db
        .update(commercialSignals)
        .set({
          signalType: "TRIAL_MONITORING_STARTED",
          headline,
          whyNow,
          factSummary,
          urgency: "low",
        })
        .where(eq(commercialSignals.id, r.id));
    }
  }

  console.log(APPLY ? "✔ applied" : "dry run — pass --apply to write");
}

main().then(closeDb).catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
