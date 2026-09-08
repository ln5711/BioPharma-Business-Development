/**
 * Runs the ClinicalTrials.gov ingestion for every seeded watchlist and prints
 * the run stats. `npm run ingest:ctgov [-- --max=120]`
 */
import "dotenv/config";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tenants, watchlists } from "@/db/schema";
import { ingestWatchlist } from "@/integrations/clinicaltrials/ingest";

async function main() {
  const maxArg = process.argv.find((a) => a.startsWith("--max="));
  const maxStudies = maxArg ? Number(maxArg.split("=")[1]) : 200;

  const db = await getDb();
  const [tenant] = await db.select().from(tenants).orderBy(asc(tenants.createdAt)).limit(1);
  if (!tenant) throw new Error("No tenant — run `npm run seed` first.");

  const lists = await db.select().from(watchlists).where(eq(watchlists.tenantId, tenant.id));
  if (!lists.length) throw new Error("No watchlists — run `npm run seed` first.");

  for (const wl of lists) {
    console.log(`\n▶ Ingesting watchlist "${wl.name}" (max ${maxStudies} studies)…`);
    const started = Date.now();
    const stats = await ingestWatchlist(db, {
      tenantId: tenant.id,
      watchlistId: wl.id,
      maxStudies,
    });
    console.table(stats);
    console.log(`  done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }

  console.log("\n✔ ingestion complete. Open the dashboard: `npm run dev`");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
