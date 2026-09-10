import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { trials } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { runSearch } from "@/lib/search/search";
import { bootstrapOncologyTrials } from "@/lib/search/search-trials";
import type { TrialPhase, TrialSearchResult, TrialStatus } from "@/lib/search/types";
import { PageHeader, Pill } from "@/components/ui/primitives";
import { Table, Td, Th, Tr } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PHASE_LABEL: Record<string, string> = {
  early_phase_1: "EP1",
  phase_1: "P1",
  phase_1_2: "P1/2",
  phase_2: "P2",
  phase_2_3: "P2/3",
  phase_3: "P3",
  phase_4: "P4",
  not_applicable: "N/A",
  unknown: "—",
};

const STATUS_OPTIONS: { value: string; label: string; enums: TrialStatus[] }[] = [
  { value: "", label: "Any status", enums: [] },
  { value: "recruiting", label: "Recruiting", enums: ["recruiting", "enrolling_by_invitation"] },
  { value: "not_yet_recruiting", label: "Not yet recruiting", enums: ["not_yet_recruiting"] },
  { value: "active_not_recruiting", label: "Active, not recruiting", enums: ["active_not_recruiting"] },
  { value: "completed", label: "Completed", enums: ["completed"] },
  { value: "terminated", label: "Terminated / withdrawn", enums: ["terminated", "withdrawn", "suspended"] },
];

const PHASE_OPTIONS: { value: string; label: string; enums: TrialPhase[] }[] = [
  { value: "", label: "Any phase", enums: [] },
  { value: "phase_1", label: "Phase 1", enums: ["phase_1", "phase_1_2", "early_phase_1"] },
  { value: "phase_2", label: "Phase 2", enums: ["phase_2", "phase_1_2", "phase_2_3"] },
  { value: "phase_3", label: "Phase 3", enums: ["phase_3", "phase_2_3"] },
  { value: "phase_4", label: "Phase 4", enums: ["phase_4"] },
];

const SORT_OPTIONS = [
  { value: "updated", label: "Recently updated" },
  { value: "added", label: "Newly added" },
  { value: "phase", label: "Phase (high→low)" },
  { value: "sponsor", label: "Sponsor (A→Z)" },
];

const dateStr = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

interface BrowseRow {
  nctId: string;
  title: string | null;
  sponsorName: string | null;
  phase: string;
  status: string;
  enrollment: number | null;
  interventions: string[];
  conditions: string[];
  molecularEligibility: boolean;
  ctdnaMentions: boolean;
  mrdMentions: boolean;
  ngsMentions: boolean;
  serialSamplingMentions: boolean;
  lastCtgovUpdate: Date | null;
  firstPostedDate: Date | null;
  source: "workspace" | "clinicaltrials.gov";
}

function flags(r: {
  molecularEligibility: boolean;
  ctdnaMentions: boolean;
  mrdMentions: boolean;
  ngsMentions: boolean;
  serialSamplingMentions: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {r.molecularEligibility ? <Pill tone="high">mol. elig.</Pill> : null}
      {r.ctdnaMentions ? <Pill tone="info">ctDNA</Pill> : null}
      {r.mrdMentions ? <Pill tone="info">MRD</Pill> : null}
      {r.ngsMentions ? <Pill tone="neutral">NGS</Pill> : null}
      {r.serialSamplingMentions ? <Pill tone="neutral">serial</Pill> : null}
      {!r.molecularEligibility &&
      !r.ctdnaMentions &&
      !r.mrdMentions &&
      !r.ngsMentions &&
      !r.serialSamplingMentions ? (
        <span className="meta">—</span>
      ) : null}
    </div>
  );
}

async function browseLocal(
  tenantId: string,
  opts: { status: string; phase: string; sort: string; limit: number },
): Promise<BrowseRow[]> {
  const db = await getDb();
  const conds = [eq(trials.tenantId, tenantId)];
  const st = STATUS_OPTIONS.find((s) => s.value === opts.status);
  if (st?.enums.length) conds.push(inArray(trials.status, st.enums));
  const ph = PHASE_OPTIONS.find((p) => p.value === opts.phase);
  if (ph?.enums.length) conds.push(inArray(trials.phase, ph.enums));

  const orderBy =
    opts.sort === "added"
      ? desc(trials.firstSeenAt)
      : opts.sort === "sponsor"
        ? sql`${trials.sponsorName} asc nulls last`
        : opts.sort === "phase"
          ? desc(trials.phase)
          : desc(sql`coalesce(${trials.lastCtgovUpdate}, ${trials.firstPostedDate}, ${trials.firstSeenAt})`);

  const rows = await db
    .select({
      nctId: trials.nctId,
      title: trials.title,
      sponsorName: trials.sponsorName,
      phase: trials.phase,
      status: trials.status,
      enrollment: trials.enrollment,
      interventions: trials.interventionsRaw,
      conditions: trials.conditionsRaw,
      molecularEligibility: trials.molecularEligibility,
      ctdnaMentions: trials.ctdnaMentions,
      mrdMentions: trials.mrdMentions,
      ngsMentions: trials.ngsMentions,
      serialSamplingMentions: trials.serialSamplingMentions,
      lastCtgovUpdate: trials.lastCtgovUpdate,
      firstPostedDate: trials.firstPostedDate,
    })
    .from(trials)
    .where(and(...conds))
    .orderBy(orderBy)
    .limit(opts.limit);

  return rows.map((r) => ({
    ...r,
    interventions: (r.interventions ?? []).map((i) => i.name).filter(Boolean),
    conditions: r.conditions ?? [],
    source: "workspace" as const,
  }));
}

function resultToBrowseRow(t: TrialSearchResult): BrowseRow {
  return {
    nctId: t.nctId,
    title: t.title,
    sponsorName: t.sponsor,
    phase: t.phase,
    status: t.status,
    enrollment: null,
    interventions: t.interventions,
    conditions: t.conditions,
    molecularEligibility: t.flags.includes("molecular eligibility"),
    ctdnaMentions: t.flags.includes("ctDNA"),
    mrdMentions: t.flags.includes("MRD"),
    ngsMentions: t.flags.includes("NGS"),
    serialSamplingMentions: t.flags.includes("serial sampling"),
    lastCtgovUpdate: t.lastUpdate ? new Date(t.lastUpdate) : null,
    firstPostedDate: t.firstPosted ? new Date(t.firstPosted) : null,
    source: t.source,
  };
}

export default async function TrialsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const phase = typeof sp.phase === "string" ? sp.phase : "";
  const sort = typeof sp.sort === "string" ? sp.sort : "updated";

  const { tenant } = await getActiveTenant();

  let rows: BrowseRow[] = [];
  let banner: string | null = null;

  if (q) {
    const search = await runSearch(q, { tenantId: tenant.id, live: true, persist: true, trialLimit: 40 });
    rows = search.trials.map(resultToBrowseRow);
    const live = rows.filter((r) => r.source === "clinicaltrials.gov").length;
    banner =
      `${rows.length} result${rows.length === 1 ? "" : "s"} for “${q}”` +
      (live ? ` · ${live} live from ClinicalTrials.gov` : "") +
      (search.meta.ctgovError ? ` · ClinicalTrials.gov error: ${search.meta.ctgovError}` : "");
  } else {
    rows = await browseLocal(tenant.id, { status, phase, sort, limit: 200 });
    if (rows.length === 0) {
      const boot = await bootstrapOncologyTrials(tenant.id, { fetch: 40, persist: 20 });
      rows = boot.results.map(resultToBrowseRow);
      banner = boot.results.length
        ? `Showing ${boot.results.length} recently-updated oncology trials live from ClinicalTrials.gov — ${boot.persisted} added to your workspace.`
        : `Could not reach ClinicalTrials.gov${boot.error ? ` (${boot.error})` : ""}. Try again shortly.`;
    }
  }

  const qp = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (phase) p.set("phase", phase);
    if (sort && sort !== "updated") p.set("sort", sort);
    for (const [k, v] of Object.entries(over)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return s ? `/trials?${s}` : "/trials";
  };

  return (
    <div>
      <PageHeader
        eyebrow="Clinical trials"
        title="Trials"
        description="Search your workspace and ClinicalTrials.gov together. Every trial is snapshotted and diffed on each refresh; the flags are derived deterministically from the public record."
      />

      <form method="get" className="mb-5 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by trial, target, drug, sponsor, indication or NCT ID"
          className="min-w-[280px] flex-1 rounded-[10px] border bg-transparent px-3.5 py-2.5 text-[13px] text-[var(--fg)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent-border)]"
          style={{ borderColor: "var(--card-border)" }}
        />
        <select name="status" defaultValue={status} className="rounded-[10px] border bg-transparent px-3 py-2.5 text-[12.5px] text-[var(--muted)]" style={{ borderColor: "var(--card-border)" }}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select name="phase" defaultValue={phase} className="rounded-[10px] border bg-transparent px-3 py-2.5 text-[12.5px] text-[var(--muted)]" style={{ borderColor: "var(--card-border)" }}>
          {PHASE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} className="rounded-[10px] border bg-transparent px-3 py-2.5 text-[12.5px] text-[var(--muted)]" style={{ borderColor: "var(--card-border)" }}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button type="submit" className="rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}>
          Search
        </button>
        {q ? (
          <Link href={qp({ q: "" })} className="text-[12px] text-[var(--muted)] underline">
            Clear
          </Link>
        ) : null}
      </form>

      {banner ? (
        <p className="mb-3 text-[12.5px] text-[var(--muted)]">{banner}</p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-[13px] text-[var(--muted)]">
          No trials match. Try a broader term — a gene (KRAS), a drug (RMC-6236), a sponsor, or an NCT ID.
        </p>
      ) : (
        <Table
          head={
            <>
              <Th>Trial</Th>
              <Th>Sponsor</Th>
              <Th>Phase</Th>
              <Th>Status</Th>
              <Th>Drug / intervention</Th>
              <Th>Testing language</Th>
              <Th align="right">CT.gov update</Th>
              <Th>Source</Th>
            </>
          }
        >
          {rows.map((t) => (
            <Tr key={t.nctId}>
              <Td>
                <Link href={`/trials/${t.nctId}`} className="font-mono text-[11.5px] text-[var(--accent)]">
                  {t.nctId}
                </Link>
                <div className="entity-name mt-0.5 line-clamp-2 max-w-[320px] text-[13.5px] leading-snug">
                  {t.title}
                </div>
                {t.conditions.length ? (
                  <div className="mt-0.5 line-clamp-1 max-w-[320px] text-[11.5px] text-[var(--faint)]">
                    {t.conditions.slice(0, 3).join(", ")}
                  </div>
                ) : null}
              </Td>
              <Td className="text-[var(--muted)]">
                <span className="line-clamp-2 max-w-[150px]">{t.sponsorName ?? "—"}</span>
              </Td>
              <Td className="font-medium">{PHASE_LABEL[t.phase] ?? t.phase}</Td>
              <Td>
                <span className="text-[12px] text-[var(--muted)]">{t.status.replace(/_/g, " ")}</span>
              </Td>
              <Td className="text-[var(--muted)]">
                <span className="line-clamp-2 max-w-[160px]">{t.interventions.slice(0, 3).join(", ") || "—"}</span>
              </Td>
              <Td>{flags(t)}</Td>
              <Td align="right" className="text-[var(--muted)] tnum">
                {dateStr(t.lastCtgovUpdate)}
              </Td>
              <Td>
                <span className="text-[11px] text-[var(--faint)]">
                  {t.source === "workspace" ? "Workspace" : "ClinicalTrials.gov"}
                </span>
              </Td>
            </Tr>
          ))}
        </Table>
      )}
    </div>
  );
}
