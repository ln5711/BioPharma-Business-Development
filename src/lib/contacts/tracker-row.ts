import "server-only";
import { formatDate } from "@/lib/utils";
import {
  classifyProfileUrl,
  currentEmailEvidenceUrls,
  editableNameParts,
  type ActivityRow,
  type SavedContactRow,
} from "./query-contacts";

/** One row, in `TRACKER_HEADERS` order — the single mapping used by CSV, XLSX,
 * and (eventually) the on-page table, so every surface always matches. */
export function toTrackerRow(row: SavedContactRow): (string | number)[] {
  const { person: p, relationship: rel } = row;
  const { first, last } = editableNameParts(p.name);
  const { linkedin, companyProfile } = classifyProfileUrl(p.professionalProfileUrl);
  const evidenceUrls = currentEmailEvidenceUrls(p);
  const sourceUrls = [...new Set(p.sourceEvidence.map((e) => e.url).filter((u): u is string => !!u))];

  return [
    first,
    last,
    p.name,
    p.title ?? "",
    row.organizationName ?? "",
    p.department ?? "",
    linkedin ?? "",
    companyProfile ?? "",
    p.email ?? "",
    labelProvenance(p.emailProvenance),
    labelDeliverability(p.emailDeliverability),
    p.emailPattern ?? "",
    evidenceUrls.join(" ; "),
    p.relevanceScore ?? "",
    p.whyThisPerson ?? "",
    p.whyNow ?? "",
    row.signalHeadline ?? "",
    row.assetName ?? "",
    row.trialNctId ?? "",
    labelOutreachStatus(rel?.outreachStatus ?? "new"),
    rel?.favorite ? "Yes" : "No",
    row.ownerName ?? "",
    formatDate(rel?.lastContactedAt ?? null),
    formatDate(rel?.lastResponseAt ?? null),
    formatDate(rel?.nextFollowUpAt ?? null),
    row.outreachCount,
    row.latestOutcome ?? "",
    rel?.notes ?? "",
    sourceUrls.join(" ; "),
    formatDate(p.lastVerifiedAt),
  ];
}

export function toActivityRow(a: ActivityRow): (string | number)[] {
  return [
    a.personName,
    a.organizationName ?? "",
    a.type.replace(/_/g, " "),
    formatDate(a.occurredAt),
    a.subject ?? "",
    a.body ?? "",
    /received/.test(a.type) ? "inbound" : "outbound",
    a.outcome ?? "",
    a.nextStep ?? "",
  ];
}

/** Salesforce Leads preset. `includeInferredEmail=false` leaves the Email
 * column blank for anything not publicly sourced, rather than exporting an
 * inferred address as if it were confirmed. */
export function toSalesforceLeadRow(row: SavedContactRow, includeInferredEmail: boolean): (string | number)[] {
  const { person: p } = row;
  const { first, last } = editableNameParts(p.name);
  const emailOk = p.emailProvenance === "publicly_sourced" || (includeInferredEmail && p.emailProvenance === "inferred_pattern") || p.emailProvenance === "user_supplied";
  return [
    first,
    last || p.name, // Salesforce requires Last Name — fall back to the full name when we can't split
    row.organizationName ?? "(unknown company)",
    p.title ?? "",
    emailOk ? p.email ?? "" : "",
    "newwin",
    [p.whyThisPerson, includeInferredEmail && p.emailProvenance === "inferred_pattern" ? `Email is INFERRED (pattern: ${p.emailPattern ?? "unknown"}), not verified.` : ""]
      .filter(Boolean)
      .join(" — "),
    "",
    "Open - Not Contacted",
  ];
}

export interface SalesforceValidation {
  personId: string;
  name: string;
  issues: string[];
}

/** Flags rows Salesforce's Lead import will reject or mis-map, BEFORE export —
 * "Validate required fields and identify columns requiring mapping." */
export function validateForSalesforce(row: SavedContactRow): SalesforceValidation | null {
  const issues: string[] = [];
  const { last } = editableNameParts(row.person.name);
  if (!last) issues.push('Last Name could not be confidently split from the full name — verify before import.');
  if (!row.organizationName) issues.push("Company is unknown — required by Salesforce Leads.");
  if (!row.person.email) issues.push("No email on file.");
  else if (row.person.emailProvenance === "inferred_pattern") issues.push("Email is inferred, not verified — review before relying on it.");
  return issues.length ? { personId: row.person.id, name: row.person.name, issues } : null;
}

function labelProvenance(v: string): string {
  return { publicly_sourced: "Publicly sourced", inferred_pattern: "Inferred (pattern)", user_supplied: "User supplied", not_found: "Not found" }[v] ?? v;
}
function labelDeliverability(v: string): string {
  return { not_checked: "Not checked", verified: "Verified", undeliverable: "Undeliverable", unknown_catch_all: "Unknown / catch-all" }[v] ?? v;
}
function labelOutreachStatus(v: string): string {
  return v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
