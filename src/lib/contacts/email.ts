import "server-only";
import type { EmailCandidate, EmailExample, EvidenceRef } from "@/db/schema/people";
import { emailSafe, splitName } from "./name";

/**
 * Professional email discovery/inference (spec: this is a core feature).
 *
 * Provenance and deliverability are tracked SEPARATELY — an inferred address
 * is never silently promoted to "verified", and a publicly-found address is
 * never assumed deliverable just because it was published somewhere. A
 * candidate is only generated when at least two DISTINCT employees' published
 * addresses corroborate the SAME pattern on the SAME domain; conflicting
 * patterns or single-example evidence leave the address unresolved rather than
 * guessing.
 */

export type PatternId =
  | "first.last"
  | "firstlast"
  | "first_last"
  | "first-last"
  | "flast"
  | "f.last"
  | "last.first"
  | "first"
  | "last";

const PATTERNS: { id: PatternId; render: (first: string, last: string) => string }[] = [
  { id: "first.last", render: (f, l) => `${f}.${l}` },
  { id: "firstlast", render: (f, l) => `${f}${l}` },
  { id: "first_last", render: (f, l) => `${f}_${l}` },
  { id: "first-last", render: (f, l) => `${f}-${l}` },
  { id: "flast", render: (f, l) => `${f[0] ?? ""}${l}` },
  { id: "f.last", render: (f, l) => `${f[0] ?? ""}.${l}` },
  { id: "last.first", render: (f, l) => `${l}.${f}` },
  { id: "first", render: (f) => f },
  { id: "last", render: (_f, l) => l },
];

function domainOf(email: string): string | null {
  const m = /^[^@]+@([^@]+)$/.exec(email.trim());
  return m ? m[1].toLowerCase() : null;
}

function localPartOf(email: string): string | null {
  const m = /^([^@]+)@[^@]+$/.exec(email.trim());
  return m ? m[1].toLowerCase() : null;
}

export function isPlausibleEmail(s: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s.trim());
}

export interface PatternAnalysis {
  resolvedPattern: PatternId | null;
  confidence: EmailCandidate["confidence"];
  /** Distinct employees (by address) whose published email supports the resolved pattern. */
  supportingExamples: EmailExample[];
  /** Distinct-employee support count per pattern that matched at least one example. */
  patternSupport: Partial<Record<PatternId, number>>;
  note: string | null;
}

/**
 * Cross-reference named employees' KNOWN emails against a domain to infer the
 * company's address pattern. Counts DISTINCT people per pattern (de-duplicated
 * by lower-cased address, so one address repeated across mirrored pages only
 * counts once). Requires >=2 distinct supporters of a single, non-tied pattern.
 */
export function analyzeEmployeeExamples(
  examples: EmailExample[],
  domain: string,
): PatternAnalysis {
  const domainLower = domain.trim().toLowerCase().replace(/^www\./, "");
  const byPattern = new Map<PatternId, Map<string, EmailExample>>();
  let onDomainCount = 0;
  let unsplittableCount = 0;
  let unmatchedCount = 0;

  for (const ex of examples) {
    const exDomain = domainOf(ex.email);
    if (!exDomain || exDomain !== domainLower) continue; // off-domain — not evidence for THIS company
    onDomainCount++;
    const local = localPartOf(ex.email);
    if (!local) continue;
    const split = splitName(ex.name);
    if (split.ambiguous) {
      unsplittableCount++;
      continue;
    }
    const first = emailSafe(split.first);
    const last = emailSafe(split.last);
    if (!first || !last) {
      unsplittableCount++;
      continue;
    }
    let matchedAny = false;
    for (const p of PATTERNS) {
      if (p.render(first, last).toLowerCase() === local) {
        matchedAny = true;
        if (!byPattern.has(p.id)) byPattern.set(p.id, new Map());
        byPattern.get(p.id)!.set(local, ex); // de-dup by local-part → distinct people
      }
    }
    if (!matchedAny) unmatchedCount++;
  }

  const support: Partial<Record<PatternId, number>> = {};
  for (const [pid, m] of byPattern) support[pid] = m.size;

  const ranked = [...byPattern.entries()].sort((a, b) => b[1].size - a[1].size);
  if (ranked.length === 0) {
    const note =
      onDomainCount === 0
        ? "no employee email examples found on this domain"
        : unsplittableCount === onDomainCount
          ? "employee examples found but their names could not be confidently split"
          : "employee examples on this domain matched no common pattern";
    return { resolvedPattern: null, confidence: null, supportingExamples: [], patternSupport: support, note };
  }

  const [topPattern, topMap] = ranked[0];
  const runnerUp = ranked[1]?.[1].size ?? 0;

  if (topMap.size < 2) {
    return {
      resolvedPattern: null,
      confidence: null,
      supportingExamples: [...topMap.values()],
      patternSupport: support,
      note: `only ${topMap.size} supporting example — at least 2 distinct employees are required before inferring a pattern`,
    };
  }
  if (topMap.size === runnerUp) {
    return {
      resolvedPattern: null,
      confidence: null,
      supportingExamples: [],
      patternSupport: support,
      note: "conflicting patterns are equally well-supported — left unresolved",
    };
  }

  return {
    resolvedPattern: topPattern,
    confidence: topMap.size >= 3 ? "high" : "medium",
    supportingExamples: [...topMap.values()],
    patternSupport: support,
    note: unmatchedCount > 0 ? `${unmatchedCount} other on-domain example(s) did not fit this pattern` : null,
  };
}

export interface ResolveEmailInput {
  personName: string;
  /** A directly published address for THIS person, with where it was found. */
  publishedEmail?: { address: string; source: EvidenceRef } | null;
  employerDomain: string | null;
  /** Named-employee examples gathered for the SAME employer, for pattern inference. */
  employeeExamples: EmailExample[];
  resolvedAt: string; // ISO — caller supplies so this stays a pure function
}

/** The full discovery→resolution decision for one person's email. */
export function resolveContactEmail(input: ResolveEmailInput): EmailCandidate {
  const { personName, publishedEmail, employerDomain, employeeExamples, resolvedAt } = input;

  if (publishedEmail && isPlausibleEmail(publishedEmail.address)) {
    return {
      address: publishedEmail.address.trim().toLowerCase(),
      provenance: "publicly_sourced",
      pattern: null,
      domain: domainOf(publishedEmail.address),
      supportingExamples: [],
      sources: [publishedEmail.source],
      confidence: "high",
      note: null,
      resolvedAt,
    };
  }

  if (!employerDomain) {
    return {
      address: null,
      provenance: "not_found",
      pattern: null,
      domain: null,
      supportingExamples: [],
      sources: [],
      confidence: null,
      note: "employer domain is not known — nothing to build a pattern from",
      resolvedAt,
    };
  }

  const split = splitName(personName);
  if (split.ambiguous) {
    return {
      address: null,
      provenance: "not_found",
      pattern: null,
      domain: employerDomain,
      supportingExamples: [],
      sources: [],
      confidence: null,
      note: `could not confidently split "${personName}" into first/last name (${split.reason ?? "unsupported format"})`,
      resolvedAt,
    };
  }

  const analysis = analyzeEmployeeExamples(employeeExamples, employerDomain);
  if (!analysis.resolvedPattern) {
    return {
      address: null,
      provenance: "not_found",
      pattern: null,
      domain: employerDomain,
      supportingExamples: analysis.supportingExamples,
      sources: analysis.supportingExamples.map((e) => ({ kind: "employee_example", url: e.sourceUrl, excerpt: `${e.name} <${e.email}>`, date: e.date ?? null })),
      confidence: null,
      note: analysis.note,
      resolvedAt,
    };
  }

  const first = emailSafe(split.first);
  const last = emailSafe(split.last);
  const template = PATTERNS.find((p) => p.id === analysis.resolvedPattern)!;
  const address = `${template.render(first, last)}@${employerDomain.toLowerCase()}`;

  return {
    address,
    provenance: "inferred_pattern",
    pattern: analysis.resolvedPattern,
    domain: employerDomain,
    supportingExamples: analysis.supportingExamples,
    sources: analysis.supportingExamples.map((e) => ({
      kind: "employee_example",
      url: e.sourceUrl,
      excerpt: `${e.name} <${e.email}>`,
      date: e.date ?? null,
    })),
    confidence: analysis.confidence,
    note: analysis.note,
    resolvedAt,
  };
}
