/**
 * Signal taxonomy metadata (spec §14). Maps every signal type to its display
 * category (spec §135), a default urgency, and the buyer personas most likely
 * to own the resulting decision (spec §18).
 */
export type SignalCategory =
  | "clinical_trial"
  | "publication"
  | "regulatory"
  | "corporate"
  | "leadership"
  | "conference"
  | "partnership"
  | "relationship"
  | "crm";

export type Urgency = "low" | "medium" | "high" | "critical";

export interface SignalTypeMeta {
  category: SignalCategory;
  urgency: Urgency;
  /** Persona functions (buyer_function enum values) ranked most→least relevant. */
  personas: string[];
  /** Short label for UI. */
  label: string;
}

const TM = "translational_medicine";
const PM = "precision_medicine";
const BM = "biomarker_development";
const CDX = "companion_diagnostics";
const CD = "clinical_development";
const CO = "clinical_operations";
const BD = "business_development";
const EI = "external_innovation";
const EXEC = "executive";

export const SIGNAL_TAXONOMY: Record<string, SignalTypeMeta> = {
  NEW_TRIAL: { category: "clinical_trial", urgency: "high", personas: [CD, TM, CO, PM], label: "New trial" },
  TRIAL_PHASE_CHANGE: { category: "clinical_trial", urgency: "high", personas: [TM, CD, PM], label: "Phase change" },
  TRIAL_STATUS_CHANGE: { category: "clinical_trial", urgency: "medium", personas: [CD, CO], label: "Status change" },
  TRIAL_ENROLLMENT_CHANGE: { category: "clinical_trial", urgency: "medium", personas: [CO, CD], label: "Enrollment change" },
  NEW_TRIAL_COHORT: { category: "clinical_trial", urgency: "high", personas: [TM, CD, BM], label: "New cohort" },
  NEW_COMBINATION_ARM: { category: "clinical_trial", urgency: "high", personas: [CD, TM], label: "New combination arm" },
  NEW_INDICATION: { category: "clinical_trial", urgency: "high", personas: [CD, PM, BD], label: "New indication" },
  NEW_BIOMARKER_REQUIREMENT: { category: "clinical_trial", urgency: "high", personas: [PM, CDX, BM, TM], label: "New biomarker requirement" },
  NEW_CT_DNA_ENDPOINT: { category: "clinical_trial", urgency: "high", personas: [TM, BM, PM], label: "New ctDNA endpoint" },
  NEW_MRD_ENDPOINT: { category: "clinical_trial", urgency: "high", personas: [TM, BM, PM], label: "New MRD endpoint" },
  NEW_RESISTANCE_ENDPOINT: { category: "clinical_trial", urgency: "high", personas: [TM, BM], label: "New resistance endpoint" },
  NEW_TRANSLATIONAL_ENDPOINT: { category: "clinical_trial", urgency: "medium", personas: [TM, BM], label: "New translational endpoint" },
  NEW_TRIAL_SITE: { category: "clinical_trial", urgency: "low", personas: [CO], label: "New trial site" },
  TRIAL_EXPANSION: { category: "clinical_trial", urgency: "high", personas: [TM, CD, CO, PM], label: "Trial expansion" },
  TRIAL_TERMINATION: { category: "clinical_trial", urgency: "medium", personas: [CD], label: "Trial terminated" },
  CLINICAL_HOLD: { category: "regulatory", urgency: "medium", personas: [CD], label: "Clinical hold / suspension" },
  NEW_PUBLICATION: { category: "publication", urgency: "medium", personas: [TM, BM], label: "New publication" },
  NEW_PREPRINT: { category: "publication", urgency: "low", personas: [TM, BM], label: "New preprint" },
  NEW_CONFERENCE_ABSTRACT: { category: "conference", urgency: "high", personas: [TM, BM, BD], label: "Conference abstract" },
  NEW_DATA_READOUT: { category: "publication", urgency: "high", personas: [TM, CD, BD], label: "Data readout" },
  POSITIVE_DATA: { category: "publication", urgency: "high", personas: [BD, TM, CD], label: "Positive data" },
  NEGATIVE_DATA: { category: "publication", urgency: "low", personas: [CD], label: "Negative data" },
  NEW_ASSET: { category: "corporate", urgency: "medium", personas: [BD, EI, CD], label: "New asset" },
  ASSET_DISCONTINUED: { category: "corporate", urgency: "low", personas: [BD], label: "Asset discontinued" },
  PIPELINE_PRIORITIZATION: { category: "corporate", urgency: "medium", personas: [BD, EI], label: "Pipeline prioritization" },
  LICENSING_DEAL: { category: "partnership", urgency: "high", personas: [BD, EI], label: "Licensing deal" },
  PARTNERSHIP: { category: "partnership", urgency: "high", personas: [BD, EI, "alliance_management"], label: "Partnership" },
  DIAGNOSTIC_PARTNERSHIP: { category: "partnership", urgency: "high", personas: [PM, CDX, BD], label: "Diagnostic partnership" },
  M_AND_A: { category: "corporate", urgency: "high", personas: [BD, EXEC], label: "M&A" },
  FINANCING: { category: "corporate", urgency: "medium", personas: [BD, EXEC], label: "Financing" },
  FDA_SUBMISSION: { category: "regulatory", urgency: "high", personas: [PM, CDX, "medical_affairs"], label: "FDA submission" },
  FDA_ACCEPTANCE: { category: "regulatory", urgency: "high", personas: [PM, CDX], label: "FDA acceptance" },
  FDA_APPROVAL: { category: "regulatory", urgency: "high", personas: [PM, CDX, "medical_affairs"], label: "FDA approval" },
  LABEL_EXPANSION: { category: "regulatory", urgency: "medium", personas: [PM, "medical_affairs"], label: "Label expansion" },
  REGULATORY_SETBACK: { category: "regulatory", urgency: "low", personas: [CD], label: "Regulatory setback" },
  NEW_EXECUTIVE: { category: "leadership", urgency: "medium", personas: [EXEC, BD], label: "New executive" },
  EXECUTIVE_DEPARTURE: { category: "leadership", urgency: "low", personas: [BD], label: "Executive departure" },
  RESTRUCTURING: { category: "corporate", urgency: "low", personas: [BD], label: "Restructuring" },
  NEW_JOB_POSTING: { category: "corporate", urgency: "low", personas: [TM, BM], label: "New job posting" },
  CRM_RELATIONSHIP_STALE: { category: "relationship", urgency: "medium", personas: [BD], label: "Relationship stale" },
  CONTACT_JOB_CHANGE: { category: "relationship", urgency: "medium", personas: [BD], label: "Contact job change" },
  CONTACT_RESPONDED: { category: "crm", urgency: "high", personas: [BD], label: "Contact responded" },
  CONTACT_NO_RESPONSE: { category: "crm", urgency: "low", personas: [BD], label: "No response" },
  MEETING_REQUIRED: { category: "crm", urgency: "high", personas: [BD], label: "Meeting required" },
  CONFERENCE_OPPORTUNITY: { category: "conference", urgency: "high", personas: [BD, TM], label: "Conference opportunity" },
};

export function signalMeta(type: string): SignalTypeMeta {
  return (
    SIGNAL_TAXONOMY[type] ?? {
      category: "corporate",
      urgency: "medium",
      personas: [BD],
      label: type,
    }
  );
}

/** Signal types that must NOT drive standard outbound sales outreach (spec §46 / §109). */
export const SUPPRESSED_OUTREACH_SIGNALS = new Set([
  "TRIAL_TERMINATION",
  "CLINICAL_HOLD",
  "ASSET_DISCONTINUED",
  "NEGATIVE_DATA",
  "REGULATORY_SETBACK",
  "EXECUTIVE_DEPARTURE",
  "RESTRUCTURING",
  "CONTACT_NO_RESPONSE",
]);
