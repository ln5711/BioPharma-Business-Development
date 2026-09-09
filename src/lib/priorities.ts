/**
 * The recommended priority catalogue shown at onboarding and in the editor.
 * `match` keywords are used by the recommendation engine to connect a priority
 * to signals, trials and accounts.
 */
export interface RecommendedPriority {
  id: string;
  label: string;
  short: string;
  match: string[];
}

export const RECOMMENDED_PRIORITIES: RecommendedPriority[] = [
  {
    id: "prospecting",
    label: "Prospecting new accounts",
    short: "Prospecting",
    match: ["new asset", "financing", "series", "pipeline", "new trial", "ind", "phase i"],
  },
  {
    id: "monitoring",
    label: "Monitoring existing accounts",
    short: "Existing accounts",
    match: ["status", "enrollment", "amendment", "update"],
  },
  {
    id: "trials",
    label: "Clinical trial intelligence",
    short: "Trial intelligence",
    match: ["trial", "phase", "cohort", "arm", "endpoint", "enrollment", "site", "nct"],
  },
  {
    id: "partnerships",
    label: "Finding partnership opportunities",
    short: "Partnerships",
    match: ["partnership", "licensing", "collaboration", "diagnostic partner", "cdx", "co-develop"],
  },
  {
    id: "evidence",
    label: "Scientific evidence / publications",
    short: "Scientific evidence",
    match: ["publication", "preprint", "abstract", "poster", "data readout", "ctdna", "resistance"],
  },
  {
    id: "meetings",
    label: "Preparing meetings",
    short: "Meeting prep",
    match: ["meeting", "briefing"],
  },
  {
    id: "conferences",
    label: "Conference preparation",
    short: "Conference prep",
    match: ["asco", "aacr", "esmo", "sabcs", "wclc", "ash", "conference", "congress"],
  },
  {
    id: "outreach",
    label: "Outreach and follow-ups",
    short: "Outreach",
    match: ["executive", "leadership", "new head", "vp", "appointed", "contact"],
  },
  {
    id: "tracking",
    label: "Tracking key companies",
    short: "Tracking companies",
    match: [],
  },
  {
    id: "biomarker",
    label: "Biomarker / pathway intelligence",
    short: "Biomarker intelligence",
    match: [
      "biomarker",
      "ctdna",
      "mrd",
      "ngs",
      "molecular",
      "kras",
      "nras",
      "egfr",
      "her2",
      "braf",
      "pathway",
      "mutation",
    ],
  },
];

export function recommendedById(id: string): RecommendedPriority | undefined {
  return RECOMMENDED_PRIORITIES.find((p) => p.id === id);
}
