/**
 * Populates ONE workspace on the connected database with real ClinicalTrials.gov
 * data, so database search / Ask newwin have something to find.
 *
 * - Uses REAL public ClinicalTrials.gov records only. Invents nothing.
 * - Does NOT touch production and does NOT copy any user or private record.
 * - Guarded: refuses to run unless the DB host is the Neon preview branch.
 *
 *   DOTENV_CONFIG_PATH=.env.preview.local npx tsx scripts/seed-preview-data.ts [tenantSlug]
 */
import "dotenv/config";

const DB_URL =
  process.env.STORAGE_DATABASE_URL_UNPOOLED || process.env.STORAGE_DATABASE_URL || "";
if (!/ep-wandering-frost-arbrtugw/.test(DB_URL)) {
  console.error("✖ refusing to run — DB is not the Neon preview branch.");
  process.exit(1);
}

async function main() {
  const { getDb, closeDb } = await import("@/db");
  const { tenants, watchlists } = await import("@/db/schema");
  const { and, eq, like } = await import("drizzle-orm");
  const { ingestWatchlist } = await import("@/integrations/clinicaltrials/ingest");
  const db = await getDb();

  const slugArg = process.argv[2];
  const [tenant] = slugArg
    ? await db.select().from(tenants).where(eq(tenants.slug, slugArg)).limit(1)
    : await db.select().from(tenants).where(like(tenants.slug, "preview-verify-%")).limit(1);

  if (!tenant) {
    console.error("✖ no target tenant. Pass a slug, or create a preview-verify-* account first.");
    process.exit(1);
  }
  console.log(`target workspace: ${tenant.name} (${tenant.slug})`);

  const NAME = "KRAS / RAS oncology (ClinicalTrials.gov)";
  let [wl] = await db
    .select()
    .from(watchlists)
    .where(and(eq(watchlists.tenantId, tenant.id), eq(watchlists.name, NAME)))
    .limit(1);

  if (!wl) {
    [wl] = await db
      .insert(watchlists)
      .values({
        tenantId: tenant.id,
        name: NAME,
        description: "Recruiting/active KRAS-directed oncology trials.",
        minOpportunityScore: 40,
        ctgovQuery: {
          terms: ["KRAS", "KRAS G12C", "KRAS G12D", "pan-RAS"],
          conditions: ["neoplasms", "carcinoma", "non-small cell lung cancer", "colorectal cancer", "pancreatic cancer"],
          statuses: ["RECRUITING", "ACTIVE_NOT_RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION"],
        },
      })
      .returning();
    console.log(`created watchlist ${wl.id}`);
  } else {
    console.log(`reusing watchlist ${wl.id}`);
  }

  console.log("ingesting from ClinicalTrials.gov (real public data)…");
  const stats = await ingestWatchlist(db, {
    tenantId: tenant.id,
    watchlistId: wl.id,
    maxStudies: 120,
  });
  console.log("ingest stats:", JSON.stringify(stats, null, 2));

  await closeDb();
  console.log("\n✔ done — the workspace now has real trials + signals to search.");
}

main().catch(async (e) => {
  console.error("seed-preview-data failed:", (e as Error).message);
  process.exit(1);
});
