/**
 * Seeds the RAS/KRAS demo configuration (spec §81 / §82 / §116).
 * Idempotent — safe to re-run. `npm run seed`
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  capabilityProfiles,
  diseases,
  organizationAliases,
  organizations,
  pathways,
  scoringProfiles,
  sourceRegistry,
  targets,
  tenants,
  users,
  watchlistItems,
  watchlists,
} from "@/db/schema";
import { DEFAULT_WEIGHTS } from "@/lib/scoring/model";
import { normalizeName } from "@/lib/oncology/normalize-terms";

const TENANT_SLUG = "demo";

const RAS_TARGETS = [
  { gene: "KRAS", pathwayName: "RAS/MAPK", synonyms: ["KRAS G12C", "KRAS G12D", "KRAS G12V", "KRAS G13D", "KRAS Q61H"] },
  { gene: "NRAS", pathwayName: "RAS/MAPK", synonyms: ["NRAS Q61"] },
  { gene: "HRAS", pathwayName: "RAS/MAPK", synonyms: [] },
  { gene: "SOS1", pathwayName: "RAS/MAPK", synonyms: [] },
  { gene: "PTPN11", pathwayName: "RAS/MAPK", synonyms: ["SHP2"] },
  { gene: "BRAF", pathwayName: "RAS/MAPK", synonyms: ["BRAF V600E"] },
  { gene: "MAP2K1", pathwayName: "RAS/MAPK", synonyms: ["MEK1"] },
];

const DISEASES = [
  { canonicalName: "Non-Small Cell Lung Cancer", synonyms: ["NSCLC", "non small cell lung cancer"], category: "solid" },
  { canonicalName: "Colorectal Cancer", synonyms: ["CRC", "colorectal carcinoma", "metastatic colorectal cancer"], category: "solid" },
  { canonicalName: "Pancreatic Ductal Adenocarcinoma", synonyms: ["PDAC", "pancreatic cancer", "pancreatic adenocarcinoma"], category: "solid" },
  { canonicalName: "Solid Tumor", synonyms: ["advanced solid tumors", "solid tumours"], category: "solid" },
];

// A starter slice of the biopharma universe (spec §83 — a seed workflow, not a
// brittle hard-coded 100). Admins extend this in Settings → Company Universe.
const UNIVERSE: { name: string; type: "pharma" | "biotech"; aliases: string[]; hq?: string; ticker?: string }[] = [
  { name: "Amgen", type: "pharma", aliases: ["Amgen Inc."], hq: "Thousand Oaks, US", ticker: "AMGN" },
  { name: "Mirati Therapeutics", type: "biotech", aliases: ["Mirati"], hq: "San Diego, US" },
  { name: "Revolution Medicines", type: "biotech", aliases: ["RevMed", "Revolution Medicines, Inc."], hq: "Redwood City, US", ticker: "RVMD" },
  { name: "Bristol-Myers Squibb", type: "pharma", aliases: ["BMS", "Bristol Myers Squibb", "Celgene"], hq: "New York, US", ticker: "BMY" },
  { name: "Boehringer Ingelheim", type: "pharma", aliases: ["Boehringer"], hq: "Ingelheim, DE" },
  { name: "Eli Lilly", type: "pharma", aliases: ["Lilly", "Eli Lilly and Company", "Loxo Oncology"], hq: "Indianapolis, US", ticker: "LLY" },
  { name: "Novartis", type: "pharma", aliases: ["Novartis Pharmaceuticals", "Novartis AG"], hq: "Basel, CH", ticker: "NVS" },
  { name: "Roche", type: "pharma", aliases: ["Genentech", "F. Hoffmann-La Roche", "Hoffmann-La Roche"], hq: "Basel, CH" },
  { name: "AstraZeneca", type: "pharma", aliases: ["AZ", "AstraZeneca plc"], hq: "Cambridge, UK", ticker: "AZN" },
  { name: "Merck & Co.", type: "pharma", aliases: ["Merck Sharp & Dohme", "MSD", "Merck"], hq: "Rahway, US", ticker: "MRK" },
  { name: "Pfizer", type: "pharma", aliases: ["Pfizer Inc.", "Array BioPharma"], hq: "New York, US", ticker: "PFE" },
  { name: "Johnson & Johnson", type: "pharma", aliases: ["J&J", "JNJ", "Janssen", "Janssen Biotech"], hq: "New Brunswick, US", ticker: "JNJ" },
  { name: "Genmab", type: "biotech", aliases: [], hq: "Copenhagen, DK" },
  { name: "Jacobio Pharmaceuticals", type: "biotech", aliases: ["Jacobio"], hq: "Beijing, CN" },
  { name: "BridgeBio Pharma", type: "biotech", aliases: ["BridgeBio", "BBOT", "BridgeBio Oncology Therapeutics"], hq: "Palo Alto, US" },
];

async function main() {
  const db = await getDb();

  // ── Tenant + user ──────────────────────────────────────────────────────
  let [tenant] = await db.select().from(tenants).where(eq(tenants.slug, TENANT_SLUG)).limit(1);
  if (!tenant) {
    [tenant] = await db
      .insert(tenants)
      .values({ name: "Predicine (demo)", slug: TENANT_SLUG })
      .returning();
    console.log("• tenant created");
  }

  let [user] = await db.select().from(users).where(eq(users.tenantId, tenant.id)).limit(1);
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: "lucnguy@ucdavis.edu",
        name: "Luciann Nguyen",
        role: "admin",
      })
      .returning();
    console.log("• user created");
  }

  // ── Capability profile (a liquid-biopsy / molecular diagnostics company) ─
  const existingCp = await db
    .select()
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.tenantId, tenant.id))
    .limit(1);
  if (!existingCp.length) {
    await db.insert(capabilityProfiles).values({
      tenantId: tenant.id,
      companyName: "Predicine (demo)",
      website: "https://www.predicine.com",
      description:
        "DEMO DATA — liquid biopsy and tissue genomic profiling for oncology drug development: ctDNA/cfDNA MRD, patient selection, longitudinal resistance monitoring, CDx development, central lab services.",
      testingModalities: ["ctDNA", "cfDNA", "tissue NGS", "WES", "WTS"],
      sampleTypes: ["plasma", "urine", "tumor tissue"],
      technologies: ["NGS", "ctDNA", "methylation"],
      cancerTypes: ["NSCLC", "Colorectal Cancer", "Pancreatic Ductal Adenocarcinoma", "Prostate Cancer", "Solid Tumor"],
      capabilityFlags: {
        ctdna: true,
        cfdna: true,
        liquid_biopsy: true,
        mrd: true,
        ngs: true,
        wes: true,
        wts: true,
        methylation: true,
        patient_selection: true,
        cdx: true,
        resistance_monitoring: true,
        response_monitoring: true,
        central_lab: true,
        translational: true,
        tissue: true,
        plasma: true,
        urine: true,
      },
      mustPursue: ["ctDNA", "MRD", "longitudinal monitoring", "resistance monitoring"],
      desirable: ["companion diagnostic", "patient selection", "central lab"],
      exclusions: ["healthy volunteer", "device-only", "imaging-only"],
      targetIndications: ["NSCLC", "Colorectal Cancer", "Pancreatic Ductal Adenocarcinoma", "Prostate Cancer"],
      targetPathways: ["RAS/MAPK", "DNA damage repair", "HER2"],
      targetAccountTypes: ["pharma", "biotech"],
      trialStagesOfInterest: ["phase_1", "phase_1_2", "phase_2"],
      minimumOpportunityScore: 55,
    });
    console.log("• capability profile created (DEMO)");
  }

  // ── Scoring profile ───────────────────────────────────────────────────
  const existingSp = await db
    .select()
    .from(scoringProfiles)
    .where(eq(scoringProfiles.tenantId, tenant.id))
    .limit(1);
  if (!existingSp.length) {
    await db.insert(scoringProfiles).values({
      tenantId: tenant.id,
      name: "Default (balanced)",
      isDefault: true,
      weights: DEFAULT_WEIGHTS,
    });
    console.log("• scoring profile created");
  }

  // ── Ontology ─────────────────────────────────────────────────────────
  await db
    .insert(pathways)
    .values({
      name: "RAS/MAPK",
      members: ["KRAS", "NRAS", "HRAS", "SOS1", "SHP2", "BRAF", "MEK1", "MEK2", "ERK"],
      relatedTargets: ["KRAS", "NRAS", "HRAS", "SOS1", "PTPN11", "BRAF"],
    })
    .onConflictDoNothing();

  for (const t of RAS_TARGETS) {
    await db
      .insert(targets)
      .values({ gene: t.gene, pathwayName: t.pathwayName, synonyms: t.synonyms })
      .onConflictDoNothing();
  }
  for (const d of DISEASES) {
    await db
      .insert(diseases)
      .values({ canonicalName: d.canonicalName, synonyms: d.synonyms, category: d.category })
      .onConflictDoNothing();
  }
  console.log("• ontology seeded (RAS/MAPK targets + indications)");

  // ── Company universe ─────────────────────────────────────────────────
  for (const c of UNIVERSE) {
    const existing = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.canonicalName, c.name))
      .limit(1);
    let orgId = existing[0]?.id;
    if (!orgId) {
      const [row] = await db
        .insert(organizations)
        .values({
          tenantId: tenant.id,
          canonicalName: c.name,
          organizationType: c.type,
          headquarters: c.hq,
          ticker: c.ticker,
          isPublic: Boolean(c.ticker),
          accountTier: "priority",
          oncologyFocus: true,
        })
        .returning({ id: organizations.id });
      orgId = row.id;
    }
    for (const alias of [c.name, ...c.aliases]) {
      await db
        .insert(organizationAliases)
        .values({
          organizationId: orgId,
          alias,
          normalized: normalizeName(alias),
          kind: alias === c.name ? "name" : "former_name",
        })
        .onConflictDoNothing();
    }
  }
  console.log(`• company universe seeded (${UNIVERSE.length} organizations)`);

  // ── Source registry ──────────────────────────────────────────────────
  const existingSrc = await db
    .select()
    .from(sourceRegistry)
    .where(eq(sourceRegistry.tenantId, tenant.id))
    .limit(1);
  if (!existingSrc.length) {
    await db.insert(sourceRegistry).values({
      tenantId: tenant.id,
      name: "ClinicalTrials.gov API v2",
      sourceType: "clinicaltrials_gov",
      authorityLevel: "primary",
      accessMethod: "api",
      url: "https://clinicaltrials.gov/api/v2",
      updateFrequencyMinutes: 1440,
      reliabilityScore: 98,
    });
    console.log("• source registry: ClinicalTrials.gov");
  }

  // ── RAS/KRAS watchlist ───────────────────────────────────────────────
  let [wl] = await db
    .select()
    .from(watchlists)
    .where(eq(watchlists.tenantId, tenant.id))
    .limit(1);
  if (!wl) {
    [wl] = await db
      .insert(watchlists)
      .values({
        tenantId: tenant.id,
        name: "RAS / KRAS oncology",
        description:
          "Demo vertical (spec §81). KRAS/NRAS/HRAS/SOS1/SHP2 + RAF/MEK across NSCLC, CRC, PDAC and other KRAS-mutated solid tumors.",
        ownerUserId: user.id,
        minOpportunityScore: 55,
        alertMode: "daily_digest",
        ctgovQuery: {
          terms: [
            "KRAS", "KRAS G12C", "KRAS G12D", "KRAS G12V", "pan-KRAS", "pan-RAS",
            "NRAS", "HRAS", "SOS1", "SHP2",
          ],
          conditions: [
            "Non-Small Cell Lung Cancer",
            "Colorectal Cancer",
            "Pancreatic Ductal Adenocarcinoma",
            "Solid Tumor",
          ],
          statuses: ["RECRUITING", "ACTIVE_NOT_RECRUITING", "NOT_YET_RECRUITING"],
        },
      })
      .returning();

    const items = [
      ...["KRAS", "NRAS", "HRAS", "SOS1", "SHP2"].map((l) => ({
        entityKind: "target" as const,
        label: l,
      })),
      { entityKind: "pathway" as const, label: "RAS/MAPK" },
      ...["NSCLC", "CRC", "PDAC"].map((l) => ({
        entityKind: "indication" as const,
        label: l,
      })),
    ];
    await db
      .insert(watchlistItems)
      .values(items.map((i) => ({ watchlistId: wl!.id, ...i })));
    console.log("• RAS/KRAS watchlist created with items");
  }

  console.log("\n✔ seed complete. Next: `npm run ingest:ctgov`");
}

main()
  .then(() => process.exit(0)) // the postgres-js pool keeps the event loop alive otherwise
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
