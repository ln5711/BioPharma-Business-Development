/**
 * Plain, serializable shape both the Discover (unsaved candidate) and
 * Saved/Favorites/Follow-ups (persisted person) views map into, so ONE
 * `ContactCard` component renders either. No server-only imports here — this
 * file is safe for client components to import for typing.
 */
export interface ContactViewModel {
  /** discoveredContacts.id (unsaved) or people.id (saved) */
  id: string;
  /** set once saved — null for an unsaved discovery result */
  personId: string | null;
  discoveredContactId: string | null;
  saved: boolean;
  name: string;
  title: string | null;
  company: string | null;
  organizationId: string | null;
  function: string;
  seniority: string;
  professionalProfileUrl: string | null;
  headshotUrl: string | null;
  headshotSourceUrl: string | null;
  description: string | null;
  whyThisPerson: string | null;
  whyNow: string | null;
  useCase: string | null;
  assetLabel: string | null;
  trialNctId: string | null;
  signalHeadline: string | null;
  contactLabel: "direct_program_evidence" | "relevant_function_unconfirmed" | "potential_introducer" | null;
  relevanceScore: number | null;
  relevanceBreakdown: Record<string, number> | null;
  email: string | null;
  emailProvenance: "publicly_sourced" | "inferred_pattern" | "user_supplied" | "not_found";
  emailDeliverability: "not_checked" | "verified" | "undeliverable" | "unknown_catch_all";
  emailPattern: string | null;
  emailEvidenceCount: number;
  emailSupportingCount: number;
  emailNote: string | null;
  sourceEvidence: { kind: string; url?: string; excerpt?: string; date?: string | null }[];
  lastResearchedAt: string | null;
  favorite: boolean;
  outreachStatus: string;
  lastContactedAt: string | null;
  lastResponseAt: string | null;
  nextFollowUpAt: string | null;
  notes: string | null;
  ownerName: string | null;
  outreachCount: number;
  pendingConflicts: { field: string; discoveredValue: string; discoveredAt: string }[];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const CONTACT_LABEL_TEXT: Record<string, string> = {
  direct_program_evidence: "Direct program evidence",
  relevant_function_unconfirmed: "Relevant function — program unconfirmed",
  potential_introducer: "Potential introducer",
};

export const EMAIL_PROVENANCE_TEXT: Record<string, string> = {
  publicly_sourced: "Publicly sourced",
  inferred_pattern: "Inferred from pattern",
  user_supplied: "User supplied",
  not_found: "Not found",
};

export const EMAIL_DELIVERABILITY_TEXT: Record<string, string> = {
  not_checked: "Deliverability not verified",
  verified: "Verified deliverable",
  undeliverable: "Undeliverable",
  unknown_catch_all: "Unknown / catch-all domain",
};

export const OUTREACH_STATUS_OPTIONS = [
  "new", "researching", "ready_to_contact", "contacted", "follow_up_due",
  "replied", "meeting_scheduled", "qualified_opportunity", "not_interested", "do_not_contact",
] as const;

export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Shape of one row as returned by GET /api/contacts/discover (JSON-safe). */
export interface DiscoveredContactJson {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  organizationId: string | null;
  function: string;
  seniority: string;
  professionalProfileUrl: string | null;
  headshotUrl: string | null;
  headshotSourceUrl: string | null;
  description: string | null;
  whyThisPerson: string | null;
  whyNow: string | null;
  useCase: string | null;
  relatedAssetId: string | null;
  relatedTrialId: string | null;
  contactLabel: string;
  relevanceScore: number;
  relevanceBreakdown: Record<string, number>;
  sourceEvidence: { kind: string; url?: string; excerpt?: string; date?: string | null }[];
  emailResult: {
    address: string | null;
    provenance: string;
    pattern: string | null;
    supportingExamples: unknown[];
    sources: unknown[];
    note: string | null;
  } | null;
  emailAddress: string | null;
  emailProvenance: string;
  emailDeliverability: string;
  savedPersonId: string | null;
}

/** Maps a raw discovery result (unsaved candidate) into the shared view model. */
export function discoveredContactToViewModel(dc: DiscoveredContactJson): ContactViewModel {
  return {
    id: dc.id,
    personId: dc.savedPersonId,
    discoveredContactId: dc.id,
    saved: Boolean(dc.savedPersonId),
    name: dc.name,
    title: dc.title,
    company: dc.company,
    organizationId: dc.organizationId,
    function: dc.function,
    seniority: dc.seniority,
    professionalProfileUrl: dc.professionalProfileUrl,
    headshotUrl: dc.headshotUrl,
    headshotSourceUrl: dc.headshotSourceUrl,
    description: dc.description,
    whyThisPerson: dc.whyThisPerson,
    whyNow: dc.whyNow,
    useCase: dc.useCase,
    assetLabel: dc.relatedAssetId ? "Related asset on file" : null,
    trialNctId: null,
    signalHeadline: null,
    contactLabel: (dc.contactLabel as ContactViewModel["contactLabel"]) ?? null,
    relevanceScore: dc.relevanceScore,
    relevanceBreakdown: dc.relevanceBreakdown,
    email: dc.emailAddress,
    emailProvenance: dc.emailProvenance as ContactViewModel["emailProvenance"],
    emailDeliverability: dc.emailDeliverability as ContactViewModel["emailDeliverability"],
    emailPattern: dc.emailResult?.pattern ?? null,
    emailEvidenceCount: dc.emailResult?.sources?.length ?? 0,
    emailSupportingCount: dc.emailResult?.supportingExamples?.length ?? 0,
    emailNote: dc.emailResult?.note ?? null,
    sourceEvidence: dc.sourceEvidence,
    lastResearchedAt: null,
    favorite: false,
    outreachStatus: "new",
    lastContactedAt: null,
    lastResponseAt: null,
    nextFollowUpAt: null,
    notes: null,
    ownerName: null,
    outreachCount: 0,
    pendingConflicts: [],
  };
}
