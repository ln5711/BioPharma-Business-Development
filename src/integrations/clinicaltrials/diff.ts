import { phaseRank } from "@/lib/oncology/normalize-terms";
import type { NormalizedTrial } from "./normalize";

export type ChangeSeverity = "cosmetic" | "minor" | "meaningful" | "high";

export interface DetectedChange {
  fieldChanged: string;
  oldValue: unknown;
  newValue: unknown;
  severity: ChangeSeverity;
  /** 0-100 — first-pass commercial relevance of the change itself (spec §4). */
  commercialRelevance: number;
  summary: string;
  /** Hint consumed by the signal engine (spec §14 taxonomy). */
  signalType: string;
}


function added(oldList: string[], newList: string[]): string[] {
  const s = new Set(oldList.map((x) => x.toLowerCase()));
  return newList.filter((x) => !s.has(x.toLowerCase()));
}

/**
 * Deterministic field-level diff between two normalized trial snapshots
 * (spec §6 — "Do not merely ingest current values. Generate TrialChange
 * records."). Every branch maps to a signal-taxonomy type (spec §14).
 */
export function diffTrials(
  prev: NormalizedTrial,
  next: NormalizedTrial,
): DetectedChange[] {
  const changes: DetectedChange[] = [];

  // ── Status ──────────────────────────────────────────────────────────────
  if (prev.status !== next.status) {
    const terminal = ["terminated", "suspended", "withdrawn"].includes(next.status);
    const restarted =
      ["terminated", "suspended", "withdrawn"].includes(prev.status) &&
      ["recruiting", "active_not_recruiting", "not_yet_recruiting"].includes(next.status);
    changes.push({
      fieldChanged: "status",
      oldValue: prev.status,
      newValue: next.status,
      severity: terminal ? "high" : "meaningful",
      commercialRelevance: terminal ? 85 : restarted ? 60 : 55,
      summary: `Status changed ${prev.status.toUpperCase()} → ${next.status.toUpperCase()}${
        next.whyStopped ? ` (${next.whyStopped})` : ""
      }`,
      signalType: terminal
        ? next.status === "suspended"
          ? "CLINICAL_HOLD"
          : "TRIAL_TERMINATION"
        : "TRIAL_STATUS_CHANGE",
    });
  }

  // ── Phase ───────────────────────────────────────────────────────────────
  if (prev.phase !== next.phase) {
    const advancing = phaseRank(next.phase) > phaseRank(prev.phase);
    changes.push({
      fieldChanged: "phase",
      oldValue: prev.phase,
      newValue: next.phase,
      severity: advancing ? "high" : "meaningful",
      commercialRelevance: advancing ? 80 : 45,
      summary: `Phase changed ${prev.phase} → ${next.phase}`,
      signalType: "TRIAL_PHASE_CHANGE",
    });
  }

  // ── Enrollment ──────────────────────────────────────────────────────────
  if (
    typeof prev.enrollment === "number" &&
    typeof next.enrollment === "number" &&
    prev.enrollment !== next.enrollment
  ) {
    const delta = next.enrollment - prev.enrollment;
    const ratio = prev.enrollment > 0 ? next.enrollment / prev.enrollment : 1;
    const bigExpansion = delta > 0 && (ratio >= 1.5 || delta >= 100);
    changes.push({
      fieldChanged: "enrollment",
      oldValue: prev.enrollment,
      newValue: next.enrollment,
      severity: bigExpansion ? "high" : delta > 0 ? "meaningful" : "minor",
      commercialRelevance: bigExpansion ? 78 : delta > 0 ? 50 : 20,
      summary: `Target enrollment ${prev.enrollment} → ${next.enrollment} (${
        delta > 0 ? "+" : ""
      }${delta})`,
      signalType: bigExpansion ? "TRIAL_EXPANSION" : "TRIAL_ENROLLMENT_CHANGE",
    });
  }

  // ── Arms / cohorts ──────────────────────────────────────────────────────
  const newArms = added(
    prev.armsRaw.map((a) => a.label),
    next.armsRaw.map((a) => a.label),
  );
  if (newArms.length) {
    const combo = newArms.some((a) => /combination|\+|combo/i.test(a));
    changes.push({
      fieldChanged: "arms",
      oldValue: prev.armsRaw.map((a) => a.label),
      newValue: next.armsRaw.map((a) => a.label),
      severity: "meaningful",
      commercialRelevance: combo ? 68 : 62,
      summary: `${newArms.length} new arm/cohort(s): ${newArms.slice(0, 3).join("; ")}${
        newArms.length > 3 ? "…" : ""
      }`,
      signalType: combo ? "NEW_COMBINATION_ARM" : "NEW_TRIAL_COHORT",
    });
  }

  // ── Interventions ───────────────────────────────────────────────────────
  const newInterventions = added(
    prev.interventionsRaw.map((i) => i.name),
    next.interventionsRaw.map((i) => i.name),
  );
  if (newInterventions.length) {
    changes.push({
      fieldChanged: "interventions",
      oldValue: prev.interventionsRaw.map((i) => i.name),
      newValue: next.interventionsRaw.map((i) => i.name),
      severity: "meaningful",
      commercialRelevance: 55,
      summary: `New intervention(s): ${newInterventions.slice(0, 3).join("; ")}`,
      signalType: "NEW_COMBINATION_ARM",
    });
  }

  // ── Conditions / indications ────────────────────────────────────────────
  const newConditions = added(prev.conditionsRaw, next.conditionsRaw);
  if (newConditions.length) {
    changes.push({
      fieldChanged: "conditions",
      oldValue: prev.conditionsRaw,
      newValue: next.conditionsRaw,
      severity: "meaningful",
      commercialRelevance: 58,
      summary: `New indication term(s): ${newConditions.slice(0, 3).join("; ")}`,
      signalType: "NEW_INDICATION",
    });
  }

  // ── Countries / sites ───────────────────────────────────────────────────
  const newCountries = added(prev.countries, next.countries);
  if (newCountries.length) {
    changes.push({
      fieldChanged: "countries",
      oldValue: prev.countries,
      newValue: next.countries,
      severity: "minor",
      commercialRelevance: 40,
      summary: `Expanded to new countr${newCountries.length > 1 ? "ies" : "y"}: ${newCountries.join(", ")}`,
      signalType: "NEW_TRIAL_SITE",
    });
  } else if (
    typeof prev.locationCount === "number" &&
    next.locationCount - prev.locationCount >= 5
  ) {
    changes.push({
      fieldChanged: "locationCount",
      oldValue: prev.locationCount,
      newValue: next.locationCount,
      severity: "minor",
      commercialRelevance: 38,
      summary: `Trial sites ${prev.locationCount} → ${next.locationCount}`,
      signalType: "NEW_TRIAL_SITE",
    });
  }

  // ── Biomarker requirement appears ──────────────────────────────────────
  if (!prev.molecularEligibility && next.molecularEligibility) {
    changes.push({
      fieldChanged: "molecularEligibility",
      oldValue: false,
      newValue: true,
      severity: "high",
      commercialRelevance: 82,
      summary: "Molecular / biomarker eligibility now required",
      signalType: "NEW_BIOMARKER_REQUIREMENT",
    });
  }

  // ── Endpoint-level biomarker language ─────────────────────────────────
  const endpointDelta = (
    field: "ctdnaMentions" | "mrdMentions" | "resistanceMonitoringMentions",
    signalType: string,
    label: string,
    relevance: number,
  ) => {
    if (!prev[field] && next[field]) {
      changes.push({
        fieldChanged: field,
        oldValue: false,
        newValue: true,
        severity: "high",
        commercialRelevance: relevance,
        summary: `${label} language added to the trial record`,
        signalType,
      });
    }
  };
  endpointDelta("ctdnaMentions", "NEW_CT_DNA_ENDPOINT", "ctDNA / liquid-biopsy", 84);
  endpointDelta("mrdMentions", "NEW_MRD_ENDPOINT", "MRD", 80);
  endpointDelta(
    "resistanceMonitoringMentions",
    "NEW_RESISTANCE_ENDPOINT",
    "Resistance-monitoring",
    76,
  );

  // ── Endpoints (non-biomarker) ────────────────────────────────────────
  const newExploratory = added(prev.exploratoryEndpoints, next.exploratoryEndpoints);
  if (newExploratory.length && !changes.some((c) => c.fieldChanged.includes("Mentions"))) {
    changes.push({
      fieldChanged: "exploratoryEndpoints",
      oldValue: prev.exploratoryEndpoints,
      newValue: next.exploratoryEndpoints,
      severity: "minor",
      commercialRelevance: 44,
      summary: `New exploratory endpoint(s): ${newExploratory[0].slice(0, 120)}`,
      signalType: "NEW_TRANSLATIONAL_ENDPOINT",
    });
  }

  // ── Sponsor / collaborators ──────────────────────────────────────────
  if (prev.sponsorName && next.sponsorName && prev.sponsorName !== next.sponsorName) {
    changes.push({
      fieldChanged: "sponsor",
      oldValue: prev.sponsorName,
      newValue: next.sponsorName,
      severity: "meaningful",
      commercialRelevance: 60,
      summary: `Lead sponsor changed: ${prev.sponsorName} → ${next.sponsorName}`,
      signalType: "PARTNERSHIP",
    });
  }
  const newCollaborators = added(prev.collaborators, next.collaborators);
  if (newCollaborators.length) {
    changes.push({
      fieldChanged: "collaborators",
      oldValue: prev.collaborators,
      newValue: next.collaborators,
      severity: "meaningful",
      commercialRelevance: 52,
      summary: `New collaborator(s): ${newCollaborators.join(", ")}`,
      signalType: "PARTNERSHIP",
    });
  }

  // ── Primary completion date ─────────────────────────────────────────
  const pcOld = prev.primaryCompletionDate?.toISOString().slice(0, 10) ?? null;
  const pcNew = next.primaryCompletionDate?.toISOString().slice(0, 10) ?? null;
  if (pcOld && pcNew && pcOld !== pcNew) {
    changes.push({
      fieldChanged: "primaryCompletionDate",
      oldValue: pcOld,
      newValue: pcNew,
      severity: "minor",
      commercialRelevance: 30,
      summary: `Primary completion date ${pcOld} → ${pcNew}`,
      signalType: "TRIAL_STATUS_CHANGE",
    });
  }

  return changes;
}
