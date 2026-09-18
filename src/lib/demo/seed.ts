import "server-only";
import { eq } from "drizzle-orm";
import type { DrizzleDb } from "@/db";
import {
  capabilityProfiles,
  discoveredContacts,
  discoveryJobs,
  interactions,
  organizations,
  organizationMembers,
  outreachDrafts,
  people,
  relationships,
  scoringProfiles,
  tasks,
  tenants,
  trials,
  users,
  userPreferences,
  commercialSignals,
  watchlistItems,
  watchlists,
  workspaceItems,
  workspaces,
  type EvidenceRef,
} from "@/db/schema";
import { DEFAULT_WEIGHTS } from "@/lib/scoring/model";
import { DEMO_TENANT_SLUG, DEMO_USER_EMAIL } from "./constants";

/**
 * Demo-mode data — a RAS/KRAS oncology vertical.
 *
 * Trials, sponsors, drug names, NCT ids, phases and statuses are REAL and
 * current (pulled from ClinicalTrials.gov) — this is public factual record,
 * not fabrication, and it's what makes the demo actually look credible to
 * anyone in the field.
 *
 * The PEOPLE are deliberately NOT mapped onto specific, identifiable, real
 * executives: this build fabricates outreach status, logged interactions,
 * relevance scores and inferred personal emails for each contact, and
 * attaching that invented narrative to a real, named individual — on a
 * public URL — is a different thing entirely from citing a real trial's
 * public facts. Titles/functions are realistic and grounded in each
 * company's real KRAS program; the people themselves are illustrative.
 *
 * Runs once per cold start, against an in-memory database only — see
 * src/db/index.ts.
 */

const days = (n: number) => new Date(Date.now() - n * 86_400_000);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);
const ev = (kind: string, url: string, excerpt: string): EvidenceRef => ({ kind, url, excerpt, date: null });

type Fn =
  | "translational_medicine" | "biomarker_development" | "precision_medicine" | "clinical_development"
  | "program_leadership" | "business_development" | "medical_affairs" | "executive";
type Sen = "c_suite" | "svp" | "vp" | "head" | "director" | "senior_manager" | "scientist";

/** A fake, non-resolvable domain for a fictional person's email/profile-page
 * evidence — NEVER the company's real domain. A real company's real website
 * is a fine, factual thing to display; a plausible-looking address or bio
 * page on that company's REAL mail/web server for a made-up person is not —
 * it reads as belonging to someone at that company when nothing verifies it
 * does, and an actual send would land in a real company's real inbox. */
function fakeEmailDomain(orgName: string): string {
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "company";
  return `${slug}-demo.example`;
}

interface OrgSeed {
  name: string;
  /** The company's REAL public domain — display only (website field). */
  realDomain: string;
  type: "biotech" | "pharma";
  hq: string;
  ticker?: string;
  drug: string;
  moa: string;
  nct: string;
  trialName: string;
  condition: string;
  phase: "phase_1" | "phase_2" | "phase_2_3" | "phase_3";
  status: "recruiting" | "active_not_recruiting";
  people: { name: string; title: string; function: Fn; seniority: Sen }[];
}

/** Real, current (ClinicalTrials.gov, Sept 2026) RAS/KRAS-directed programs. */
const ORGS: OrgSeed[] = [
  {
    name: "Revolution Medicines",
    realDomain: "revmed.com",
    type: "biotech",
    hq: "Redwood City, US",
    ticker: "RVMD",
    drug: "Daraxonrasib (RMC-6236)",
    moa: "Pan-RAS(ON) multi-selective inhibitor",
    nct: "NCT06881784",
    trialName: "RASolve 301",
    condition: "RAS-mutated Non-Small Cell Lung Cancer",
    phase: "phase_3",
    status: "recruiting",
    people: [
      { name: "Renata Kowalski", title: "VP, Translational Medicine", function: "translational_medicine", seniority: "vp" },
      { name: "Miles Okonkwo", title: "Director, Biomarker Development", function: "biomarker_development", seniority: "director" },
      { name: "Suri Anand", title: "Clinical Program Lead, RASolve", function: "program_leadership", seniority: "head" },
    ],
  },
  {
    name: "Amgen",
    realDomain: "amgen.com",
    type: "pharma",
    hq: "Thousand Oaks, US",
    ticker: "AMGN",
    drug: "Sotorasib (Lumakras)",
    moa: "KRAS G12C covalent inhibitor",
    nct: "NCT06252649",
    trialName: "CodeBreaK 300-series (sotorasib + panitumumab + FOLFIRI)",
    condition: "Metastatic Colorectal Cancer",
    phase: "phase_3",
    status: "recruiting",
    people: [
      { name: "Dana Whitfield", title: "Executive Director, Companion Diagnostics", function: "biomarker_development", seniority: "director" },
      { name: "Julian Marchetti", title: "Director, Clinical Development — GI Oncology", function: "clinical_development", seniority: "director" },
    ],
  },
  {
    name: "Mirati Therapeutics (a Bristol Myers Squibb company)",
    realDomain: "mirati.com",
    type: "biotech",
    hq: "San Diego, US",
    drug: "Adagrasib (Krazati)",
    moa: "KRAS G12C covalent inhibitor",
    nct: "NCT05853575",
    trialName: "KRYSTAL-21",
    condition: "Non-Small Cell Lung Cancer",
    phase: "phase_2",
    status: "active_not_recruiting",
    people: [
      { name: "Priyanka Deshmukh", title: "Head of Precision Medicine", function: "precision_medicine", seniority: "head" },
      { name: "Casper Lindgren", title: "Associate Director, Biomarker Strategy", function: "biomarker_development", seniority: "senior_manager" },
    ],
  },
  {
    name: "Novartis",
    realDomain: "novartis.com",
    type: "pharma",
    hq: "Basel, CH",
    ticker: "NVS",
    drug: "Opnurasib (JDQ443)",
    moa: "KRAS G12C inhibitor",
    nct: "NCT05132075",
    trialName: "KontRASt-02",
    condition: "Non-Small Cell Lung Cancer",
    phase: "phase_3",
    status: "active_not_recruiting",
    people: [
      { name: "Helena Vasquez", title: "SVP, Clinical Development", function: "clinical_development", seniority: "svp" },
      { name: "Théo Bergström", title: "Director, Companion Diagnostics", function: "biomarker_development", seniority: "director" },
    ],
  },
  {
    name: "Boehringer Ingelheim",
    realDomain: "boehringer-ingelheim.com",
    type: "pharma",
    hq: "Ingelheim, DE",
    drug: "BI 1701963",
    moa: "SOS1::KRAS protein-protein interaction inhibitor",
    nct: "NCT04111458",
    trialName: "BI 1701963 monotherapy / combination dose escalation",
    condition: "KRAS-mutated Advanced Solid Tumors",
    phase: "phase_1",
    status: "active_not_recruiting",
    people: [
      { name: "Astrid Novak", title: "Head of Translational Science, Oncology", function: "translational_medicine", seniority: "head" },
      { name: "Femi Adebayo", title: "VP, External Innovation", function: "business_development", seniority: "vp" },
    ],
  },
];

/** True once this cold start has already seeded — never reseed a warm instance. */
let seeded = false;

export async function seedDemoData(db: DrizzleDb): Promise<void> {
  if (seeded) return;
  const [existing] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, DEMO_TENANT_SLUG)).limit(1);
  if (existing) {
    seeded = true;
    return;
  }

  // ── Tenant, demo user, membership, preferences ──────────────────────────
  const [tenant] = await db
    .insert(tenants)
    .values({ name: "Solara Diagnostics (Demo)", slug: DEMO_TENANT_SLUG, domain: "solara-demo.example" })
    .returning();

  const [user] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: DEMO_USER_EMAIL,
      name: "Myles Bennett",
      position: "Director, Business Development",
      role: "owner",
      lastLoginAt: new Date(),
    })
    .returning();

  await db.insert(organizationMembers).values({ tenantId: tenant.id, userId: user.id, role: "owner" });

  await db.insert(userPreferences).values({
    userId: user.id,
    tenantId: tenant.id,
    priorities: [
      { id: "p1", text: "ctDNA MRD monitoring for RAS/KRAS-mutated solid tumors", paused: false, order: 0 },
      { id: "p2", text: "Companion diagnostics for KRAS G12C / pan-RAS programs", paused: false, order: 1 },
    ],
    therapeuticAreas: ["Non-Small Cell Lung Cancer", "Metastatic Colorectal Cancer", "Pancreatic Ductal Adenocarcinoma"],
    biomarkers: ["KRAS", "KRAS G12C", "KRAS G12D", "NRAS", "SOS1"],
    pathways: ["RAS/MAPK"],
    homeRange: "7d",
    onboardedAt: new Date(),
  });

  await db.insert(capabilityProfiles).values({
    tenantId: tenant.id,
    companyName: "Solara Diagnostics",
    website: "https://solara-demo.example",
    description: "Liquid biopsy and tissue genomic profiling for oncology drug development, focused on the RAS/MAPK pathway.",
    testingModalities: ["ctDNA", "cfDNA", "tissue NGS"],
    sampleTypes: ["plasma", "tumor tissue"],
    technologies: ["NGS", "ctDNA", "methylation"],
    cancerTypes: ["Non-Small Cell Lung Cancer", "Metastatic Colorectal Cancer", "Pancreatic Ductal Adenocarcinoma"],
    mustPursue: ["KRAS", "pan-RAS", "MRD", "longitudinal monitoring"],
    targetIndications: ["Non-Small Cell Lung Cancer", "Metastatic Colorectal Cancer", "Pancreatic Ductal Adenocarcinoma"],
    targetPathways: ["RAS/MAPK"],
    targetAccountTypes: ["pharma", "biotech"],
    minimumOpportunityScore: 50,
  });

  await db.insert(scoringProfiles).values({
    tenantId: tenant.id,
    name: "Default (balanced)",
    isDefault: true,
    weights: DEFAULT_WEIGHTS,
  });

  // ── Organizations, trials, signals, people ──────────────────────────────
  const savedPeopleIds: string[] = [];
  const extraDiscoveredNames = [
    { name: "Ingrid Solberg", title: "Senior Scientist, Translational Biomarkers", function: "biomarker_development" as Fn, seniority: "scientist" as Sen },
    { name: "Rafael Cruz", title: "Director, Regulatory & CDx Strategy", function: "biomarker_development" as Fn, seniority: "director" as Sen },
    { name: "Naledi Mokoena", title: "VP, Alliance Management", function: "business_development" as Fn, seniority: "vp" as Sen },
  ];

  for (const [i, org] of ORGS.entries()) {
    const [orgRow] = await db
      .insert(organizations)
      .values({
        tenantId: tenant.id,
        canonicalName: org.name,
        organizationType: org.type,
        // canonicalDomain feeds this app's OWN email-pattern inference for any
        // future live search against this org — keep it fake so a fictional
        // person's inferred address never lands on the real company's real
        // mail server. `website` stays the real, factual public URL.
        canonicalDomain: fakeEmailDomain(org.name),
        website: `https://www.${org.realDomain}`,
        headquarters: org.hq,
        ticker: org.ticker,
        isPublic: Boolean(org.ticker),
        accountTier: i < 2 ? "strategic" : "priority",
        accountScore: 60 + i * 6,
        oncologyFocus: true,
        lastVerifiedAt: days(2),
      })
      .returning();

    const [trialRow] = await db
      .insert(trials)
      .values({
        tenantId: tenant.id,
        nctId: org.nct,
        title: `${org.trialName}: ${org.drug} in ${org.condition}`,
        sponsorName: org.name,
        sponsorOrganizationId: orgRow.id,
        phase: org.phase,
        status: org.status,
        studyType: "Interventional",
        enrollment: 80 + i * 60,
        conditionsRaw: [org.condition],
        interventionsRaw: [{ type: "Drug", name: org.drug }],
        molecularEligibility: true,
        biomarkerRequirements: [org.condition.includes("Colorectal") ? "KRAS G12C mutation" : "KRAS-mutant tumor genotype"],
        ctdnaMentions: i % 2 === 0,
        mrdMentions: i === 0,
        commercialSummary: `${org.drug} (${org.moa}) — ${org.trialName}, ${org.condition}. Real, current ClinicalTrials.gov record.`,
        recordVersionHash: `demo-real-${i}-v1`,
        lastCtgovUpdate: days(3 + i),
        firstPostedDate: days(200 + i * 40),
        lastRefreshedAt: days(1),
      })
      .returning();

    // Fictional people's "found on this page" evidence links use the fake
    // domain too — a made-up bio page must never look like it lives on the
    // real company's real website.
    const fakeUrl = `https://www.${fakeEmailDomain(org.name)}`;
    const teamUrl = `${fakeUrl}/leadership`;
    const pipelineUrl = `${fakeUrl}/pipeline`;

    // ── Two signals per company: a trial event + a scientific/corporate one ──
    await db.insert(commercialSignals).values({
      tenantId: tenant.id,
      signalType: "NEW_BIOMARKER_REQUIREMENT",
      category: "clinical_trial",
      organizationId: orgRow.id,
      trialId: trialRow.id,
      headline: `${org.name} — ${org.trialName} (${org.nct}) requires KRAS genotyping for enrollment`,
      factSummary: `${org.nct} (${org.drug}, ${org.status.replace(/_/g, " ")}) requires molecular eligibility testing for enrollment in ${org.condition}. Source: ClinicalTrials.gov.`,
      scientificInterpretation: `Consistent with ${org.moa} — a companion assay is needed to identify eligible patients.`,
      commercialInterpretation: "Opens a near-term companion diagnostics / patient-selection testing need.",
      whyItMatters: "A molecular eligibility requirement on a real, currently active trial is a concrete near-term testing need.",
      whyNow: `${org.nct} is currently ${org.status.replace(/_/g, " ")} — enrollment testing needs are live now.`,
      recommendedAction: "Reach out to the translational/biomarker team about central-lab or companion-assay support.",
      recommendedPersonas: ["biomarker_development", "translational_medicine", "clinical_development"],
      urgency: i < 2 ? "high" : "medium",
      opportunityScore: 90 - i * 7,
      confidenceScore: 82,
      scoreBreakdown: { commercialFit: 22, clinicalTiming: 18, biomarkerNeed: 19, relationshipAccessibility: 7, signalStrength: 9, accountStrategicValue: 8, urgency: 4 },
      dedupeKey: `demo-signal-${i}-biomarker`,
      status: "new",
      detectedAt: days(i),
      sourceDate: days(i),
    }).onConflictDoNothing();

    await db.insert(commercialSignals).values({
      tenantId: tenant.id,
      signalType: "NEW_DATA_READOUT",
      category: "publication",
      organizationId: orgRow.id,
      trialId: trialRow.id,
      headline: `${org.name} shares ${org.trialName} translational data`,
      factSummary: `${org.name} presented preliminary translational biomarker data for ${org.drug} at a recent oncology conference.`,
      whyItMatters: "New translational data readouts often precede an expansion of biomarker/monitoring scope.",
      whyNow: "Recently presented — the team is likely still assembling supporting testing partners.",
      recommendedPersonas: ["translational_medicine", "program_leadership"],
      urgency: "medium",
      opportunityScore: 68 - i * 4,
      confidenceScore: 65,
      dedupeKey: `demo-signal-${i}-readout`,
      status: i === 3 ? "reviewed" : "new",
      detectedAt: days(i + 1),
      sourceDate: days(i + 1),
    }).onConflictDoNothing();

    // ── People + relationships + evidence-backed contact info ──────────────
    for (const [pi, p] of org.people.entries()) {
      const slug = p.name.toLowerCase().replace(/[^a-z]+/g, "-");
      const [first, ...rest] = p.name.split(" ");
      const emailAddr = `${first.toLowerCase()}.${rest[rest.length - 1].toLowerCase()}@${fakeEmailDomain(org.name)}`;
      const profileUrl = `${teamUrl}/${slug}`;

      const [personRow] = await db
        .insert(people)
        .values({
          tenantId: tenant.id,
          organizationId: orgRow.id,
          name: p.name,
          title: p.title,
          seniority: p.seniority,
          function: p.function,
          professionalProfileUrl: profileUrl,
          description: `${p.title} at ${org.name}, focused on ${org.condition.toLowerCase()} programs.`,
          whyThisPerson: `Function fit for ${org.trialName} (${org.nct}) — ${p.title.toLowerCase()} role typically owns biomarker/testing decisions for this program.`,
          whyNow: `Tied to a recent signal: ${org.trialName}'s ${org.condition} enrollment requirement.`,
          contactLabel: pi === 0 ? "direct_program_evidence" : "relevant_function_unconfirmed",
          relevanceScore: 88 - pi * 10 - i * 2,
          relevanceBreakdown: { functionFit: 32 - pi * 4, programEvidence: pi === 0 ? 24 : 10, useCaseFit: 14, decisionScope: 10, evidenceQuality: 8 },
          relatedTrialId: trialRow.id,
          useCase: "ctDNA / MRD monitoring fit",
          email: emailAddr,
          emailProvenance: "inferred_pattern",
          emailPattern: "first.last",
          sourceEvidence: [ev("company_page", profileUrl, `${p.name} — ${p.title} at ${org.name}.`)],
          lastVerifiedAt: days(2),
        })
        .returning();
      savedPeopleIds.push(personRow.id);

      const outreachStatuses = ["new", "contacted", "follow_up_due", "replied"] as const;
      const status = outreachStatuses[(i + pi) % outreachStatuses.length];
      const [rel] = await db
        .insert(relationships)
        .values({
          tenantId: tenant.id,
          personId: personRow.id,
          organizationId: orgRow.id,
          ownerUserId: user.id,
          outreachStatus: status,
          favorite: pi === 0 && i < 2,
          firstContactedAt: status === "new" ? null : days(10),
          lastContactedAt: status === "new" ? null : days(4),
          nextFollowUpAt: status === "follow_up_due" ? inDays(3) : null,
        })
        .returning();

      if (status !== "new") {
        await db.insert(interactions).values({
          tenantId: tenant.id,
          type: "email_sent",
          userId: user.id,
          personId: personRow.id,
          organizationId: orgRow.id,
          subject: `Introduction — Solara Diagnostics <> ${org.name}`,
          body: `Hi ${first},\n\nI wanted to reach out given your work as ${p.title} at ${org.name}. We support ctDNA/MRD testing for KRAS-mutant programs like ${org.trialName}, and would welcome a short call.\n\nBest,\nMyles`,
          outcome: status === "replied" ? "Positive reply — scheduling a call" : "Sent, awaiting reply",
          crmSyncStatus: "not_synced",
          occurredAt: days(4),
        });
      }
      if (status === "follow_up_due") {
        await db.insert(tasks).values({
          tenantId: tenant.id,
          userId: user.id,
          title: `Follow up with ${p.name} (${org.name})`,
          category: "follow_up",
          notes: "Check back on the biomarker eligibility requirement discussion.",
          dueAt: inDays(3),
          relatedOrganizationId: orgRow.id,
          personId: personRow.id,
          source: "outreach_followup",
          dedupeKey: `outreach_followup:${personRow.id}`,
        });
      }
      void rel;
    }

    // ── One "already researched" discovery job per company with a couple of
    // not-yet-saved candidates, so Discover shows real-looking results
    // immediately without any live call. ──────────────────────────────────
    const [job] = await db
      .insert(discoveryJobs)
      .values({
        tenantId: tenant.id,
        userId: user.id,
        queryText: `Find relevant contacts at ${org.name}`,
        companyName: org.name,
        organizationId: orgRow.id,
        trialId: trialRow.id,
        useCase: `${org.drug} — ${org.condition}`,
        status: "complete",
        coverage: { linkedin: "unavailable", company_site: "used" },
        resultCount: 1,
        updatedAt: days(1),
      })
      .returning();

    const extra = extraDiscoveredNames[i % extraDiscoveredNames.length];
    const exSlug = extra.name.toLowerCase().replace(/[^a-z]+/g, "-");
    await db.insert(discoveredContacts).values({
      jobId: job.id,
      tenantId: tenant.id,
      name: extra.name,
      title: extra.title,
      company: org.name,
      organizationId: orgRow.id,
      function: extra.function,
      seniority: extra.seniority,
      professionalProfileUrl: `${pipelineUrl}/team/${exSlug}`,
      description: `${extra.title} at ${org.name}.`,
      whyThisPerson: `Function fit for ${org.trialName} (${org.nct}) on ${org.name}'s pipeline page.`,
      relatedTrialId: trialRow.id,
      useCase: "ctDNA / MRD monitoring fit",
      contactLabel: "relevant_function_unconfirmed",
      relevanceScore: 71 - i * 3,
      relevanceBreakdown: { functionFit: 26, programEvidence: 10, useCaseFit: 14, decisionScope: 9, evidenceQuality: 7 },
      sourceEvidence: [ev("company_page", `${pipelineUrl}/team/${exSlug}`, `${extra.name} — ${extra.title} at ${org.name}.`)],
      emailAddress: `${extra.name.split(" ")[0].toLowerCase()}.${extra.name.split(" ").slice(-1)[0].toLowerCase()}@${fakeEmailDomain(org.name)}`,
      emailProvenance: "inferred_pattern",
    });
  }

  // ── A couple of drafts, a watchlist, a workspace ────────────────────────
  if (savedPeopleIds[0]) {
    await db.insert(outreachDrafts).values({
      tenantId: tenant.id,
      userId: user.id,
      personId: savedPeopleIds[0],
      subject: "Introduction — Solara Diagnostics <> Revolution Medicines",
      body:
        "Hi Renata,\n\nI wanted to reach out given your work in translational medicine at Revolution Medicines. " +
        "Solara supports ctDNA/MRD monitoring programs for pan-RAS(ON) inhibitors like daraxonrasib, and I'd welcome a short call to see if there's a fit.\n\nBest,\nMyles",
      status: "draft",
      generatedBy: "user",
    });
  }

  await db.insert(watchlists).values({
    tenantId: tenant.id,
    name: "RAS / KRAS biomarker-defined programs",
    description: "Companies running biomarker-eligible RAS/KRAS trials relevant to Solara's testing menu.",
    ownerUserId: user.id,
    minOpportunityScore: 55,
  }).returning().then(async ([wl]) => {
    if (!wl) return;
    await db.insert(watchlistItems).values([
      { watchlistId: wl.id, entityKind: "keyword" as const, label: "KRAS" },
      { watchlistId: wl.id, entityKind: "keyword" as const, label: "pan-RAS" },
      { watchlistId: wl.id, entityKind: "keyword" as const, label: "MRD" },
      { watchlistId: wl.id, entityKind: "indication" as const, label: "NSCLC" },
    ]);
  });

  const [ws] = await db
    .insert(workspaces)
    .values({
      tenantId: tenant.id,
      userId: user.id,
      title: "Prepare a presentation for Revolution Medicines",
      template: "presentation",
      status: "active",
    })
    .returning();
  if (ws) {
    await db.insert(workspaceItems).values([
      { workspaceId: ws.id, section: "todo", title: "Review RASolve 301 biomarker eligibility signal", sortIndex: 0 },
      { workspaceId: ws.id, section: "people", title: "Renata Kowalski — VP, Translational Medicine", sortIndex: 1 },
      { workspaceId: ws.id, section: "trials", title: "NCT06881784 — RASolve 301", sortIndex: 2 },
    ]);
  }

  seeded = true;
}
