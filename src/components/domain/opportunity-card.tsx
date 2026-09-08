import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SignalRow } from "@/lib/queries";
import { signalMeta } from "@/lib/signals/taxonomy";
import {
  ConfidenceIndicator,
  OpportunityScore,
  SignalBadge,
  WhyNow,
} from "@/components/domain/signal-primitives";

/**
 * Signature component (spec §134), styled as a briefing entry rather than an
 * admin card: a hanging index, a serif headline, the fact and its commercial
 * read as flowing prose, and the trigger set apart. Detail lives behind the
 * click-through.
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
    <article className="fade-in grid grid-cols-[0_1fr] gap-x-6 py-7 sm:grid-cols-[2.5rem_1fr]">
      <div
        aria-hidden
        className="tnum hidden pt-1 text-right text-[13px] sm:block"
        style={{ fontFamily: "var(--font-serif)", color: "var(--faint)" }}
      >
        {index != null ? String(index).padStart(2, "0") : ""}
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="eyebrow mb-1.5">
              {signal.organizationName ?? "Unresolved sponsor"}
            </div>
            <h3 className="display-md leading-snug">
              <Link href={href} className="hover:text-[var(--accent)]">
                {signal.headline}
              </Link>
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <SignalBadge signalType={signal.signalType} />
              {signal.trialNctId ? (
                <span className="meta font-mono text-[11.5px] tracking-tight">
                  {signal.trialNctId}
                </span>
              ) : null}
            </div>
          </div>
          <div className="shrink-0">
            <OpportunityScore
              score={signal.opportunityScore}
              breakdown={signal.scoreBreakdown as Record<string, number>}
            />
          </div>
        </div>

        <p className="prose-tight mt-4 max-w-[64ch] text-[var(--fg)]">
          {signal.factSummary}{" "}
          <span className="text-[var(--muted)]">
            {signal.whyItMatters ?? signal.commercialInterpretation}
          </span>
        </p>

        {signal.whyNow ? <WhyNow className="mt-4">{signal.whyNow}</WhyNow> : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <ConfidenceIndicator confidence={signal.confidenceScore} />
            <span className="meta text-[11.5px]">
              {meta.personas
                .slice(0, 3)
                .map((p) => p.replace(/_/g, " "))
                .join(" · ")}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/outreach?signal=${signal.id}`}
              className="text-[12.5px] font-medium text-[var(--muted)] hover:text-[var(--fg)]"
            >
              Draft outreach
            </Link>
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent)]"
            >
              Review <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {signal.recommendedAction ? (
          <p className="meta mt-3.5 max-w-[64ch] border-t pt-3 text-[12px]">
            <span className="eyebrow mr-2">Next</span>
            {signal.recommendedAction}
          </p>
        ) : null}
      </div>
    </article>
  );
}
