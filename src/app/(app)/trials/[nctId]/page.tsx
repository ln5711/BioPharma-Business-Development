import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getActiveTenant } from "@/lib/tenant";
import { getTrialByNct } from "@/lib/queries";
import { formatRelativeDays } from "@/lib/utils";
import { Card, Pill } from "@/components/ui/primitives";
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
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/trials" className="meta hover:text-[var(--fg)]">
          ← Trials
        </Link>
        <div className="mt-2 flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] text-[var(--accent)]">
                {trial.nctId}
              </span>
              <Pill tone="neutral">{trial.phase.replace(/_/g, " ")}</Pill>
              <Pill tone="neutral">{trial.status.replace(/_/g, " ")}</Pill>
            </div>
            <h1 className="display-lg mt-2 max-w-3xl text-[26px]">{trial.title}</h1>
            <p className="meta mt-2">
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
            className="inline-flex shrink-0 items-center gap-1 rounded-md border px-3 py-1.5 text-[12.5px]"
          >
            ClinicalTrials.gov <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <div className="eyebrow">Enrollment</div>
          <div className="metric-number mt-1 text-[22px]">{trial.enrollment ?? "—"}</div>
          <div className="meta">{trial.enrollmentType?.toLowerCase() ?? ""}</div>
        </Card>
        <Card className="p-4">
          <div className="eyebrow">Countries</div>
          <div className="metric-number mt-1 text-[22px]">{trial.countries.length || "—"}</div>
          <div className="meta">{trial.locationCount ?? 0} sites</div>
        </Card>
        <Card className="p-4">
          <div className="eyebrow">Primary completion</div>
          <div className="mt-1 text-[15px] font-medium">
            {trial.primaryCompletionDate
              ? new Date(trial.primaryCompletionDate).toISOString().slice(0, 10)
              : "—"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="eyebrow">Record updated</div>
          <div className="mt-1 text-[15px] font-medium">
            {formatRelativeDays(trial.lastCtgovUpdate)}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="eyebrow mb-2">Commercial relevance</div>
        <p className="text-[14px] leading-relaxed">{trial.commercialSummary}</p>
        {flags.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {flags.map(([label, tone]) => (
              <Pill key={label} tone={tone as "high" | "info" | "neutral"}>
                {label}
              </Pill>
            ))}
          </div>
        ) : null}
        {trial.biomarkerRequirements.length ? (
          <div className="mt-4">
            <div className="eyebrow mb-1.5">Biomarker requirement language</div>
            <ul className="flex flex-col gap-1 text-[13px] text-[var(--muted)]">
              {trial.biomarkerRequirements.map((b, i) => (
                <li key={i}>• {b}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="eyebrow mb-3">Change timeline</div>
          {changes.length === 0 ? (
            <p className="meta">
              No changes detected yet. The first refresh records a baseline
              snapshot; subsequent refreshes generate field-level changes.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {changes.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <span className="eyebrow w-16 shrink-0 pt-0.5">
                    {new Date(c.detectedAt).toISOString().slice(5, 10)}
                  </span>
                  <span>
                    <span className="text-[13px]">{c.summary}</span>
                    <span className="meta ml-2">
                      {c.severity} · relevance {c.commercialRelevance}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="p-5">
          <div className="eyebrow mb-3">Signals from this trial</div>
          {signals.length === 0 ? (
            <p className="meta">No commercial signals generated yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {signals.map((s) => (
                <li key={s.id} className="border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <SignalBadge signalType={s.signalType} />
                    <OpportunityScore score={s.opportunityScore} size="sm" />
                  </div>
                  <p className="mt-1 text-[13px]">{s.factSummary}</p>
                  {s.whyNow ? <p className="meta mt-1">{s.whyNow}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="eyebrow mb-2">Eligibility (raw, for validation)</div>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--muted)]">
          {trial.eligibilityText ?? "Not provided in the public record."}
        </pre>
      </Card>
    </div>
  );
}
