/**
 * Outreach draft context + generation (template path, no model). Proves context
 * is tenant-scoped and the generated draft is grounded in the provided records.
 */
import assert from "node:assert/strict";
import { test, before } from "node:test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = "";
process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), "nw-draft-"));
process.env.LLM_PROVIDER = "mock";
process.env.ANTHROPIC_API_KEY = "";

let db: any;
let client: any;
let schema: any;
let draft: typeof import("@/lib/outreach/draft");
const T1 = { tenantId: "" };
const T2 = { tenantId: "" };
let personId = "";
let nctId = "NCT00000001";

before(async () => {
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  schema = await import("@/db/schema");
  client = new PGlite(process.env.PGLITE_DATA_DIR);
  db = drizzle(client, { schema });
  const dir = join(process.cwd(), "drizzle");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    const body = readFileSync(join(dir, f), "utf8").replace(/-->\s*statement-breakpoint/g, "");
    for (const s of body.split(";").map((x) => x.trim()).filter(Boolean)) await client.exec(s);
  }
  (globalThis as any).__db = Promise.resolve(db);
  draft = await import("@/lib/outreach/draft");

  for (const [slug, holder] of [["d1", T1], ["d2", T2]] as const) {
    const [t] = await db.insert(schema.tenants).values({ name: slug, slug }).returning();
    holder.tenantId = t.id;
  }
  const [org] = await db
    .insert(schema.organizations)
    .values({ tenantId: T1.tenantId, canonicalName: "BridgeBio", organizationType: "biotech" })
    .returning();
  const [p] = await db
    .insert(schema.people)
    .values({ tenantId: T1.tenantId, organizationId: org.id, name: "Dr. Jane Roe", title: "VP Clinical Dev", publicEmail: "jane@bridgebio.test" })
    .returning();
  personId = p.id;
  await db.insert(schema.trials).values({
    tenantId: T1.tenantId,
    nctId,
    title: "Phase 2 KRAS G12C study in NSCLC",
    phase: "phase_2",
    status: "recruiting",
    sponsorName: "BridgeBio",
    recordVersionHash: "h1",
    commercialSummary: "molecular eligibility; ctDNA endpoints",
  });
  await db.insert(schema.capabilityProfiles).values({
    tenantId: T1.tenantId,
    companyName: "OurDx",
    description: "ctDNA MRD assays",
    productsServices: ["ctDNA MRD panel"],
    testingModalities: ["liquid biopsy"],
  });
});

test("draft context is tenant-scoped (T2 cannot pull T1's person/trial)", async () => {
  const wrong = await draft.loadDraftContext(T2.tenantId, { personId, nctId });
  assert.equal(wrong.person, null);
  assert.equal(wrong.trial, null);

  const right = await draft.loadDraftContext(T1.tenantId, { personId, nctId });
  assert.equal(right.person?.name, "Dr. Jane Roe");
  assert.equal(right.trial?.nctId, nctId);
  assert.equal(right.organization?.name, "BridgeBio");
  assert.equal(right.capability?.companyName, "OurDx");
  assert.ok(right.evidenceRefs.some((e) => e.kind === "trial" && e.url === `/trials/${nctId}`));
});

test("generated template draft references the real context (no model)", async () => {
  const ctx = await draft.loadDraftContext(T1.tenantId, { personId, nctId });
  const g = await draft.generateDraft(ctx);
  assert.match(g.body, /Jane Roe/);
  assert.match(g.body, /NCT00000001/);
  assert.match(g.body, /OurDx/);
  assert.match(g.body, /no language model configured/i); // honestly labelled
  assert.equal(g.meta.model, null);
});
