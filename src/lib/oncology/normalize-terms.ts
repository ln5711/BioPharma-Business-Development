/** Shared normalization + alias helpers for entity resolution (spec §54). */

export function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(inc|inc\.|llc|ltd|ltd\.|co|co\.|corp|corp\.|corporation|company|plc|ag|nv|sa|s\.a\.|gmbh|pharmaceuticals?|pharma|therapeutics?|biosciences?|biopharma|oncology)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Map ClinicalTrials.gov phase tokens → our enum. */
export function mapPhase(phases: string[] | undefined): string {
  const p = (phases ?? []).map((x) => x.toUpperCase());
  if (p.includes("EARLY_PHASE1")) return "early_phase_1";
  const has1 = p.includes("PHASE1");
  const has2 = p.includes("PHASE2");
  const has3 = p.includes("PHASE3");
  const has4 = p.includes("PHASE4");
  if (has1 && has2) return "phase_1_2";
  if (has2 && has3) return "phase_2_3";
  if (has3) return "phase_3";
  if (has4) return "phase_4";
  if (has2) return "phase_2";
  if (has1) return "phase_1";
  if (p.includes("NA")) return "not_applicable";
  return "unknown";
}

/** Map ClinicalTrials.gov overallStatus → our enum. */
export function mapStatus(status: string | undefined): string {
  switch ((status ?? "").toUpperCase()) {
    case "NOT_YET_RECRUITING":
      return "not_yet_recruiting";
    case "RECRUITING":
      return "recruiting";
    case "ENROLLING_BY_INVITATION":
      return "enrolling_by_invitation";
    case "ACTIVE_NOT_RECRUITING":
      return "active_not_recruiting";
    case "SUSPENDED":
      return "suspended";
    case "TERMINATED":
      return "terminated";
    case "COMPLETED":
      return "completed";
    case "WITHDRAWN":
      return "withdrawn";
    default:
      return "unknown";
  }
}

/** Phase ordinal for detecting progressions (Phase I → Phase I/II etc). */
export function phaseRank(phase: string): number {
  return (
    {
      early_phase_1: 0.5,
      phase_1: 1,
      phase_1_2: 1.5,
      phase_2: 2,
      phase_2_3: 2.5,
      phase_3: 3,
      phase_4: 4,
      not_applicable: 0,
      unknown: 0,
    } as Record<string, number>
  )[phase] ?? 0;
}

export function parseCtgovDate(value: string | undefined): Date | null {
  if (!value) return null;
  // v2 dates: "YYYY-MM-DD" or "YYYY-MM".
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value.trim());
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, day] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, day ? Number(day) : 1));
}
