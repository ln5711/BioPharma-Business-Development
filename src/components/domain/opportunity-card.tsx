import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SignalRow } from "@/lib/queries";
import { signalMeta } from "@/lib/signals/taxonomy";
import {
  ConfidenceIndicator,
  OpportunityScore,
  WhyNow,
} from "@/components/domain/signal-primitives";

/**
 * Signature component (spec §134) — a briefing entry: hanging serif index,
 * a serif headline, a blue type chip, the score in a bordered lift-card,
 * fact + commercial read as prose, and the "why now" trigger set apart.
 */
export function OpportunityCard({
  signal,
  index,
}: {
  signal: SignalRow;
  index?: number;
}) {
  const meta = signalMeta(signal.signalType);
  const href = signal.trialNctId
    ? `/trials/${signal.trialNctId}`
    : signal.organizationId
      ? `/accounts/${signal.organizationId}`
      : "/signals";

  return (
    <article className="fade-in grid grid-cols-[0_1fr] gap-x-6 border-b py-[26px] sm:grid-cols-[2.6rem_1fr]">
      <div
        aria-hidden
        className="tnum hidden pt-1 text-right text-[13px] sm:block"
        style={{ fontFamily: "var(--font-serif)", color: "#97a5bc" }}
      >
        {index != null ? String(index).padStart(2, "0") : ""}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1 basis-[340px]">
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.15em]"
              style={{ color: "var(--muted)" }}
            >
              {signal.organizationName ?? "Unresolved sponsor"}
            </div>
            <h3 className="mt-[7px] text-[21px] leading-[1.28]" style={{ fontFamily: "var(--font-serif)", fontWeight: 500, letterSpacing: "-0.012em" }}>
              <Link href={href} className="hover:text-[var(--accent)]">
                {signal.headline}
              </Link>
            </h3>
            <div className="mt-[11px] flex flex-wrap items-center gap-2.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-[3px] text-[11px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: "var(--color-navy-800)", background: "var(--color-sky-100)", borderColor: "#d3e0fa" }}
              >
                <span className="h-[5px] w-[5px] rotate-45" style={{ background: "var(--accent)" }} />
                {meta.label}
              </span>
              {signal.trialNctId ? (
                <span className="text-[11.5px] text-[var(--muted)]" style={{ fontFamily: "var(--font-mono)" }}>
                  {signal.trialNctId}
                </span>
              ) : null}
            </div>
          </div>

          <div className="card card-lift shrink-0 px-3.5 py-2.5 text-right">
            <OpportunityScore
              score={signal.opportunityScore}
              breakdown={signal.scoreBreakdown as Record<string, number>}
            />
          </div>
        </div>

        <p className="mt-4 max-w-[66ch] text-[14.5px] leading-[1.62]">
          {signal.factSummary}{" "}
          <span className="text-[var(--muted)]">
            {signal.whyItMatters ?? signal.commercialInterpretation}
          </span>
        </p>

        {signal.whyNow ? (
          <WhyNow className="mt-4 max-w-[66ch]">{signal.whyNow}</WhyNow>
        ) : null}

        <div className="mt-[18px] flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <ConfidenceIndicator confidence={signal.confidenceScore} />
            <span className="meta text-[11.5px]">
              {meta.personas
                .slice(0, 3)
                .map((p) => p.replace(/_/g, " "))
                .join(" · ")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/outreach?signal=${signal.id}`}
              className="rounded-[9px] border bg-[var(--panel)] px-3.5 py-2.5 text-[12.5px] font-medium text-[var(--color-ink-700)] transition-colors hover:border-[var(--color-sky-300)] hover:bg-[var(--panel-2)]"
              style={{ borderColor: "#dce6f6" }}
            >
              Draft outreach
            </Link>
            <Link
              href={href}
              className="inline-flex items-center gap-1 rounded-[9px] px-3.5 py-2.5 text-[12.5px] font-medium text-white transition-transform hover:-translate-y-px"
              style={{ background: "var(--accent)", boxShadow: "var(--btn-shadow)" }}
            >
              Review opportunity <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {signal.recommendedAction ? (
          <p className="meta mt-3.5 max-w-[66ch] border-t pt-3 text-[12px]">
            <span className="eyebrow mr-2">Next</span>
            {signal.recommendedAction}
          </p>
        ) : null}
      </div>
    </article>
  );
}
