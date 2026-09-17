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
 * Demo-mode data. Every organization, trial, signal and person here is
 * ENTIRELY FICTIONAL — no real company, drug, trial or person is named or
 * implied, and every NCT id is a clearly out-of-range placeholder (real
 * ClinicalTrials.gov ids are far lower). This matters even for "just a demo":
 * fabricated details attached to a REAL company or person would be misleading
 * if a screenshot ever circulated. Runs once per cold start, against an
 * in-memory database only — see src/db/index.ts.
 */

const days = (n: number) => new Date(Date.now() - n * 86_400_000);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);
const ev = (kind: string, url: string, excerpt: string): EvidenceRef => ({ kind, url, excerpt, date: null });

type Fn =
  | "translational_medicine" | "biomarker_development" | "precision_medicine" | "clinical_development"
  | "program_leadership" | "business_development" | "medical_affairs" | "executive";
type Sen = "c_suite" | "svp" | "vp" | "head" | "director" | "senior_manager" | "scientist";

interface OrgSeed {
  name: string;
  domain: string;
  type: "biotech" | "pharma";
  hq: string;
  ticker?: string;
  assetCode: string;
  moa: string;
  stage: string;
  nct: string;
  condition: string;
  phase: "phase_1" | "phase_1_2" | "phase_2" | "phase_2_3" | "phase_3";
  status: "recruiting" | "active_not_recruiting" | "not_yet_recruiting";
  people: { name: string; title: string; function: Fn; seniority: Sen }[];
}

const ORGS: OrgSeed[] = [
  {
    name: "Meridian Oncology Therapeutics",
    domain: "meridianonc-demo.example",
    type: "biotech",
    hq: "San Diego, US",
    assetCode: "MOT-4471",
    moa: "KRAS G12D inhibitor",
    stage: "Phase 2",
    nct: "NCT99910234",
    condition: "Pancreatic Ductal Adenocarcinoma",
    phase: "phase_2",
    status: "recruiting",
    people: [
      { name: "Priya Anand", title: "VP, Translational Medicine", function: "translational_medicine", seniority: "vp" },
      { name: "Marcus Webb", title: "Director, Biomarker Development", function: "biomarker_development", seniority: "director" },
      { name: "Sofia Reyes", title: "Clinical Program Lead, MOT-4471", function: "program_leadership", seniority: "head" },
    ],
  },
  {
    name: "Havenwell Biosciences",
    domain: "havenwell-demo.example",
    type: "biotech",
    hq: "Cambridge, US",
    assetCode: "HVN-2210",
    moa: "TROP2-directed antibody-drug conjugate",
    stage: "Phase 1/2",
    nct: "NCT99911587",
    condition: "Non-Small Cell Lung Cancer",
    phase: "phase_1_2",
    status: "recruiting",
    people: [
      { name: "Daniel Ochoa", title: "Chief Medical Officer", function: "executive", seniority: "c_suite" },
      { name: "Grace Lindqvist", title: "Director, Precision Medicine", function: "precision_medicine", seniority: "director" },
    ],
  },
  {
    name: "Northgate Pharmaceuticals",
    domain: "northgatepharma-demo.example",
    type: "pharma",
    hq: "Basel, CH",
    ticker: "NGTX",
    assetCode: "NGP-8834",
    moa: "PARP1-selective inhibitor",
    stage: "Phase 3",
    nct: "NCT99912908",
    condition: "Colorectal Cancer",
    phase: "phase_3",
    status: "active_not_recruiting",
    people: [
      { name: "Hannah Kessler", title: "SVP, Clinical Development", function: "clinical_development", seniority: "svp" },
      { name: "Tomas Berger", title: "Director, Companion Diagnostics", function: "biomarker_development", seniority: "director" },
      { name: "Yuki Tanaka", title: "Associate Director, Biomarker Strategy", function: "biomarker_development", seniority: "senior_manager" },
    ],
  },
  {
    name: "Cascade Bio",
    domain: "cascadebio-demo.example",
    type: "biotech",
    hq: "Seattle, US",
    assetCode: "CSB-115",
    moa: "Autologous CAR-T (BCMA)",
    stage: "Phase 1",
    nct: "NCT99913476",
    condition: "Solid Tumor",
    phase: "phase_1",
    status: "recruiting",
    people: [
      { name: "Elena Popescu", title: "Head of Translational Science", function: "translational_medicine", seniority: "head" },
      { name: "Robert Kim", title: "VP, Business Development", function: "business_development", seniority: "vp" },
    ],
  },
  {
    name: "Vantree Therapeutics",
    domain: "vantree-demo.example",
    type: "biotech",
    hq: "Boston, US",
    assetCode: "VTX-330",
    moa: "EGFR/MET bispecific antibody",
    stage: "Phase 2",
    nct: "NCT99914721",
    condition: "Non-Small Cell Lung Cancer",
    phase: "phase_2",
    status: "not_yet_recruiting",
    people: [
      { name: "Claire Dubois", title: "Director, Clinical Operations", function: "clinical_development", seniority: "director" },
      { name: "Ahmed Farouk", title: "Medical Director, Oncology", function: "medical_affairs", seniority: "director" },
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
      name: "Jordan Ellis",
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
      { id: "p1", text: "ctDNA MRD monitoring partnerships in solid tumors", paused: false, order: 0 },
      { id: "p2", text: "Companion diagnostics for KRAS-mutated programs", paused: false, order: 1 },
    ],
    therapeuticAreas: ["NSCLC", "Colorectal Cancer", "Pancreatic Ductal Adenocarcinoma"],
    homeRange: "7d",
    onboardedAt: new Date(),
  });

  await db.insert(capabilityProfiles).values({
    tenantId: tenant.id,
    companyName: "Solara Diagnostics",
    website: "https://solara-demo.example",
    description: "DEMO DATA — liquid biopsy and tissue genomic profiling for oncology drug development.",
    testingModalities: ["ctDNA", "cfDNA", "tissue NGS"],
    sampleTypes: ["plasma", "tumor tissue"],
    technologies: ["NGS", "ctDNA", "methylation"],
    cancerTypes: ["NSCLC", "Colorectal Cancer", "Pancreatic Ductal Adenocarcinoma", "Solid Tumor"],
    mustPursue: ["ctDNA", "MRD", "longitudinal monitoring"],
    targetIndications: ["NSCLC", "Colorectal Cancer", "Pancreatic Ductal Adenocarcinoma"],
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
    { name: "Wei Zhang", title: "Senior Scientist, Translational Biomarkers", function: "biomarker_development" as Fn, seniority: "scientist" as Sen },
    { name: "Isabella Conti", title: "Director, Regulatory & CDx Strategy", function: "biomarker_development" as Fn, seniority: "director" as Sen },
    { name: "Owen Fitzgerald", title: "VP, Alliance Management", function: "business_development" as Fn, seniority: "vp" as Sen },
  ];

  for (const [i, org] of ORGS.entries()) {
    const [orgRow] = await db
      .insert(organizations)
      .values({
        tenantId: tenant.id,
        canonicalName: org.name,
        organizationType: org.type,
        canonicalDomain: org.domain,
        website: `https://www.${org.domain}`,
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
        title: `A Study of ${org.assetCode} in ${org.condition}`,
        sponsorName: org.name,
        sponsorOrganizationId: orgRow.id,
        phase: org.phase,
        status: org.status,
        studyType: "Interventional",
        enrollment: 80 + i * 40,
        conditionsRaw: [org.condition],
        interventionsRaw: [{ type: "Drug", name: org.assetCode }],
        molecularEligibility: true,
        biomarkerRequirements: [org.condition.includes("Colorectal") ? "KRAS mutation" : "biomarker-defined population"],
        ctdnaMentions: i % 2 === 0,
        mrdMentions: i === 0,
        commercialSummary: `DEMO DATA — ${org.assetCode} (${org.moa}), ${org.stage}, in ${org.condition}.`,
        recordVersionHash: `demo-${i}-v1`,
        lastCtgovUpdate: days(3 + i),
        firstPostedDate: days(60 + i * 20),
        lastRefreshedAt: days(1),
      })
      .returning();

    const orgUrl = `https://www.${org.domain}`;
    const teamUrl = `${orgUrl}/team`;
    const pipelineUrl = `${orgUrl}/pipeline`;

    // ── Two signals per company: a trial event + a scientific/corporate one ──
    await db.insert(commercialSignals).values({
      tenantId: tenant.id,
      signalType: "NEW_BIOMARKER_REQUIREMENT",
      category: "clinical_trial",
      organizationId: orgRow.id,
      trialId: trialRow.id,
      headline: `${org.name} adds a biomarker-defined eligibility requirement to ${org.nct}`,
      factSummary: `DEMO DATA — ${org.nct} (${org.assetCode}, ${org.stage}) now requires molecular eligibility testing for enrollment in ${org.condition}.`,
      scientificInterpretation: `Consistent with ${org.moa} — a companion assay is likely needed to identify eligible patients.`,
      commercialInterpretation: "Opens a near-term companion diagnostics / patient-selection testing need.",
      whyItMatters: "A molecular eligibility requirement on an active trial is a concrete near-term testing need, not a hypothetical one.",
      whyNow: `${org.nct} is currently ${org.status.replace(/_/g, " ")} — enrollment testing needs are live now.`,
      recommendedAction: "Reach out to the translational/biomarker team about central-lab or companion-assay support.",
      recommendedPersonas: ["biomarker_development", "translational_medicine", "clinical_development"],
      urgency: i < 2 ? "high" : "medium",
      opportunityScore: 90 - i * 7,
      confidenceScore: 78,
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
      headline: `${org.name} presents early ${org.assetCode} data`,
      factSummary: `DEMO DATA — ${org.name} shared preliminary translational data for ${org.assetCode} at a recent oncology conference.`,
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
      const emailAddr = `${first.toLowerCase()}.${rest[rest.length - 1].toLowerCase()}@${org.domain}`;
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
          description: `DEMO DATA — ${p.title} at ${org.name}, focused on ${org.condition.toLowerCase()} programs.`,
          whyThisPerson: `Named on ${org.name}'s team page in connection with ${org.assetCode} (${org.stage}).`,
          whyNow: `Tied to a recent signal: ${org.assetCode}'s ${org.condition} program.`,
          contactLabel: pi === 0 ? "direct_program_evidence" : "relevant_function_unconfirmed",
          relevanceScore: 88 - pi * 10 - i * 2,
          relevanceBreakdown: { functionFit: 32 - pi * 4, programEvidence: pi === 0 ? 24 : 10, useCaseFit: 14, decisionScope: 10, evidenceQuality: 8 },
          relatedTrialId: trialRow.id,
          useCase: "ctDNA / MRD monitoring fit",
          email: emailAddr,
          emailProvenance: pi === 0 ? "publicly_sourced" : "inferred_pattern",
          emailPattern: pi === 0 ? null : "first.last",
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
          body: `Hi ${first},\n\nI wanted to reach out given your work as ${p.title} at ${org.name}. We support ctDNA/MRD testing programs like ${org.assetCode} and would welcome a short call.\n\nBest,\nJordan`,
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
        useCase: `${org.assetCode} — ${org.condition}`,
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
      description: `DEMO DATA — ${extra.title} at ${org.name}.`,
      whyThisPerson: `Named alongside ${org.assetCode} on ${org.name}'s pipeline/team page.`,
      relatedTrialId: trialRow.id,
      useCase: "ctDNA / MRD monitoring fit",
      contactLabel: "relevant_function_unconfirmed",
      relevanceScore: 71 - i * 3,
      relevanceBreakdown: { functionFit: 26, programEvidence: 10, useCaseFit: 14, decisionScope: 9, evidenceQuality: 7 },
      sourceEvidence: [ev("company_page", `${pipelineUrl}/team/${exSlug}`, `${extra.name} — ${extra.title} at ${org.name}.`)],
      emailAddress: `${extra.name.split(" ")[0].toLowerCase()}.${extra.name.split(" ").slice(-1)[0].toLowerCase()}@${org.domain}`,
      emailProvenance: "inferred_pattern",
    });
  }

  // ── A couple of drafts, a watchlist, a workspace ────────────────────────
  if (savedPeopleIds[0]) {
    await db.insert(outreachDrafts).values({
      tenantId: tenant.id,
      userId: user.id,
      personId: savedPeopleIds[0],
      subject: "Introduction — Solara Diagnostics <> Meridian Oncology",
      body:
        "Hi Priya,\n\nI wanted to reach out given your work in translational medicine at Meridian Oncology Therapeutics. " +
        "Solara supports ctDNA/MRD monitoring programs like MOT-4471, and I'd welcome a short call to see if there's a fit.\n\nBest,\nJordan",
      status: "draft",
      generatedBy: "user",
    });
  }

  await db.insert(watchlists).values({
    tenantId: tenant.id,
    name: "KRAS / biomarker-defined programs",
    description: "DEMO DATA — companies running biomarker-eligible trials relevant to Solara's testing menu.",
    ownerUserId: user.id,
    minOpportunityScore: 55,
  }).returning().then(async ([wl]) => {
    if (!wl) return;
    await db.insert(watchlistItems).values([
      { watchlistId: wl.id, entityKind: "keyword" as const, label: "KRAS" },
      { watchlistId: wl.id, entityKind: "keyword" as const, label: "MRD" },
      { watchlistId: wl.id, entityKind: "indication" as const, label: "NSCLC" },
    ]);
  });

  const [ws] = await db
    .insert(workspaces)
    .values({
      tenantId: tenant.id,
      userId: user.id,
      title: "Prepare a presentation for Meridian Oncology",
      template: "presentation",
      status: "active",
    })
    .returning();
  if (ws) {
    await db.insert(workspaceItems).values([
      { workspaceId: ws.id, section: "todo", title: "Review MOT-4471 biomarker eligibility signal", sortIndex: 0 },
      { workspaceId: ws.id, section: "people", title: "Priya Anand — VP, Translational Medicine", sortIndex: 1 },
      { workspaceId: ws.id, section: "trials", title: "NCT99910234", sortIndex: 2 },
    ]);
  }

  seeded = true;
}
