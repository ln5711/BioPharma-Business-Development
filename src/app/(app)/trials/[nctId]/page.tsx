import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getActiveTenant } from "@/lib/tenant";
import { getTrialByNct } from "@/lib/queries";
import { formatDate, formatRelativeDays } from "@/lib/utils";
import { explainTrialFlags } from "@/lib/oncology/flag-evidence";
import { Pill, StatRail } from "@/components/ui/primitives";
import {
  OpportunityScore,
  SignalBadge,
} from "@/components/domain/signal-primitives";

export const dynamic = "force-dynamic";

/** Commercially-framed trial view (spec §141) — not a ClinicalTrials.gov clone. */
export default async function TrialPage({
  params,
}: {
  params: Promise<{ nctId: string }>;
}) {
  const { nctId } = await params;
  const { tenant } = await getActiveTenant();
  const data = await getTrialByNct(tenant.id, nctId);
  if (!data) notFound();
  const { trial, changes, signals } = data;

  const flagEvidence = explainTrialFlags(trial);
  const confidentFlags = flagEvidence.filter((f) => f.flagged && f.evidenced);
  const inferredFlags = flagEvidence.filter((f) => f.flagged && !f.evidenced);

  const flagTone: Record<string, "high" | "info" | "neutral"> = {
    molecularEligibility: "high",
    ctdnaMentions: "info",
    mrdMentions: "info",
    resistanceMonitoringMentions: "info",
    ngsMentions: "neutral",
    serialSamplingMentions: "neutral",
    centralLabMentions: "neutral",
  };

  return (
    <div>
      <Link href="/trials" className="meta hover:text-[var(--fg)]">
        ← Trials
      </Link>

      <header className="mt-3 border-b pb-6">
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12px] text-[var(--accent)]">
                {trial.nctId}
              </span>
              <Pill tone="neutral">{trial.phase.replace(/_/g, " ")}</Pill>
              <Pill tone="neutral">{trial.status.replace(/_/g, " ")}</Pill>
            </div>
            <h1 className="display-lg mt-3 max-w-[40ch]">{trial.title}</h1>
            <p className="meta mt-2.5">
              {trial.sponsorName}
              {trial.collaborators.length
                ? ` · with ${trial.collaborators.join(", ")}`
                : ""}
            </p>
          </div>
          <a
            href={`https://clinicaltrials.gov/study/${trial.nctId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] border px-3 py-1.5 text-[12px] text-[var(--muted)] hover:text-[var(--fg)]"
            style={{ borderColor: "var(--hairline)" }}
          >
            ClinicalTrials.gov <ExternalLink size={11} />
          </a>
        </div>

        <div className="mt-6">
          <StatRail
            items={[
              {
                value: trial.enrollment ?? "—",
                label: `Enrollment${trial.enrollmentType ? ` · ${trial.enrollmentType.toLowerCase()}` : ""}`,
              },
              {
                value: trial.countries.length || "—",
                label: `Countries · ${trial.locationCount ?? 0} sites`,
              },
              {
                value: trial.startDate ? formatDate(trial.startDate) : "—",
                label: "Study start",
              },
              {
                value: trial.primaryCompletionDate
                  ? formatDate(trial.primaryCompletionDate)
                  : "—",
                label: "Primary completion",
              },
            ]}
          />
        </div>
      </header>

      {/* ── Data provenance — every date labelled for what it actually is ── */}
      <section className="mt-6">
        <div className="eyebrow mb-2.5">Data provenance</div>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["First posted", trial.firstPostedDate, "ClinicalTrials.gov “Study First Posted”"],
            ["Last CT.gov update", trial.lastCtgovUpdate, "ClinicalTrials.gov “Last Update Posted”"],
            ["Imported into newwin", trial.firstSeenAt, "when newwin first saved this record"],
            ["Last checked by newwin", trial.lastRefreshedAt, "when newwin last read ClinicalTrials.gov"],
          ].map(([label, value, hint]) => (
            <div key={label as string}>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]" style={{ fontFamily: "var(--font-mono)" }}>
                {label as string}
              </dt>
              <dd className="mt-1 text-[13px] text-[var(--fg)]">
                {value ? formatDate(value as Date) : "—"}
                {value ? (
                  <span className="meta ml-1.5 text-[11.5px]">({formatRelativeDays(value as Date)})</span>
                ) : null}
              </dd>
              <dd className="mt-0.5 text-[11px] leading-snug text-[var(--faint)]">{hint as string}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Study facts — BD-relevant, not a CT.gov clone ── */}
      <section className="mt-8">
        <div className="eyebrow mb-2.5">Study facts</div>
        <dl className="grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2">
          <Fact label="Interventions / assets" value={trial.interventionsRaw.map((i) => i.name).filter(Boolean).join(", ")} />
          <Fact label="Conditions" value={trial.conditionsRaw.join(", ")} />
          <Fact label="Sponsor" value={[trial.sponsorName, ...trial.collaborators].filter(Boolean).join(" · ")} />
          <Fact label="Overall completion (est.)" value={trial.completionDate ? formatDate(trial.completionDate) : ""} />
          <Fact label="Primary endpoints" value={trial.primaryEndpoints.slice(0, 4).join("; ")} />
          <Fact
            label="Recruiting locations"
            value={
              trial.locationCount
                ? `${trial.locationCount} site${trial.locationCount === 1 ? "" : "s"} · ${trial.countries.slice(0, 6).join(", ") || "countries not listed"}`
                : ""
            }
          />
        </dl>
      </section>

      <section className="border-l-2 py-1 pl-5 mt-8" style={{ borderColor: "var(--accent)" }}>
        <div className="eyebrow mb-2">Commercial relevance</div>
        <p className="prose-tight max-w-[62ch]">{trial.commercialSummary}</p>

        {confidentFlags.length ? (
          <div className="mt-4 flex flex-col gap-3">
            {confidentFlags.map((f) => (
              <div key={f.key}>
                <Pill tone={flagTone[f.key] ?? "neutral"}>{f.label}</Pill>
                <p className="mt-1.5 max-w-[62ch] text-[12px] leading-relaxed text-[var(--muted)]">
                  <span className="text-[var(--faint)]">Detected in trial text</span>
                  {f.sourceField ? <span className="text-[var(--faint)]"> · {f.sourceField}</span> : null}
                  {f.excerpt ? <>: “{f.excerpt}”</> : null}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {inferredFlags.length ? (
          <p className="mt-4 max-w-[62ch] text-[12px] leading-relaxed text-[var(--faint)]">
            newwin inference (no explicit supporting sentence found in the public record):{" "}
            {inferredFlags.map((f) => f.label).join(", ")}. Not shown as a confirmed pill.
          </p>
        ) : null}

        {!confidentFlags.length && !inferredFlags.length ? (
          <p className="mt-3 text-[12px] text-[var(--faint)]">
            No biomarker / molecular-testing language identified in the public record.
          </p>
        ) : null}

        {trial.biomarkerRequirements.length ? (
          <div className="mt-5">
            <div className="eyebrow mb-2">Biomarker requirement language</div>
            <p className="mb-2 text-[11px] text-[var(--faint)]">
              Lines extracted from the eligibility criteria — source text, not a structured field.
            </p>
            <ul className="flex max-w-[62ch] flex-col gap-1.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
              {trial.biomarkerRequirements.map((b, i) => (
                <li key={i} className="flex gap-2.5">
                  <span
                    aria-hidden
                    className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full"
                    style={{ background: "var(--accent-2)" }}
                  />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <div className="eyebrow mb-4">Change timeline</div>
          {changes.length === 0 ? (
            <p className="meta max-w-[46ch] leading-relaxed">
              No changes detected yet. The first import records a baseline
              snapshot — it is not counted as a change. Subsequent refreshes that
              differ generate field-level entries below.
            </p>
          ) : (
            <ol className="flex flex-col">
              {changes.map((c) => (
                <li
                  key={c.id}
                  className="flex gap-4 border-b py-3 first:pt-0 last:border-0"
                  style={{ borderColor: "var(--hairline)" }}
                >
                  <span className="eyebrow w-20 shrink-0 pt-0.5">
                    {formatDate(c.sourceTimestamp ?? c.detectedAt)}
                  </span>
                  <span className="text-[13px] leading-relaxed">
                    {c.summary}
                    <span className="meta ml-2 block text-[11.5px]">
                      {c.severity} · relevance {c.commercialRelevance}
                      {" · "}
                      {c.sourceTimestamp
                        ? `CT.gov ${formatDate(c.sourceTimestamp)}, detected by newwin ${formatDate(c.detectedAt)}`
                        : `detected by newwin ${formatDate(c.detectedAt)}`}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <div className="eyebrow mb-4">Signals from this trial</div>
          {signals.length === 0 ? (
            <p className="meta">No commercial signals generated yet.</p>
          ) : (
            <ul className="flex flex-col">
              {signals.map((s) => (
                <li
                  key={s.id}
                  className="border-b py-3.5 first:pt-0 last:border-0"
                  style={{ borderColor: "var(--hairline)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <SignalBadge signalType={s.signalType} />
                    <OpportunityScore score={s.opportunityScore} size="sm" />
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed">{s.factSummary}</p>
                  {s.whyNow ? (
                    <p className="meta mt-1 text-[11.5px]">{s.whyNow}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-10 border-t pt-6">
        <div className="eyebrow mb-3">Eligibility — raw, for validation</div>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-[var(--muted)]">
          {trial.eligibilityText ?? "Not provided in the public record."}
        </pre>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]" style={{ fontFamily: "var(--font-mono)" }}>
        {label}
      </dt>
      <dd className="mt-1 max-w-[46ch] text-[var(--fg)]">{value || "—"}</dd>
    </div>
  );
}
