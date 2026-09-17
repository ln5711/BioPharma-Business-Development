"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Pill } from "@/components/ui/primitives";
import { discoveredContactToViewModel, type DiscoveredContactJson } from "@/lib/contacts/view-model";
import { ContactCard } from "./contact-card";
import type { TopSignalForOutreach } from "@/lib/contacts/top-signals";

interface JobState {
  id: string;
  status: "queued" | "running" | "partial" | "complete" | "failed" | "provider_not_configured";
  coverage: Record<string, string>;
  error: string | null;
  resultCount: number;
}

const TERMINAL_STATUSES = new Set(["complete", "failed", "provider_not_configured"]);

const EXAMPLES = [
  "Find translational medicine leaders at Guardant Health",
  "Who oversees biomarkers for RMC-6236?",
  "Find clinical development contacts for KRAS trials",
  "Find people involved in ctDNA or resistance monitoring at Exact Sciences",
];

export function DiscoverPanel({ topSignals }: { topSignals: TopSignalForOutreach[] }) {
  const [query, setQuery] = useState("");
  const [context, setContext] = useState<{ companyName?: string; organizationId?: string; signalId?: string; useCase?: string } | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [results, setResults] = useState<DiscoveredContactJson[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [fFunction, setFFunction] = useState("");
  const [fSeniority, setFSeniority] = useState("");
  const [fEmail, setFEmail] = useState<"any" | "has_email" | "no_email">("any");

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function run(q: string, ctx: typeof context = null) {
    setQuery(q);
    if (pollRef.current) clearInterval(pollRef.current);
    setResults([]);
    setJob({ id: "", status: "queued", coverage: {}, error: null, resultCount: 0 });

    const res = await fetch("/api/contacts/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: q, ...ctx }),
    });
    if (res.status === 401) {
      window.location.href = "/welcome";
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setJob({ id: "", status: "failed", coverage: {}, error: body.message ?? body.error ?? "Could not start the search.", resultCount: 0 });
      return;
    }
    const { jobId } = await res.json();
    poll(jobId);
  }

  function poll(jobId: string) {
    const tick = async () => {
      const r = await fetch(`/api/contacts/discover?jobId=${jobId}`);
      if (!r.ok) return;
      const data = await r.json();
      setJob(data.job);
      setResults(data.results ?? []);
      if (TERMINAL_STATUSES.has(data.job.status)) {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    };
    tick();
    pollRef.current = setInterval(tick, 2500);
  }

  const filtered = useMemo(() => {
    return results.filter((r) => {
      if (fFunction && r.function !== fFunction) return false;
      if (fSeniority && r.seniority !== fSeniority) return false;
      if (fEmail === "has_email" && !r.emailAddress) return false;
      if (fEmail === "no_email" && r.emailAddress) return false;
      return true;
    });
  }, [results, fFunction, fSeniority, fEmail]);

  return (
    <div>
      {topSignals.length ? (
        <section className="mb-8">
          <SectionLabel>High-priority signals</SectionLabel>
          <div className="mt-3 flex flex-col gap-2.5">
            {topSignals.map((s) => (
              <div key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase text-[var(--accent)]" style={{ letterSpacing: ".12em", fontFamily: "var(--font-mono)" }}>
                    {s.organizationName ?? "Unassigned"}
                  </div>
                  <div className="mt-1 text-[13.5px] text-[var(--fg)]">{s.headline}</div>
                  {s.whyNow ? <div className="mt-1 text-[12px] text-[var(--muted)]">{s.whyNow}</div> : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--faint)]">
                    {s.sourceDate ? <span>{s.sourceDate}</span> : null}
                    <span>Opportunity score {s.opportunityScore ?? "—"}</span>
                    {s.sourceUrl ? (
                      <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--accent)] underline decoration-dotted">
                        Source <ExternalLink size={10} />
                      </a>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const ctx = { companyName: s.organizationName ?? undefined, organizationId: s.organizationId ?? undefined, signalId: s.id, useCase: s.headline.slice(0, 120) };
                    setContext(ctx);
                    run(`Find relevant contacts at ${s.organizationName ?? "this company"} for: ${s.headline}`, ctx);
                  }}
                  className="shrink-0 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold"
                  style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
                >
                  Find relevant contacts
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionLabel>Search for contacts</SectionLabel>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(query, context);
          }}
          className="panel-glass mt-3 flex items-center gap-3 px-4 py-3.5"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find translational medicine leaders at [company], or who oversees biomarkers for [asset]…"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--fg)] outline-none placeholder:text-[var(--faint)]"
          />
          <button type="submit" className="shrink-0 rounded-[10px] px-4 py-2 text-[12.5px] font-semibold" style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}>
            Search
          </button>
        </form>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => { setContext(null); run(ex); }} className="rounded-full border px-3 py-1.5 text-[12px] text-[var(--muted)] hover:text-[var(--fg)]" style={{ borderColor: "rgba(150,185,255,.16)" }}>
              {ex}
            </button>
          ))}
        </div>

        {job ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <select value={fFunction} onChange={(e) => setFFunction(e.target.value)} className="rounded-[8px] border bg-transparent px-2.5 py-1.5 text-[12px] text-[var(--muted)]" style={{ borderColor: "var(--card-border)" }}>
              <option value="">Any function</option>
              {["translational_medicine", "biomarker_development", "precision_medicine", "companion_diagnostics", "clinical_development", "clinical_operations", "program_leadership", "external_innovation", "medical_affairs", "business_development", "executive", "other"].map((f) => (
                <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
              ))}
            </select>
            <select value={fSeniority} onChange={(e) => setFSeniority(e.target.value)} className="rounded-[8px] border bg-transparent px-2.5 py-1.5 text-[12px] text-[var(--muted)]" style={{ borderColor: "var(--card-border)" }}>
              <option value="">Any seniority</option>
              {["c_suite", "svp", "vp", "head", "director", "senior_manager", "manager", "scientist", "individual_contributor"].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
            <select value={fEmail} onChange={(e) => setFEmail(e.target.value as never)} className="rounded-[8px] border bg-transparent px-2.5 py-1.5 text-[12px] text-[var(--muted)]" style={{ borderColor: "var(--card-border)" }}>
              <option value="any">Any email status</option>
              <option value="has_email">Has an email</option>
              <option value="no_email">No email found</option>
            </select>
          </div>
        ) : null}

        <div className="mt-5">
          <JobStatus job={job} />
        </div>

        {filtered.length ? (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => (
              <ContactCard key={r.id} model={discoveredContactToViewModel(r)} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function JobStatus({ job }: { job: JobState | null }) {
  if (!job) return null;
  if (job.status === "queued" || job.status === "running") {
    return <p className="text-[13px] text-[var(--muted)]">Searching public sources — this can take up to a minute…</p>;
  }
  if (job.status === "provider_not_configured") {
    return (
      <p className="text-[13px]" style={{ color: "#F0866A" }}>
        Research provider is not configured. {job.error}
      </p>
    );
  }
  if (job.status === "failed") {
    return (
      <p className="text-[13px]" style={{ color: "#F0866A" }}>
        Research failed. {job.error}
      </p>
    );
  }
  if (job.resultCount === 0) {
    return <p className="text-[13px] text-[var(--muted)]">No supported contacts were found for this search — try broadening it, or check back after the next refresh.</p>;
  }
  const coverageNotes = Object.entries(job.coverage).filter(([, v]) => v === "unavailable");
  return (
    <div className="flex flex-wrap items-center gap-2">
      {job.status === "partial" ? <Pill tone="warning">Partial results</Pill> : null}
      {coverageNotes.map(([k]) => (
        <Pill key={k} tone="neutral">{k} unavailable — used other sources</Pill>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10.5px] uppercase" style={{ letterSpacing: ".22em", color: "#B7BFD8", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
      {children}
    </h2>
  );
}
