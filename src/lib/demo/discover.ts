import "server-only";
import type { Extraction } from "@/lib/contacts/types";

/**
 * Demo-mode contact discovery: no network call, no LLM — a deterministic,
 * clearly-labelled synthetic result so the Discover flow "just works" for
 * ANY typed query during a presentation. Two safety rules that matter even
 * in a demo:
 *  1. The email domain is ALWAYS an obviously-fake "*-demo.example" address,
 *     regardless of what real company name someone types — never a
 *     plausible address at a real company's real domain.
 *  2. Every generated field is prefixed "DEMO DATA" so it can never be
 *     mistaken for genuine research even out of context (a screenshot, a
 *     copy-pasted export row).
 */

const FIRST_NAMES = ["Avery", "Jordan", "Morgan", "Reese", "Cameron", "Devon", "Rowan", "Skyler", "Emerson", "Quinn", "Harper", "Sage"];
const LAST_NAMES = ["Whitfield", "Carrow", "Delgado", "Ashworth", "Marchetti", "Okafor", "Lindgren", "Sorensen", "Pemberton", "Vasquez", "Hollis", "Nakamura"];

const ROLES: { title: string; function: string; seniority: string }[] = [
  { title: "VP, Translational Medicine", function: "translational_medicine", seniority: "vp" },
  { title: "Director, Biomarker Development", function: "biomarker_development", seniority: "director" },
  { title: "Head of Precision Medicine", function: "precision_medicine", seniority: "head" },
  { title: "Director, Clinical Development", function: "clinical_development", seniority: "director" },
  { title: "Clinical Program Lead", function: "program_leadership", seniority: "head" },
  { title: "VP, Business Development", function: "business_development", seniority: "vp" },
];

/** Small deterministic hash so the same query/company always yields the same
 * cast of demo people — feels stable across repeat searches in a demo. */
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function slugifyDomain(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "company";
  return `${slug}-demo.example`;
}

export function synthesizeDemoExtraction(companyLabel: string | null, queryText: string): Extraction {
  const seed = hashSeed(`${companyLabel ?? ""}|${queryText}`);
  const company = companyLabel ?? "this company";
  const domain = slugifyDomain(companyLabel ?? queryText);
  const count = 2 + (seed % 2); // 2 or 3 candidates
  const homepageUrl = `https://www.${domain}/team`;

  const candidates = Array.from({ length: count }, (_, i) => {
    const first = FIRST_NAMES[(seed + i * 7) % FIRST_NAMES.length];
    const last = LAST_NAMES[(seed + i * 13) % LAST_NAMES.length];
    const role = ROLES[(seed + i * 5) % ROLES.length];
    const name = `${first} ${last}`;
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`;
    return {
      name,
      title: role.title,
      function: role.function as never,
      seniority: role.seniority as never,
      professionalProfileUrl: `${homepageUrl}/${slug}`,
      headshotUrl: null,
      headshotSourceUrl: null,
      description: `DEMO DATA — ${role.title} at ${company} (synthetic result — no real research provider is configured in this build).`,
      whyThisPerson: `DEMO DATA — surfaced for "${queryText}" as a plausible ${role.title.toLowerCase()} contact at ${company}.`,
      hasDirectProgramEvidence: i === 0,
      evidence: [
        {
          kind: "company_page" as const,
          url: `${homepageUrl}/${slug}`,
          excerpt: `DEMO DATA — ${name}, ${role.title} at ${company}.`,
          date: null,
        },
      ],
      publishedEmail: i === 0 ? email : null,
      employeeEmailExamples:
        i === 0
          ? []
          : [
              { name: FIRST_NAMES[seed % FIRST_NAMES.length] + " " + LAST_NAMES[seed % LAST_NAMES.length], email: `${FIRST_NAMES[seed % FIRST_NAMES.length].toLowerCase()}.${LAST_NAMES[seed % LAST_NAMES.length].toLowerCase()}@${domain}`, sourceUrl: homepageUrl, date: null },
              { name: FIRST_NAMES[(seed + 3) % FIRST_NAMES.length] + " " + LAST_NAMES[(seed + 3) % LAST_NAMES.length], email: `${FIRST_NAMES[(seed + 3) % FIRST_NAMES.length].toLowerCase()}.${LAST_NAMES[(seed + 3) % LAST_NAMES.length].toLowerCase()}@${domain}`, sourceUrl: homepageUrl, date: null },
            ],
    };
  });

  return {
    companyDomain: domain,
    coverage: { companySite: "used", linkedin: "unavailable" },
    candidates: candidates as Extraction["candidates"],
  };
}
