import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getActiveTenant } from "@/lib/tenant";
import { getTrialByNct } from "@/lib/queries";
import { formatRelativeDays } from "@/lib/utils";
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

  const flags = [
    trial.molecularEligibility && ["Molecular eligibility required", "high"],
    trial.ctdnaMentions && ["ctDNA / liquid biopsy", "info"],
    trial.mrdMentions && ["MRD language", "info"],
    trial.ngsMentions && ["NGS / genomic profiling", "neutral"],
    trial.serialSamplingMentions && ["Serial specimen collection", "neutral"],
    trial.resistanceMonitoringMentions && ["Resistance monitoring", "info"],
    trial.centralLabMentions && ["Central lab testing", "neutral"],
  ].filter(Boolean) as [string, string][];

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
                value: trial.primaryCompletionDate
                  ? new Date(trial.primaryCompletionDate).toISOString().slice(0, 7)
                  : "—",
                label: "Primary completion",
              },
              {
                value: formatRelativeDays(trial.lastCtgovUpdate),
                label: "Record updated",
              },
            ]}
          />
        </div>
      </header>

      <section className="border-l-2 py-1 pl-5 mt-8" style={{ borderColor: "var(--accent)" }}>
        <div className="eyebrow mb-2">Commercial relevance</div>
        <p className="prose-tight max-w-[62ch]">{trial.commercialSummary}</p>
        {flags.length ? (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {flags.map(([label, tone]) => (
              <Pill key={label} tone={tone as "high" | "info" | "neutral"}>
                {label}
              </Pill>
            ))}
          </div>
        ) : null}
        {trial.biomarkerRequirements.length ? (
          <div className="mt-5">
            <div className="eyebrow mb-2">Biomarker requirement language</div>
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
              No changes detected yet. The first refresh records a baseline
              snapshot; subsequent refreshes generate field-level changes.
            </p>
          ) : (
            <ol className="flex flex-col">
              {changes.map((c) => (
                <li
                  key={c.id}
                  className="flex gap-4 border-b py-3 first:pt-0 last:border-0"
                  style={{ borderColor: "var(--hairline)" }}
                >
                  <span className="eyebrow w-12 shrink-0 pt-0.5">
                    {new Date(c.detectedAt).toISOString().slice(5, 10)}
                  </span>
                  <span className="text-[13px] leading-relaxed">
                    {c.summary}
                    <span className="meta ml-2 text-[11.5px]">
                      {c.severity} · relevance {c.commercialRelevance}
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
