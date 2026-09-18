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
 * Demo-mode data — a RAS/KRAS oncology vertical, from Predicine's perspective.
 *
 * Trials, sponsors, drug names, NCT ids, phases, statuses and enrollment
 * counts are REAL and current (pulled from ClinicalTrials.gov) — this is
 * public factual record, not fabrication, and it's what makes the demo
 * actually look credible to anyone in the field. 20 real, currently active
 * RAS/KRAS-directed programs across 20 real sponsors.
 *
 * The PEOPLE are deliberately NOT mapped onto specific, identifiable, real
 * executives: this build fabricates outreach status, logged interactions,
 * relevance scores and inferred personal emails for each contact, and
 * attaching that invented narrative to a real, named individual — on a
 * public URL — is a different thing entirely from citing a real trial's
 * public facts. Titles/functions are realistic and grounded in each
 * company's real KRAS program; the people themselves are illustrative, and
 * their inferred email/profile-page domain is always a fake, non-resolvable
 * one — never the real company's real domain.
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
  /** The company's REAL public domain — display only (website field); null
   * when not confidently known, rather than guess. */
  realDomain: string | null;
  type: "biotech" | "pharma";
  hq: string;
  ticker?: string;
  drug: string;
  moa: string;
  nct: string;
  trialName: string;
  condition: string;
  phase: "phase_1" | "phase_1_2" | "phase_2" | "phase_2_3" | "phase_3";
  status: "recruiting" | "active_not_recruiting";
  enrollment: number;
  summary: string;
  biomarker: string;
  people: { name: string; title: string; function: Fn; seniority: Sen }[];
}

/** 20 real, current (ClinicalTrials.gov, Sept 2026) RAS/KRAS-directed programs. */
const ORGS: OrgSeed[] = [
  {
    name: "Revolution Medicines", realDomain: "revmed.com", type: "biotech", hq: "Redwood City, US", ticker: "RVMD",
    drug: "Daraxonrasib (RMC-6236)", moa: "Pan-RAS(ON) multi-selective inhibitor",
    nct: "NCT06881784", trialName: "RASolve 301", condition: "RAS-mutated Non-Small Cell Lung Cancer",
    phase: "phase_3", status: "recruiting", enrollment: 460, biomarker: "RAS mutation (broad panel)",
    summary: "Randomized trial of daraxonrasib versus standard-of-care chemotherapy in previously treated RAS-mutated NSCLC — the first pan-RAS(ON) inhibitor to reach a registrational study.",
    people: [
      { name: "Renata Kowalski", title: "VP, Translational Medicine", function: "translational_medicine", seniority: "vp" },
      { name: "Miles Okonkwo", title: "Director, Biomarker Development", function: "biomarker_development", seniority: "director" },
    ],
  },
  {
    name: "Amgen", realDomain: "amgen.com", type: "pharma", hq: "Thousand Oaks, US", ticker: "AMGN",
    drug: "Sotorasib (Lumakras)", moa: "KRAS G12C covalent inhibitor",
    nct: "NCT06252649", trialName: "CodeBreaK 301", condition: "Metastatic Colorectal Cancer",
    phase: "phase_3", status: "recruiting", enrollment: 420, biomarker: "KRAS G12C mutation",
    summary: "Phase 3 study of sotorasib plus panitumumab plus FOLFIRI versus investigator's choice chemotherapy in second-line KRAS G12C-mutated metastatic colorectal cancer.",
    people: [
      { name: "Dana Whitfield", title: "Executive Director, Companion Diagnostics", function: "biomarker_development", seniority: "director" },
      { name: "Julian Marchetti", title: "Director, Clinical Development — GI Oncology", function: "clinical_development", seniority: "director" },
    ],
  },
  {
    name: "Mirati Therapeutics (a Bristol Myers Squibb company)", realDomain: "mirati.com", type: "biotech", hq: "San Diego, US",
    drug: "Adagrasib (Krazati)", moa: "KRAS G12C covalent inhibitor",
    nct: "NCT05853575", trialName: "KRYSTAL-21", condition: "Non-Small Cell Lung Cancer",
    phase: "phase_2", status: "active_not_recruiting", enrollment: 200, biomarker: "KRAS G12C mutation",
    summary: "Trial of two adagrasib dosing regimens in KRAS G12C-mutated NSCLC, refining the dose/exposure relationship for the approved agent.",
    people: [
      { name: "Priyanka Deshmukh", title: "Head of Precision Medicine", function: "precision_medicine", seniority: "head" },
      { name: "Casper Lindgren", title: "Associate Director, Biomarker Strategy", function: "biomarker_development", seniority: "senior_manager" },
    ],
  },
  {
    name: "Novartis", realDomain: "novartis.com", type: "pharma", hq: "Basel, CH", ticker: "NVS",
    drug: "Opnurasib (JDQ443)", moa: "KRAS G12C inhibitor",
    nct: "NCT05132075", trialName: "KontRASt-02", condition: "Non-Small Cell Lung Cancer",
    phase: "phase_3", status: "active_not_recruiting", enrollment: 453, biomarker: "KRAS G12C mutation",
    summary: "Randomized study of opnurasib versus docetaxel in previously treated, locally advanced or metastatic KRAS G12C-mutated NSCLC.",
    people: [
      { name: "Helena Vasquez", title: "SVP, Clinical Development", function: "clinical_development", seniority: "svp" },
      { name: "Théo Bergström", title: "Director, Companion Diagnostics", function: "biomarker_development", seniority: "director" },
    ],
  },
  {
    name: "Boehringer Ingelheim", realDomain: "boehringer-ingelheim.com", type: "pharma", hq: "Ingelheim, DE",
    drug: "BI 1701963", moa: "SOS1::KRAS protein-protein interaction inhibitor",
    nct: "NCT04111458", trialName: "BI 1701963 Dose Escalation", condition: "KRAS-mutated Advanced Solid Tumors",
    phase: "phase_1", status: "active_not_recruiting", enrollment: 220, biomarker: "KRAS mutation (pan-allele)",
    summary: "First-in-human dose escalation of the SOS1 inhibitor BI 1701963 as monotherapy and in combination with trametinib across KRAS-mutant solid tumors.",
    people: [
      { name: "Astrid Novak", title: "Head of Translational Science, Oncology", function: "translational_medicine", seniority: "head" },
      { name: "Femi Adebayo", title: "VP, External Innovation", function: "business_development", seniority: "vp" },
    ],
  },
  {
    name: "Genentech (a Roche company)", realDomain: "gene.com", type: "pharma", hq: "South San Francisco, US",
    drug: "Divarasib (GDC-6036)", moa: "KRAS G12C covalent inhibitor",
    nct: "NCT06793215", trialName: "Divarasib + Pembrolizumab Registrational Study", condition: "KRAS G12C-mutated Non-Small Cell Lung Cancer",
    phase: "phase_3", status: "recruiting", enrollment: 600, biomarker: "KRAS G12C mutation",
    summary: "Randomized front-line study of divarasib plus pembrolizumab versus chemotherapy plus pembrolizumab in previously untreated KRAS G12C-mutated non-squamous NSCLC.",
    people: [
      { name: "Isabelle Rousseau", title: "VP, Companion Diagnostics", function: "biomarker_development", seniority: "vp" },
      { name: "Nathaniel Osei", title: "Director, Translational Oncology", function: "translational_medicine", seniority: "director" },
    ],
  },
  {
    name: "Eli Lilly and Company", realDomain: "lilly.com", type: "pharma", hq: "Indianapolis, US", ticker: "LLY",
    drug: "Olomorasib (LY3537982)", moa: "KRAS G12C covalent inhibitor",
    nct: "NCT06890598", trialName: "SUNRAY-02", condition: "Non-Small Cell Lung Cancer",
    phase: "phase_3", status: "recruiting", enrollment: 700, biomarker: "KRAS G12C mutation",
    summary: "Phase 3 evaluation of olomorasib with pembrolizumab in resected KRAS G12C-mutated NSCLC, and with durvalumab in unresectable disease — one of the largest KRAS G12C studies enrolling.",
    people: [
      { name: "Bianca Lombardi", title: "Director, Biomarker & Companion Diagnostics", function: "biomarker_development", seniority: "director" },
      { name: "Connor McAllister", title: "Clinical Program Lead, Thoracic Oncology", function: "program_leadership", seniority: "head" },
    ],
  },
  {
    name: "Verastem Oncology", realDomain: "verastem.com", type: "biotech", hq: "Needham, US", ticker: "VSTM",
    drug: "VS-7375", moa: "KRAS G12D inhibitor",
    nct: "NCT07020221", trialName: "VS-7375 Dose Expansion", condition: "KRAS G12D-mutated Solid Tumors",
    phase: "phase_1_2", status: "recruiting", enrollment: 295, biomarker: "KRAS G12D mutation",
    summary: "Multi-cohort study of VS-7375 across pancreatic, lung, and colorectal cancers carrying the KRAS G12D mutation — one of the broadest G12D-selective programs in the clinic.",
    people: [
      { name: "Odalys Ferreira", title: "VP, Translational Medicine", function: "translational_medicine", seniority: "vp" },
      { name: "Grant Sutherland", title: "Director, Biomarker Operations", function: "biomarker_development", seniority: "director" },
    ],
  },
  {
    name: "Allist Pharmaceuticals", realDomain: null, type: "biotech", hq: "Shanghai, CN",
    drug: "Glecirasib (JAB-21822) + JAB-3312", moa: "KRAS G12C inhibitor + SHP2 inhibitor combination",
    nct: "NCT05288205", trialName: "Glecirasib + SHP2i Combination Study", condition: "KRAS G12C-mutated Solid Tumors (NSCLC, CRC, PDAC)",
    phase: "phase_1_2", status: "recruiting", enrollment: 240, biomarker: "KRAS G12C mutation",
    summary: "Combination study pairing the KRAS G12C inhibitor glecirasib with the SHP2 inhibitor JAB-3312 across three tumor types, testing whether upstream pathway blockade delays resistance.",
    people: [
      { name: "Wen-Li Tsang", title: "Director, Global Biomarker Strategy", function: "biomarker_development", seniority: "director" },
      { name: "Marcus Delacroix", title: "VP, Clinical Development", function: "clinical_development", seniority: "vp" },
    ],
  },
  {
    name: "BridgeBio Oncology Therapeutics", realDomain: "bridgebio.com", type: "biotech", hq: "Palo Alto, US",
    drug: "BBO-8520", moa: "Direct KRAS G12C(ON) inhibitor",
    nct: "NCT06343402", trialName: "BBO-8520 First-in-Human Study", condition: "KRAS G12C-mutated Non-Small Cell Lung Cancer",
    phase: "phase_1", status: "recruiting", enrollment: 350, biomarker: "KRAS G12C mutation",
    summary: "First-in-human study of BBO-8520, a direct inhibitor of the active (GTP-bound) KRAS G12C state, as monotherapy and combined with pembrolizumab or BBO-10203.",
    people: [
      { name: "Saoirse Kavanagh", title: "Head of Biomarker Development", function: "biomarker_development", seniority: "head" },
      { name: "Tobias Reinhardt", title: "Director, Clinical Pharmacology", function: "clinical_development", seniority: "director" },
    ],
  },
  {
    name: "Elicio Therapeutics", realDomain: "elicio.com", type: "biotech", hq: "Boston, US",
    drug: "ELI-002 7P", moa: "Lymph-node-targeted KRAS/NRAS mutant peptide vaccine (AMP)",
    nct: "NCT05726864", trialName: "ELI-002 7P Expansion", condition: "KRAS/NRAS-mutated Pancreatic and Colorectal Cancer (MRD-positive)",
    phase: "phase_1_2", status: "active_not_recruiting", enrollment: 158, biomarker: "ctDNA/MRD positivity + KRAS/NRAS mutation",
    summary: "Amphiphile-vaccine approach targeting seven KRAS/NRAS mutant peptides in ctDNA-positive (MRD+) resected pancreatic and colorectal cancer — a direct fit for longitudinal ctDNA monitoring.",
    people: [
      { name: "Freya Lindholm", title: "VP, Translational Medicine", function: "translational_medicine", seniority: "vp" },
      { name: "Adewale Okoro", title: "Director, MRD & Biomarker Programs", function: "biomarker_development", seniority: "director" },
    ],
  },
  {
    name: "Jiangsu HengRui Medicine", realDomain: null, type: "pharma", hq: "Lianyungang, CN",
    drug: "HRS-4642", moa: "KRAS G12D inhibitor",
    nct: "NCT05533463", trialName: "HRS-4642 Dose Escalation", condition: "KRAS G12D-mutated Advanced Solid Tumors",
    phase: "phase_1", status: "active_not_recruiting", enrollment: 102, biomarker: "KRAS G12D mutation",
    summary: "Dose-escalation study of the oral KRAS G12D inhibitor HRS-4642 in advanced solid tumors — one of the earlier clinical-stage G12D-selective candidates.",
    people: [
      { name: "Mei-Ling Fong", title: "Director, Companion Diagnostics", function: "biomarker_development", seniority: "director" },
      { name: "Ravi Chandrasekaran", title: "Clinical Program Lead", function: "program_leadership", seniority: "head" },
    ],
  },
  {
    name: "Genfleet Therapeutics", realDomain: null, type: "biotech", hq: "Shanghai, CN",
    drug: "GFH375", moa: "KRAS G12D inhibitor",
    nct: "NCT07259590", trialName: "GFH375 Combination Study", condition: "KRAS G12D-mutated Pancreatic and Colorectal Cancer",
    phase: "phase_1_2", status: "recruiting", enrollment: 126, biomarker: "KRAS G12D mutation",
    summary: "Study of GFH375 combined with cetuximab or standard chemotherapy in KRAS G12D-mutated PDAC and CRC — testing rational combination strategies from first-in-human.",
    people: [
      { name: "Solveig Andersen", title: "VP, Biomarker Development", function: "biomarker_development", seniority: "vp" },
      { name: "Émile Fontaine", title: "Director, Clinical Operations", function: "clinical_development", seniority: "director" },
    ],
  },
  {
    name: "Ranok Therapeutics", realDomain: null, type: "biotech", hq: "Hangzhou, CN",
    drug: "RNK08954", moa: "KRAS G12D-directed degrader (Chaperone-Mediated Protein Degradation)",
    nct: "NCT06667544", trialName: "RNK08954 First-in-Human Study", condition: "KRAS G12D-mutated Solid Tumors",
    phase: "phase_1_2", status: "recruiting", enrollment: 152, biomarker: "KRAS G12D mutation",
    summary: "First-in-human study of RNK08954, applying Ranok's chaperone-mediated protein degradation platform to KRAS G12D — a degrader rather than an inhibitor approach.",
    people: [
      { name: "Petra Vandenberg", title: "Head of Translational Medicine", function: "translational_medicine", seniority: "head" },
      { name: "Kwame Asante", title: "Director, Biomarker Strategy", function: "biomarker_development", seniority: "director" },
    ],
  },
  {
    name: "Astellas Pharma", realDomain: "astellas.com", type: "pharma", hq: "Tokyo, JP",
    drug: "Setidegrasib", moa: "KRAS G12D inhibitor",
    nct: "NCT07409272", trialName: "Setidegrasib + NALIRIFOX/mFOLFIRINOX", condition: "KRAS G12D-mutated Metastatic Pancreatic Ductal Adenocarcinoma",
    phase: "phase_3", status: "recruiting", enrollment: 400, biomarker: "KRAS G12D mutation",
    summary: "Front-line Phase 3 study adding setidegrasib to standard multi-agent chemotherapy (mFOLFIRINOX/NALIRIFOX) in KRAS G12D-mutated metastatic PDAC — a large, biomarker-gated registrational trial.",
    people: [
      { name: "Ingrid Solberg", title: "Senior Director, Companion Diagnostics", function: "biomarker_development", seniority: "director" },
      { name: "Diego Fernández", title: "Clinical Program Lead, GI Oncology", function: "program_leadership", seniority: "head" },
    ],
  },
  {
    name: "HUYABIO International", realDomain: "huyabio.com", type: "biotech", hq: "San Diego, US",
    drug: "HBI-2438", moa: "SHP2 inhibitor",
    nct: "NCT05163028", trialName: "SHP2 Inhibitor Dose Escalation", condition: "RAS/MAPK-pathway Solid Tumors (NSCLC, CRC, Pancreatic)",
    phase: "phase_1", status: "active_not_recruiting", enrollment: 42, biomarker: "RAS/MAPK pathway alteration",
    summary: "Dose escalation of an SHP2 inhibitor across RAS/MAPK-pathway-altered solid tumors — SHP2 sits upstream of RAS and is frequently paired with a direct RAS inhibitor to blunt resistance.",
    people: [
      { name: "Léa Moreau", title: "Director, Translational Science", function: "translational_medicine", seniority: "director" },
      { name: "Tunde Bakare", title: "VP, Clinical Development", function: "clinical_development", seniority: "vp" },
    ],
  },
  {
    name: "Erasca", realDomain: "erasca.com", type: "biotech", hq: "San Diego, US", ticker: "ERAS",
    drug: "Naporafenib (ERAS-254) + trametinib", moa: "Pan-RAF inhibitor + MEK inhibitor combination",
    nct: "NCT06346067", trialName: "Naporafenib + Trametinib Registrational Study", condition: "NRAS-mutant Melanoma",
    phase: "phase_3", status: "active_not_recruiting", enrollment: 78, biomarker: "NRAS mutation",
    summary: "Registrational study of naporafenib plus trametinib versus physician's choice in NRAS-mutant melanoma — a RAS/MAPK-pathway combination outside the more crowded KRAS G12C space.",
    people: [
      { name: "Rosalind Achebe", title: "VP, Precision Medicine", function: "precision_medicine", seniority: "vp" },
      { name: "Sven Kallio", title: "Director, Biomarker Operations", function: "biomarker_development", seniority: "director" },
    ],
  },
  {
    name: "Guangzhou JOYO Pharma", realDomain: null, type: "biotech", hq: "Guangzhou, CN",
    drug: "JYP0015", moa: "Pan-RAS inhibitor",
    nct: "NCT06895031", trialName: "JYP0015 First-in-Human Study", condition: "RAS-mutated Solid Tumors (PDAC, NSCLC, CRC)",
    phase: "phase_1_2", status: "recruiting", enrollment: 210, biomarker: "RAS mutation (broad panel)",
    summary: "First-in-human study of the pan-RAS inhibitor JYP0015 across pancreatic, lung and colorectal cancers — a newer entrant to the multi-selective RAS(ON)-class field.",
    people: [
      { name: "Camille Dupont", title: "Director, Biomarker Development", function: "biomarker_development", seniority: "director" },
      { name: "Hassan Malik", title: "Clinical Program Lead", function: "program_leadership", seniority: "head" },
    ],
  },
  {
    name: "Blueprint Medicines", realDomain: "blueprintmedicines.com", type: "biotech", hq: "Cambridge, US", ticker: "BPMC",
    drug: "BLU-924 (SAR449336)", moa: "Pan-RAS(ON) inhibitor (co-developed with Sanofi)",
    nct: "NCT07629960", trialName: "BLU-924 First-in-Human Study", condition: "RAS-mutated Solid Tumors (Pancreatic, NSCLC, CRC)",
    phase: "phase_1_2", status: "recruiting", enrollment: 265, biomarker: "RAS mutation (broad panel)",
    summary: "First-in-human study of BLU-924, a pan-RAS(ON) inhibitor co-developed with Sanofi, in advanced pancreatic, lung, and colorectal cancers.",
    people: [
      { name: "Anouk Willemsen", title: "VP, Translational Medicine", function: "translational_medicine", seniority: "vp" },
      { name: "Desmond O'Farrell", title: "Director, Companion Diagnostics", function: "biomarker_development", seniority: "director" },
    ],
  },
  {
    name: "Kura Oncology", realDomain: "kuraoncology.com", type: "biotech", hq: "San Diego, US", ticker: "KURA",
    drug: "KO-2806", moa: "Next-generation farnesyltransferase inhibitor (RAS pathway combination agent)",
    nct: "NCT06026410", trialName: "KO-2806 Combination Study", condition: "Solid Tumors with RAS Pathway Alterations (HRAS, KRAS, NRAS)",
    phase: "phase_1", status: "recruiting", enrollment: 300, biomarker: "HRAS, KRAS, or NRAS alteration",
    summary: "Monotherapy and combination study of the farnesyltransferase inhibitor KO-2806 across tumors with HRAS, KRAS or NRAS alterations, designed to pair with direct RAS/MEK inhibitors.",
    people: [
      { name: "Beatrix Halvorsen", title: "Head of Biomarker Strategy", function: "biomarker_development", seniority: "head" },
      { name: "Idris Yamamoto", title: "Director, Clinical Development", function: "clinical_development", seniority: "director" },
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
    .values({ name: "Predicine", slug: DEMO_TENANT_SLUG, domain: "predicine.com", website: "https://www.predicine.com" })
    .returning();

  const [user] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: DEMO_USER_EMAIL,
      name: "Myles Walsh",
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
      { id: "p2", text: "Companion diagnostics for KRAS G12C / KRAS G12D / pan-RAS programs", paused: false, order: 1 },
      { id: "p3", text: "Central lab and longitudinal biomarker support for Phase 2/3 registrational trials", paused: false, order: 2 },
    ],
    therapeuticAreas: ["Non-Small Cell Lung Cancer", "Metastatic Colorectal Cancer", "Pancreatic Ductal Adenocarcinoma", "Melanoma"],
    biomarkers: ["KRAS", "KRAS G12C", "KRAS G12D", "NRAS", "HRAS", "SOS1", "SHP2"],
    pathways: ["RAS/MAPK"],
    homeRange: "7d",
    onboardedAt: new Date(),
  });

  await db.insert(capabilityProfiles).values({
    tenantId: tenant.id,
    companyName: "Predicine",
    website: "https://www.predicine.com",
    description:
      "Liquid biopsy and tissue genomic profiling for oncology drug development: ctDNA/cfDNA MRD detection, patient selection, longitudinal resistance monitoring, companion diagnostic co-development, and central lab services — with deep coverage of the RAS/MAPK pathway.",
    testingModalities: ["ctDNA", "cfDNA", "tissue NGS", "WES", "WTS"],
    sampleTypes: ["plasma", "urine", "tumor tissue"],
    technologies: ["NGS", "ctDNA", "methylation"],
    cancerTypes: ["Non-Small Cell Lung Cancer", "Metastatic Colorectal Cancer", "Pancreatic Ductal Adenocarcinoma", "Melanoma", "Solid Tumor"],
    capabilityFlags: { ctdna: true, cfdna: true, liquid_biopsy: true, mrd: true, ngs: true, patient_selection: true, cdx: true, resistance_monitoring: true, central_lab: true },
    mustPursue: ["KRAS", "pan-RAS", "MRD", "longitudinal monitoring", "companion diagnostics"],
    desirable: ["central lab", "biomarker-defined enrollment", "registrational trial support"],
    targetIndications: ["Non-Small Cell Lung Cancer", "Metastatic Colorectal Cancer", "Pancreatic Ductal Adenocarcinoma", "Melanoma"],
    targetPathways: ["RAS/MAPK"],
    targetAccountTypes: ["pharma", "biotech"],
    trialStagesOfInterest: ["phase_1", "phase_1_2", "phase_2", "phase_2_3", "phase_3"],
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
    { name: "Yusuf Karimov", title: "Associate Director, Clinical Pharmacology", function: "clinical_development" as Fn, seniority: "senior_manager" as Sen },
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
        website: org.realDomain ? `https://www.${org.realDomain}` : null,
        headquarters: org.hq,
        ticker: org.ticker,
        isPublic: Boolean(org.ticker),
        description: `${org.name}'s lead RAS/KRAS program: ${org.drug} (${org.moa}).`,
        accountTier: i < 6 ? "strategic" : i < 14 ? "priority" : "standard",
        accountScore: Math.max(40, 92 - i * 3),
        oncologyFocus: true,
        lastVerifiedAt: days(1 + (i % 4)),
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
        enrollment: org.enrollment,
        enrollmentType: "estimated",
        conditionsRaw: [org.condition],
        interventionsRaw: [{ type: "Drug", name: org.drug }],
        eligibilityText: `Adults with histologically confirmed ${org.condition.toLowerCase()} and centrally or locally confirmed ${org.biomarker}. ECOG 0-1. Measurable disease per RECIST 1.1. Prior standard-of-care therapy per protocol-specific line-of-therapy requirements.`,
        primaryEndpoints: org.phase === "phase_3" ? ["Overall Survival", "Progression-Free Survival"] : ["Objective Response Rate", "Safety and tolerability (DLTs)"],
        secondaryEndpoints: ["Duration of Response", "Disease Control Rate", "Pharmacokinetics"],
        molecularEligibility: true,
        biomarkerRequirements: [org.biomarker],
        ctdnaMentions: i % 2 === 0,
        mrdMentions: org.condition.includes("MRD") || i === 10,
        ngsMentions: true,
        commercialSummary: `${org.summary} (${org.nct}, ${org.status.replace(/_/g, " ")}, ${org.enrollment} participants.)`,
        recordVersionHash: `demo-real-${i}-v1`,
        lastCtgovUpdate: days(2 + i),
        firstPostedDate: days(180 + i * 25),
        lastRefreshedAt: days(1),
      })
      .returning();

    // Fictional people's "found on this page" evidence links use the fake
    // domain too — a made-up bio page must never look like it lives on the
    // real company's real website.
    const fakeUrl = `https://www.${fakeEmailDomain(org.name)}`;
    const teamUrl = `${fakeUrl}/leadership`;
    const pipelineUrl = `${fakeUrl}/pipeline`;

    // ── Three signals per company — a trial event, a data/scientific event,
    // and a corporate/pipeline event — with richer, program-specific copy. ──
    await db.insert(commercialSignals).values({
      tenantId: tenant.id,
      signalType: "NEW_BIOMARKER_REQUIREMENT",
      category: "clinical_trial",
      organizationId: orgRow.id,
      trialId: trialRow.id,
      headline: `${org.name} — ${org.trialName} (${org.nct}) requires ${org.biomarker} for enrollment`,
      factSummary: `${org.nct} (${org.drug}, ${org.status.replace(/_/g, " ")}, ${org.enrollment} participants) requires centrally or locally confirmed ${org.biomarker} for enrollment in ${org.condition}. Source: ClinicalTrials.gov.`,
      scientificInterpretation: `Consistent with ${org.moa} — reliable, sensitive ${org.biomarker.toLowerCase()} detection (tissue and/or plasma) is a gating step for screening.`,
      commercialInterpretation: "Opens a near-term companion diagnostics / patient-selection testing need, and a longitudinal monitoring opportunity if the program advances.",
      whyItMatters: `A molecular eligibility requirement on a real, currently ${org.status.replace(/_/g, " ")} trial is a concrete, dated testing need — not a hypothetical one.`,
      whyNow: `${org.nct} is currently ${org.status.replace(/_/g, " ")} with an estimated ${org.enrollment} participants — screening volume is live now.`,
      recommendedAction: `Reach out to ${org.name}'s translational/biomarker team about central-lab or companion-assay support for ${org.biomarker.toLowerCase()} detection.`,
      recommendedPersonas: ["biomarker_development", "translational_medicine", "clinical_development"],
      urgency: i < 6 ? "high" : i < 14 ? "medium" : "low",
      opportunityScore: Math.max(35, 93 - i * 3),
      confidenceScore: 80 + (i % 10),
      scoreBreakdown: { commercialFit: 22, clinicalTiming: 18, biomarkerNeed: 19, relationshipAccessibility: 7, signalStrength: 9, accountStrategicValue: 8, urgency: 4 },
      dedupeKey: `demo-signal-${i}-biomarker`,
      status: "new",
      detectedAt: days(i % 7),
      sourceDate: days(i % 7),
    }).onConflictDoNothing();

    await db.insert(commercialSignals).values({
      tenantId: tenant.id,
      signalType: "NEW_DATA_READOUT",
      category: "publication",
      organizationId: orgRow.id,
      trialId: trialRow.id,
      headline: `${org.name} shares ${org.trialName} translational data`,
      factSummary: `${org.name} presented preliminary translational/biomarker data for ${org.drug} (${org.moa}) at a recent oncology conference, ahead of ${org.trialName}'s next readout.`,
      scientificInterpretation: `Early translational signal for ${org.drug} in ${org.condition.toLowerCase()} — consistent with the mechanism of action.`,
      whyItMatters: "New translational data readouts often precede an expansion of biomarker/monitoring scope, or a new combination arm.",
      whyNow: "Recently presented — the team is likely still assembling supporting testing partners for the next stage.",
      recommendedPersonas: ["translational_medicine", "program_leadership"],
      urgency: "medium",
      opportunityScore: Math.max(30, 74 - i * 2),
      confidenceScore: 62 + (i % 8),
      dedupeKey: `demo-signal-${i}-readout`,
      status: i % 5 === 3 ? "reviewed" : "new",
      detectedAt: days((i % 7) + 1),
      sourceDate: days((i % 7) + 1),
    }).onConflictDoNothing();

    await db.insert(commercialSignals).values({
      tenantId: tenant.id,
      signalType: "PIPELINE_PRIORITIZATION",
      category: "corporate",
      organizationId: orgRow.id,
      trialId: trialRow.id,
      headline: `${org.name} advances ${org.drug} as a pipeline priority`,
      factSummary: `${org.name}'s ${org.drug} program (${org.trialName}, ${org.nct}) remains an active clinical priority in ${org.condition.toLowerCase()}.`,
      commercialInterpretation: "Sustained pipeline priority signals durable budget for external testing partnerships tied to this program.",
      whyItMatters: "Programs that stay prioritized through Phase 2/3 typically expand their testing and monitoring footprint rather than shrink it.",
      recommendedPersonas: ["business_development", "program_leadership"],
      urgency: i < 8 ? "medium" : "low",
      opportunityScore: Math.max(25, 60 - i),
      confidenceScore: 55,
      dedupeKey: `demo-signal-${i}-pipeline`,
      status: "new",
      detectedAt: days((i % 7) + 2),
      sourceDate: days((i % 7) + 2),
    }).onConflictDoNothing();

    // ── People + relationships + evidence-backed contact info ──────────────
    for (const [pi, p] of org.people.entries()) {
      const slug = p.name.toLowerCase().replace(/[^a-z]+/g, "-");
      const [first, ...rest] = p.name.split(" ");
      const emailAddr = `${first.toLowerCase()}.${rest[rest.length - 1].toLowerCase()}@${fakeEmailDomain(org.name)}`;
      const profileUrl = `${teamUrl}/${slug}`;
      const secondUrl = `${pipelineUrl}/${org.drug.split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "")}`;

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
          description: `${p.title} at ${org.name}, responsible for ${p.function === "biomarker_development" ? "biomarker strategy and companion diagnostics" : p.function === "translational_medicine" ? "translational science" : p.function === "clinical_development" ? "clinical development" : p.function === "precision_medicine" ? "precision medicine strategy" : p.function === "program_leadership" ? "program leadership" : "external partnerships"} for ${org.drug} (${org.trialName}).`,
          whyThisPerson: `${p.title} is a function fit for ${org.trialName} (${org.nct}, ${org.status.replace(/_/g, " ")}) — this role typically owns ${org.biomarker.toLowerCase()} testing strategy and central-lab/companion-assay vendor decisions for a program at this stage.`,
          whyNow: `${org.trialName} (${org.nct}) currently requires ${org.biomarker} for enrollment — an active, dated testing need.`,
          contactLabel: pi === 0 ? "direct_program_evidence" : "relevant_function_unconfirmed",
          relevanceScore: Math.max(35, 90 - pi * 12 - (i % 6) * 3),
          relevanceBreakdown: { functionFit: 34 - pi * 5, programEvidence: pi === 0 ? 26 : 11, useCaseFit: 15, decisionScope: 10, evidenceQuality: 9 },
          relatedTrialId: trialRow.id,
          useCase: `${org.biomarker} — ctDNA / MRD monitoring fit`,
          email: emailAddr,
          emailProvenance: "inferred_pattern",
          emailPattern: "first.last",
          sourceEvidence: [
            ev("company_page", profileUrl, `${p.name} — ${p.title} at ${org.name}.`),
            ev("trial_record", secondUrl, `${org.trialName} (${org.nct}) pipeline page referencing ${org.drug} and the ${p.function.replace(/_/g, " ")} team.`),
          ],
          lastVerifiedAt: days(1 + (i % 4)),
        })
        .returning();
      savedPeopleIds.push(personRow.id);

      const outreachStatuses = ["new", "contacted", "follow_up_due", "replied", "meeting_scheduled"] as const;
      const status = outreachStatuses[(i + pi) % outreachStatuses.length];
      const [rel] = await db
        .insert(relationships)
        .values({
          tenantId: tenant.id,
          personId: personRow.id,
          organizationId: orgRow.id,
          ownerUserId: user.id,
          outreachStatus: status,
          favorite: pi === 0 && i < 5,
          firstContactedAt: status === "new" ? null : days(14),
          lastContactedAt: status === "new" ? null : days(4 + (i % 5)),
          lastResponseAt: status === "replied" || status === "meeting_scheduled" ? days(2 + (i % 3)) : null,
          nextFollowUpAt: status === "follow_up_due" ? inDays(3 + (i % 4)) : status === "meeting_scheduled" ? inDays(7) : null,
        })
        .returning();

      if (status !== "new") {
        await db.insert(interactions).values({
          tenantId: tenant.id,
          type: "email_sent",
          userId: user.id,
          personId: personRow.id,
          organizationId: orgRow.id,
          subject: `Introduction — Predicine <> ${org.name}`,
          body: `Hi ${first},\n\nI wanted to reach out given your work as ${p.title} at ${org.name}. Predicine supports ctDNA/MRD testing for ${org.biomarker.toLowerCase()}-selected programs like ${org.trialName}, and I'd welcome a short call to see if there's a fit for central-lab or companion-assay support.\n\nBest,\nMyles`,
          outcome: "Sent, awaiting reply",
          crmSyncStatus: "not_synced",
          occurredAt: days(14),
        });
      }
      if (status === "replied" || status === "meeting_scheduled") {
        await db.insert(interactions).values({
          tenantId: tenant.id,
          type: "email_received",
          userId: user.id,
          personId: personRow.id,
          organizationId: orgRow.id,
          subject: `Re: Introduction — Predicine <> ${org.name}`,
          body: status === "meeting_scheduled"
            ? `Thanks for reaching out — this is timely given where ${org.trialName} is headed. Can we set up a call next week to discuss central-lab support?`
            : `Thanks for reaching out, this looks relevant to our ${org.biomarker.toLowerCase()} testing plans for ${org.trialName}. Let me loop in our biomarker team.`,
          outcome: status === "meeting_scheduled" ? "Positive reply — meeting scheduled" : "Positive reply — reviewing internally",
          crmSyncStatus: "not_synced",
          occurredAt: days(2 + (i % 3)),
        });
      }
      if (status === "meeting_scheduled") {
        await db.insert(interactions).values({
          tenantId: tenant.id,
          type: "meeting",
          userId: user.id,
          personId: personRow.id,
          organizationId: orgRow.id,
          subject: `Call — Predicine <> ${org.name} biomarker support`,
          body: `Discussed ${org.trialName}'s ${org.biomarker.toLowerCase()} testing requirements and Predicine's central-lab / companion-assay capabilities.`,
          outcome: "Scheduled a follow-up to discuss scope and timeline",
          nextStep: "Send capability deck and sample SOW",
          crmSyncStatus: "not_synced",
          occurredAt: inDays(-1),
        });
      }
      if (status === "follow_up_due" || status === "meeting_scheduled") {
        await db.insert(tasks).values({
          tenantId: tenant.id,
          userId: user.id,
          title: `Follow up with ${p.name} (${org.name})`,
          category: "follow_up",
          notes: `Check back on the ${org.biomarker.toLowerCase()} eligibility requirement discussion for ${org.trialName}.`,
          dueAt: status === "meeting_scheduled" ? inDays(7) : inDays(3 + (i % 4)),
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
      description: `${extra.title} at ${org.name}, named on the ${org.trialName} pipeline page.`,
      whyThisPerson: `Function fit for ${org.trialName} (${org.nct}) on ${org.name}'s pipeline page — ${extra.title.toLowerCase()} roles typically support ${org.biomarker.toLowerCase()} testing decisions.`,
      relatedTrialId: trialRow.id,
      useCase: `${org.biomarker} — ctDNA / MRD monitoring fit`,
      contactLabel: "relevant_function_unconfirmed",
      relevanceScore: Math.max(30, 73 - (i % 8) * 3),
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
      subject: "Introduction — Predicine <> Revolution Medicines",
      body:
        "Hi Renata,\n\nI wanted to reach out given your work in translational medicine at Revolution Medicines. " +
        "Predicine supports ctDNA/MRD monitoring programs for pan-RAS(ON) inhibitors like daraxonrasib, and I'd welcome a short call to see if there's a fit for RASolve 301's testing needs.\n\nBest,\nMyles",
      status: "draft",
      generatedBy: "user",
    });
  }

  await db.insert(watchlists).values({
    tenantId: tenant.id,
    name: "RAS / KRAS biomarker-defined programs",
    description: "Companies running biomarker-eligible RAS/KRAS trials relevant to Predicine's testing menu.",
    ownerUserId: user.id,
    minOpportunityScore: 55,
  }).returning().then(async ([wl]) => {
    if (!wl) return;
    await db.insert(watchlistItems).values([
      { watchlistId: wl.id, entityKind: "keyword" as const, label: "KRAS G12C" },
      { watchlistId: wl.id, entityKind: "keyword" as const, label: "KRAS G12D" },
      { watchlistId: wl.id, entityKind: "keyword" as const, label: "pan-RAS" },
      { watchlistId: wl.id, entityKind: "keyword" as const, label: "SOS1" },
      { watchlistId: wl.id, entityKind: "keyword" as const, label: "MRD" },
      { watchlistId: wl.id, entityKind: "indication" as const, label: "NSCLC" },
      { watchlistId: wl.id, entityKind: "indication" as const, label: "Pancreatic Ductal Adenocarcinoma" },
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
