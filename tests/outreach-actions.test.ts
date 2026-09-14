/**
 * Integration tests for the Outreach save/log/dedup fixes (PGlite).
 *
 * Covers: signal → save → refresh → contact remains; dedup on stable
 * identifiers (never on name alone); logOutreach writes the right
 * personId/organizationId/type, touches only that person's relationship,
 * never advances lastContactedAt for a note, respects Do Not Contact, is
 * resubmission-safe; follow-up tasks link to the correct contact and don't
 * duplicate; cross-tenant isolation.
 */
import assert from "node:assert/strict";
import { test, before } from "node:test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = "";
process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), "nw-outreach-"));
process.env.LLM_PROVIDER = "mock";
process.env.ANTHROPIC_API_KEY = "";

let db: any;
let schema: any;
let saveDiscoveredContact: typeof import("@/lib/contacts/save").saveDiscoveredContact;
let logOutreachActivity: typeof import("@/lib/contacts/outreach-log").logOutreachActivity;
let startDiscoveryJob: typeof import("@/lib/contacts/discover").startDiscoveryJob;
let runDiscoveryJob: typeof import("@/lib/contacts/discover").runDiscoveryJob;

const T1 = { tenantId: "", userId: "", orgId: "" };
const T2 = { tenantId: "", userId: "", orgId: "" };

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
  saveDiscoveredContact = (await import("@/lib/contacts/save")).saveDiscoveredContact;
  logOutreachActivity = (await import("@/lib/contacts/outreach-log")).logOutreachActivity;
  ({ startDiscoveryJob, runDiscoveryJob } = await import("@/lib/contacts/discover"));

  for (const [slug, holder] of [["t1", T1], ["t2", T2]] as const) {
    const [t] = await db.insert(schema.tenants).values({ name: slug, slug }).returning();
    const [u] = await db.insert(schema.users).values({ tenantId: t.id, email: `${slug}@x.com`, name: "U", role: "owner", passwordHash: "s:h" }).returning();
    await db.insert(schema.organizationMembers).values({ tenantId: t.id, userId: u.id, role: "owner" });
    const [org] = await db.insert(schema.organizations).values({ tenantId: t.id, canonicalName: "Acme Diagnostics", organizationType: "biotech", canonicalDomain: "acme.com" }).returning();
    holder.tenantId = t.id;
    holder.userId = u.id;
    holder.orgId = org.id;
  }
});

// findExistingPerson() legitimately dedups on (organizationId, email) as a
// stable identifier — so distinct tests that share T1.orgId MUST get distinct
// default emails/profile URLs, or they'll correctly (and confusingly) merge
// into one person across tests. Only the dedup test itself should reuse one
// on purpose.
let candidateSeq = 0;

async function makeJobAndCandidate(tenantId: string, orgId: string, overrides: Partial<any> = {}) {
  candidateSeq += 1;
  const [job] = await db.insert(schema.discoveryJobs).values({ tenantId, userId: T1.userId, queryText: "test", organizationId: orgId, status: "complete" }).returning();
  const [dc] = await db
    .insert(schema.discoveredContacts)
    .values({
      jobId: job.id,
      tenantId,
      name: "Jane Doe",
      title: "Director, Biomarker Development",
      organizationId: orgId,
      function: "biomarker_development",
      seniority: "director",
      professionalProfileUrl: `https://www.example.com/team/jane-doe-${candidateSeq}`,
      whyThisPerson: "Leads biomarker strategy for the program.",
      contactLabel: "direct_program_evidence",
      relevanceScore: 88,
      relevanceBreakdown: { functionFit: 35, programEvidence: 25, useCaseFit: 14, decisionScope: 9, evidenceQuality: 5 },
      sourceEvidence: [{ kind: "company_page", url: "https://example.com/team", excerpt: "Jane Doe leads biomarker strategy." }],
      emailAddress: `jane.doe.${candidateSeq}@acme.com`,
      emailProvenance: "publicly_sourced",
      ...overrides,
    })
    .returning();
  return { job, dc };
}

test("save → refresh → contact remains (idempotent add)", async () => {
  const { dc } = await makeJobAndCandidate(T1.tenantId, T1.orgId);
  const first = await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dc.id });
  assert.equal(first.created, true);

  const again = await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dc.id });
  assert.equal(again.personId, first.personId, "re-adding the same discovered row returns the same saved person");
  assert.equal(again.created, false);

  const { eq } = await import("drizzle-orm");
  const [person] = await db.select().from(schema.people).where(eq(schema.people.id, first.personId));
  assert.ok(person, "the person survives");
  assert.equal(person.email, dc.emailAddress);
});

test("dedup: the SAME profile URL across two discovery runs merges into one person, never on name alone", async () => {
  const { dc: dc1 } = await makeJobAndCandidate(T1.tenantId, T1.orgId, { name: "J. Doe", professionalProfileUrl: "https://example.com/team/jane-doe/" });
  const r1 = await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dc1.id });

  // Same canonical URL (trailing slash / case differ) but a DIFFERENT name string.
  const { dc: dc2 } = await makeJobAndCandidate(T1.tenantId, T1.orgId, { name: "Jane R. Doe", professionalProfileUrl: "https://EXAMPLE.com/team/jane-doe" });
  const r2 = await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dc2.id });
  assert.equal(r2.personId, r1.personId, "same canonical profile URL → same person, despite a different name string");

  // A DIFFERENT person with a similar name but no matching URL/email must NOT merge.
  const { dc: dc3 } = await makeJobAndCandidate(T1.tenantId, T1.orgId, { name: "Jane Doe", professionalProfileUrl: "https://example.com/team/someone-else", emailAddress: null, emailProvenance: "not_found" });
  const r3 = await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dc3.id });
  assert.notEqual(r3.personId, r1.personId, "a name match ALONE must never merge two different people");
});

test("manual override on title survives a research refresh, and is flagged as a conflict rather than silently overwritten", async () => {
  const { dc } = await makeJobAndCandidate(T1.tenantId, T1.orgId, { professionalProfileUrl: "https://example.com/team/override-test" });
  const { personId } = await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dc.id });

  const { eq } = await import("drizzle-orm");
  await db.update(schema.people).set({ title: "VP, Translational Medicine (user-corrected)", manualOverrides: ["title"] }).where(eq(schema.people.id, personId));

  // A fresh discovery run for the SAME profile URL proposes a different title.
  const { dc: dc2 } = await makeJobAndCandidate(T1.tenantId, T1.orgId, {
    professionalProfileUrl: "https://example.com/team/override-test",
    title: "Director, Biomarker Development (refreshed)",
  });
  await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dc2.id });

  const [person] = await db.select().from(schema.people).where(eq(schema.people.id, personId));
  assert.equal(person.title, "VP, Translational Medicine (user-corrected)", "the user's edit is preserved");
  assert.ok(person.pendingConflicts.some((c: any) => c.field === "title"), "the discovered value is flagged for review, not dropped");
});

test("logOutreach: personId + organizationId are saved correctly, and linkedin uses linkedin_manual", async () => {
  const { dc } = await makeJobAndCandidate(T1.tenantId, T1.orgId, { professionalProfileUrl: "https://example.com/team/log-1" });
  const { personId } = await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dc.id });

  const res = await logOutreachActivity({ tenantId: T1.tenantId, userId: T1.userId, personId, channel: "linkedin", subject: "Connected", body: "Sent a connection request." });
  const { eq } = await import("drizzle-orm");
  const [row] = await db.select().from(schema.interactions).where(eq(schema.interactions.id, res.interactionId));
  assert.equal(row.type, "linkedin_manual");
  assert.equal(row.personId, personId);
  assert.equal(row.organizationId, T1.orgId);
});

test("logOutreach: a NOTE never advances lastContactedAt; a real touch does", async () => {
  const { dc } = await makeJobAndCandidate(T1.tenantId, T1.orgId, { professionalProfileUrl: "https://example.com/team/log-2" });
  const { personId } = await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dc.id });

  await logOutreachActivity({ tenantId: T1.tenantId, userId: T1.userId, personId, channel: "note", body: "Internal reminder to reach out next week." });
  const { eq, and } = await import("drizzle-orm");
  const [afterNote] = await db.select().from(schema.relationships).where(and(eq(schema.relationships.tenantId, T1.tenantId), eq(schema.relationships.personId, personId)));
  assert.equal(afterNote.lastContactedAt, null, "a note must not advance lastContactedAt");

  await logOutreachActivity({ tenantId: T1.tenantId, userId: T1.userId, personId, channel: "email", subject: "Intro", body: "Hello." });
  const [afterEmail] = await db.select().from(schema.relationships).where(and(eq(schema.relationships.tenantId, T1.tenantId), eq(schema.relationships.personId, personId)));
  assert.ok(afterEmail.lastContactedAt, "a real email touch DOES advance lastContactedAt");
  assert.equal(afterEmail.outreachStatus, "contacted");
});

test("logOutreach for one person never modifies another person's relationship at the same company", async () => {
  const { dc: dcA } = await makeJobAndCandidate(T1.tenantId, T1.orgId, { name: "Alice A", professionalProfileUrl: "https://example.com/team/alice" });
  const { dc: dcB } = await makeJobAndCandidate(T1.tenantId, T1.orgId, { name: "Bob B", professionalProfileUrl: "https://example.com/team/bob" });
  const a = await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dcA.id });
  const b = await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dcB.id });

  await logOutreachActivity({ tenantId: T1.tenantId, userId: T1.userId, personId: a.personId, channel: "email", subject: "Hi Alice" });

  const { eq, and } = await import("drizzle-orm");
  const [relA] = await db.select().from(schema.relationships).where(and(eq(schema.relationships.tenantId, T1.tenantId), eq(schema.relationships.personId, a.personId)));
  const [relB] = await db.select().from(schema.relationships).where(and(eq(schema.relationships.tenantId, T1.tenantId), eq(schema.relationships.personId, b.personId)));
  assert.ok(relA.lastContactedAt, "Alice's relationship was updated");
  assert.equal(relB.lastContactedAt, null, "Bob's relationship at the SAME company must be untouched");
});

test("Do Not Contact blocks a new outbound touch but still allows an internal note", async () => {
  const { dc } = await makeJobAndCandidate(T1.tenantId, T1.orgId, { professionalProfileUrl: "https://example.com/team/dnc" });
  const { personId } = await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dc.id });

  const { eq, and } = await import("drizzle-orm");
  await db.update(schema.relationships).set({ outreachStatus: "do_not_contact" }).where(and(eq(schema.relationships.tenantId, T1.tenantId), eq(schema.relationships.personId, personId)));

  const blocked = await logOutreachActivity({ tenantId: T1.tenantId, userId: T1.userId, personId, channel: "email", subject: "Reaching out" });
  assert.ok(blocked.blocked, "an outbound email must be blocked");

  const noteOk = await logOutreachActivity({ tenantId: T1.tenantId, userId: T1.userId, personId, channel: "note", body: "Left a note for the file." });
  assert.ok(!noteOk.blocked, "an internal note is still allowed");
});

test("logOutreach is resubmission-safe: an identical repeat within the window is deduped, not doubled", async () => {
  const { dc } = await makeJobAndCandidate(T1.tenantId, T1.orgId, { professionalProfileUrl: "https://example.com/team/resubmit" });
  const { personId } = await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dc.id });

  const first = await logOutreachActivity({ tenantId: T1.tenantId, userId: T1.userId, personId, channel: "call", subject: "Intro call", body: "Left a voicemail." });
  const second = await logOutreachActivity({ tenantId: T1.tenantId, userId: T1.userId, personId, channel: "call", subject: "Intro call", body: "Left a voicemail." });
  assert.equal(second.deduped, true);
  assert.equal(second.interactionId, first.interactionId);

  const { eq, and } = await import("drizzle-orm");
  const count = await db.select().from(schema.interactions).where(and(eq(schema.interactions.tenantId, T1.tenantId), eq(schema.interactions.personId, personId)));
  assert.equal(count.length, 1, "no duplicate interaction was created");
});

test("a follow-up task links to the correct contact and is not duplicated on repeat scheduling", async () => {
  const { dc } = await makeJobAndCandidate(T1.tenantId, T1.orgId, { professionalProfileUrl: "https://example.com/team/followup" });
  const { personId } = await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dc.id });

  await logOutreachActivity({ tenantId: T1.tenantId, userId: T1.userId, personId, channel: "email", subject: "First touch", followUpDate: "2026-10-01" });
  await logOutreachActivity({ tenantId: T1.tenantId, userId: T1.userId, personId, channel: "email", subject: "Second touch", body: "different body", followUpDate: "2026-10-15" });

  const { eq, and } = await import("drizzle-orm");
  const tasks = await db.select().from(schema.tasks).where(and(eq(schema.tasks.tenantId, T1.tenantId), eq(schema.tasks.personId, personId)));
  assert.equal(tasks.length, 1, "rescheduling updates the SAME follow-up task rather than creating a second one");
  assert.equal(new Date(tasks[0].dueAt).toISOString().slice(0, 10), "2026-10-15");
});

test("cross-tenant: T2 cannot save or see T1's discovered contact", async () => {
  const { dc } = await makeJobAndCandidate(T1.tenantId, T1.orgId, { professionalProfileUrl: "https://example.com/team/cross-tenant" });
  await assert.rejects(() => saveDiscoveredContact({ tenantId: T2.tenantId, userId: T2.userId, discoveredContactId: dc.id }));
});

test("cross-tenant: T2 cannot log outreach against T1's saved contact", async () => {
  const { dc } = await makeJobAndCandidate(T1.tenantId, T1.orgId, { professionalProfileUrl: "https://example.com/team/cross-tenant-2" });
  const { personId } = await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dc.id });
  await assert.rejects(() => logOutreachActivity({ tenantId: T2.tenantId, userId: T2.userId, personId, channel: "email", subject: "x" }));
});

test("favorite persists across a simulated refresh (re-read from the DB)", async () => {
  const { dc } = await makeJobAndCandidate(T1.tenantId, T1.orgId, { professionalProfileUrl: "https://example.com/team/favorite" });
  const { personId } = await saveDiscoveredContact({ tenantId: T1.tenantId, userId: T1.userId, discoveredContactId: dc.id });

  const { eq, and } = await import("drizzle-orm");
  await db.update(schema.relationships).set({ favorite: true }).where(and(eq(schema.relationships.tenantId, T1.tenantId), eq(schema.relationships.personId, personId)));

  const [rel] = await db.select().from(schema.relationships).where(and(eq(schema.relationships.tenantId, T1.tenantId), eq(schema.relationships.personId, personId)));
  assert.equal(rel.favorite, true, "favorite state survives independent of any in-memory session");
});

test("discovery with no research provider configured fails HONESTLY: a distinct provider_not_configured status, zero fabricated contacts", async () => {
  // This test's whole file runs with LLM_PROVIDER=mock / ANTHROPIC_API_KEY="",
  // so anthropic() returns null — exactly the real "no key set" condition.
  const { jobId } = await startDiscoveryJob({
    tenantId: T1.tenantId,
    userId: T1.userId,
    queryText: "Find translational medicine leaders at Acme Diagnostics",
    organizationId: T1.orgId,
  });
  await runDiscoveryJob(jobId);

  const { eq } = await import("drizzle-orm");
  const [job] = await db.select().from(schema.discoveryJobs).where(eq(schema.discoveryJobs.id, jobId));
  assert.equal(job.status, "provider_not_configured", "a missing provider must be its own distinct status, not lumped into 'failed'");
  assert.match(job.error ?? "", /not configured/i);

  const rows = await db.select().from(schema.discoveredContacts).where(eq(schema.discoveredContacts.jobId, jobId));
  assert.equal(rows.length, 0, "a provider outage must never fabricate placeholder people");
});
