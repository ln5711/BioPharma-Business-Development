import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import { getDb, closeDb } from "@/db";
import { commercialSignals, trialSnapshots, trials } from "@/db/schema";

const NCT = process.argv[2] ?? "NCT07621718";

async function main() {
  const db = await getDb();
  const [t] = await db.select().from(trials).where(eq(trials.nctId, NCT)).limit(1);
  if (!t) {
    console.log(`${NCT} not present in this DB`);
    return;
  }
  const d = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
  console.log(`=== trials row (${NCT}) ===`);
  for (const k of [
    "phase", "status", "sponsorName", "enrollment",
    "startDate", "primaryCompletionDate", "completionDate",
    "lastCtgovUpdate", "firstPostedDate", "firstSeenAt", "lastRefreshedAt",
  ] as const) {
    console.log(`  ${k.padEnd(22)} ${d((t as Record<string, unknown>)[k])}`);
  }
  const snaps = await db
    .select()
    .from(trialSnapshots)
    .where(eq(trialSnapshots.trialId, t.id))
    .orderBy(desc(trialSnapshots.capturedAt));
  console.log(`\n=== snapshots: ${snaps.length} ===`);
  for (const s of snaps) {
    console.log(
      `  captured ${d(s.capturedAt)}  ctgovLastUpdate ${d(s.ctgovLastUpdate)}  hash ${String(s.recordVersionHash).slice(0, 12)}`,
    );
  }
  const sigs = await db
    .select()
    .from(commercialSignals)
    .where(eq(commercialSignals.trialId, t.id))
    .orderBy(desc(commercialSignals.detectedAt));
  console.log(`\n=== signals: ${sigs.length} ===`);
  for (const s of sigs) {
    console.log(`  [${s.signalType} / ${s.category}]  detectedAt ${d(s.detectedAt)}  sourceDate ${d(s.sourceDate)}`);
    console.log(`    headline:  ${s.headline}`);
    console.log(`    fact:      ${s.factSummary}`);
    console.log(`    whyNow:    ${s.whyNow ?? "—"}`);
  }
}

main().then(closeDb).catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
