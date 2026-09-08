import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { SignalRow } from "@/lib/queries";
import { signalMeta } from "@/lib/signals/taxonomy";
import {
  ConfidenceIndicator,
  OpportunityScore,
  SignalBadge,
  WhyNow,
} from "@/components/domain/signal-primitives";

/**
 * Signature component (spec §134). Emphasizes COMPANY · ASSET · SCORE ·
 * WHAT CHANGED · WHY IT MATTERS · WHY NOW · NEXT ACTION. Deeper detail lives
 * behind the click-through — the card does not overload.
 */
export function OpportunityCard({ signal }: { signal: SignalRow }) {
  const meta = signalMeta(signal.signalType);
  const href = signal.trialNctId
    ? `/trials/${signal.trialNctId}`
    : signal.organizationId
      ? `/accounts/${signal.organizationId}`
      : "/signals";

  return (
    <article className="card fade-in p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow">{signal.organizationName ?? "Unresolved sponsor"}</div>
          <h3 className="entity-name mt-1 text-[17px] leading-snug">
            {signal.headline}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <SignalBadge signalType={signal.signalType} />
            {signal.trialNctId ? (
              <span className="meta font-mono text-[12px]">{signal.trialNctId}</span>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <OpportunityScore
            score={signal.opportunityScore}
            breakdown={signal.scoreBreakdown as Record<string, number>}
          />
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-[13.5px] leading-relaxed sm:grid-cols-2">
        <div>
          <dt className="eyebrow mb-1">What changed · fact</dt>
          <dd>{signal.factSummary}</dd>
        </div>
        <div>
          <dt className="eyebrow mb-1">Why it matters · inference</dt>
          <dd>{signal.whyItMatters ?? signal.commercialInterpretation}</dd>
        </div>
      </dl>

      {signal.whyNow ? <WhyNow className="mt-4">{signal.whyNow}</WhyNow> : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <ConfidenceIndicator confidence={signal.confidenceScore} />
          <span className="meta">
            Personas:{" "}
            {meta.personas
              .slice(0, 3)
              .map((p) => p.replace(/_/g, " "))
              .join(", ")}
          </span>
        </div>
        <div className="flex gap-2">
          <Link
            href={href}
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[12.5px] font-medium text-white"
            style={{ background: "var(--color-violet-600)" }}
          >
            Review opportunity <ArrowUpRight size={13} />
          </Link>
          <Link
            href={`/outreach?signal=${signal.id}`}
            className="rounded-md border px-3 py-1.5 text-[12.5px] font-medium"
          >
            Draft outreach
          </Link>
        </div>
      </div>

      {signal.recommendedAction ? (
        <p className="meta mt-3">
          <span className="eyebrow mr-2">Recommended</span>
          {signal.recommendedAction}
        </p>
      ) : null}
    </article>
  );
}
