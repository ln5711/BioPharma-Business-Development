import { createHash } from "node:crypto";
import { canonicalJson } from "@/lib/utils";
import {
  detectTrialSignalFlags,
  extractBiomarkerRequirements,
} from "@/lib/oncology/keywords";
import {
  mapPhase,
  mapStatus,
  parseCtgovDate,
} from "@/lib/oncology/normalize-terms";
import type { CtgovStudy } from "./types";

export interface NormalizedTrial {
  nctId: string;
  title: string | null;
  officialTitle: string | null;
  sponsorName: string | null;
  collaborators: string[];
  phase: string;
  status: string;
  studyType: string | null;
  enrollment: number | null;
  enrollmentType: string | null;
  whyStopped: string | null;
  conditionsRaw: string[];
  interventionsRaw: { type: string; name: string }[];
  armsRaw: { label: string; type?: string; description?: string }[];
  countries: string[];
  locationCount: number;
  locationsRaw: {
    facility?: string;
    city?: string;
    state?: string;
    country?: string;
    status?: string;
  }[];
  eligibilityText: string | null;
  primaryEndpoints: string[];
  secondaryEndpoints: string[];
  exploratoryEndpoints: string[];
  startDate: Date | null;
  primaryCompletionDate: Date | null;
  completionDate: Date | null;
  lastCtgovUpdate: Date | null;
  molecularEligibility: boolean;
  biomarkerRequirements: string[];
  ctdnaMentions: boolean;
  mrdMentions: boolean;
  ngsMentions: boolean;
  resistanceMonitoringMentions: boolean;
  centralLabMentions: boolean;
  serialSamplingMentions: boolean;
  biospecimenRetention: string | null;
  commercialSummary: string;
  recordVersionHash: string;
}

const outcomeMeasures = (
  list: { measure?: string }[] | undefined,
): string[] => (list ?? []).map((o) => o.measure ?? "").filter(Boolean);

export function normalizeStudy(study: CtgovStudy): NormalizedTrial {
  const p = study.protocolSection ?? {};
  const id = p.identificationModule ?? {};
  const status = p.statusModule ?? {};
  const sponsor = p.sponsorCollaboratorsModule ?? {};
  const design = p.designModule ?? {};
  const arms = p.armsInterventionsModule ?? {};
  const outcomes = p.outcomesModule ?? {};
  const elig = p.eligibilityModule ?? {};
  const locations = p.contactsLocationsModule?.locations ?? [];
  const desc = p.descriptionModule ?? {};

  const eligibilityText = elig.eligibilityCriteria ?? null;
  const primaryEndpoints = outcomeMeasures(outcomes.primaryOutcomes);
  const secondaryEndpoints = outcomeMeasures(outcomes.secondaryOutcomes);
  const exploratoryEndpoints = outcomeMeasures(outcomes.otherOutcomes);

  const flagText = [
    eligibilityText,
    desc.briefSummary,
    desc.detailedDescription,
    ...primaryEndpoints,
    ...secondaryEndpoints,
    ...exploratoryEndpoints,
    design.bioSpec?.description,
    ...(arms.interventions ?? []).map((i) => `${i.name ?? ""} ${i.description ?? ""}`),
  ]
    .filter(Boolean)
    .join("\n\n");

  const flags = detectTrialSignalFlags(flagText);

  const countries = [
    ...new Set(locations.map((l) => l.country).filter((c): c is string => !!c)),
  ];

  const normalized: Omit<NormalizedTrial, "recordVersionHash" | "commercialSummary"> = {
    nctId: id.nctId ?? "",
    title: id.briefTitle ?? null,
    officialTitle: id.officialTitle ?? null,
    sponsorName: sponsor.leadSponsor?.name ?? null,
    collaborators: (sponsor.collaborators ?? [])
      .map((c) => c.name ?? "")
      .filter(Boolean),
    phase: mapPhase(design.phases),
    status: mapStatus(status.overallStatus),
    studyType: design.studyType ?? null,
    enrollment: design.enrollmentInfo?.count ?? null,
    enrollmentType: design.enrollmentInfo?.type ?? null,
    whyStopped: status.whyStopped ?? null,
    conditionsRaw: p.conditionsModule?.conditions ?? [],
    interventionsRaw: (arms.interventions ?? []).map((i) => ({
      type: i.type ?? "OTHER",
      name: i.name ?? "",
    })),
    armsRaw: (arms.armGroups ?? []).map((a) => ({
      label: a.label ?? "",
      type: a.type,
      description: a.description,
    })),
    countries,
    locationCount: locations.length,
    locationsRaw: locations.slice(0, 200).map((l) => ({
      facility: l.facility,
      city: l.city,
      state: l.state,
      country: l.country,
      status: l.status,
    })),
    eligibilityText,
    primaryEndpoints,
    secondaryEndpoints,
    exploratoryEndpoints,
    startDate: parseCtgovDate(status.startDateStruct?.date),
    primaryCompletionDate: parseCtgovDate(status.primaryCompletionDateStruct?.date),
    completionDate: parseCtgovDate(status.completionDateStruct?.date),
    lastCtgovUpdate: parseCtgovDate(status.lastUpdatePostDateStruct?.date),
    molecularEligibility: flags.molecularEligibility,
    biomarkerRequirements: extractBiomarkerRequirements(eligibilityText),
    ctdnaMentions: flags.ctdna,
    mrdMentions: flags.mrd,
    ngsMentions: flags.ngs,
    resistanceMonitoringMentions: flags.resistanceMonitoring,
    centralLabMentions: flags.centralLab,
    serialSamplingMentions: flags.serialSampling,
    biospecimenRetention: design.bioSpec?.retention ?? null,
  };

  return {
    ...normalized,
    commercialSummary: buildCommercialSummary(normalized, flags),
    recordVersionHash: hashRecord(normalized),
  };
}

function buildCommercialSummary(
  t: Omit<NormalizedTrial, "recordVersionHash" | "commercialSummary">,
  flags: ReturnType<typeof detectTrialSignalFlags>,
): string {
  const bits: string[] = [];
  if (t.molecularEligibility) bits.push("molecular eligibility required");
  if (flags.ctdna) bits.push("ctDNA / liquid biopsy referenced");
  if (flags.mrd) bits.push("MRD endpoint language");
  if (flags.serialSampling) bits.push("serial specimen collection");
  if (flags.resistanceMonitoring) bits.push("resistance-monitoring language");
  if (flags.ngs) bits.push("NGS / genomic profiling referenced");
  if (flags.centralLab) bits.push("central lab testing referenced");
  if (!bits.length) return "No explicit biomarker / molecular-testing language identified in the public record.";
  return `Trial record references ${bits.join(", ")}.`;
}

/**
 * `record_version_hash` (spec §4). A stable SHA-256 over the commercially
 * meaningful fields — cosmetic upstream churn (formatting, contact reshuffles)
 * does not change it, so refreshes are idempotent (acceptance test §105).
 */
function hashRecord(
  t: Omit<NormalizedTrial, "recordVersionHash" | "commercialSummary">,
): string {
  const material = {
    status: t.status,
    phase: t.phase,
    enrollment: t.enrollment,
    conditions: [...t.conditionsRaw].sort(),
    interventions: t.interventionsRaw.map((i) => `${i.type}:${i.name}`).sort(),
    arms: t.armsRaw.map((a) => a.label).sort(),
    countries: [...t.countries].sort(),
    primaryEndpoints: [...t.primaryEndpoints].sort(),
    secondaryEndpoints: [...t.secondaryEndpoints].sort(),
    exploratoryEndpoints: [...t.exploratoryEndpoints].sort(),
    primaryCompletionDate: t.primaryCompletionDate?.toISOString() ?? null,
    completionDate: t.completionDate?.toISOString() ?? null,
    sponsor: t.sponsorName,
    collaborators: [...t.collaborators].sort(),
    molecularEligibility: t.molecularEligibility,
    ctdna: t.ctdnaMentions,
    mrd: t.mrdMentions,
    resistance: t.resistanceMonitoringMentions,
  };
  return createHash("sha256").update(canonicalJson(material)).digest("hex");
}
