import Link from "next/link";
import type { SignalRow } from "@/lib/queries";
import { signalMeta } from "@/lib/signals/taxonomy";
import {
  ConfidenceIndicator,
  OpportunityScore,
  SignalBadge,
  WhyNow,
} from "@/components/domain/signal-primitives";

/**
 * Priority-signal entry (spec §134). Org eyebrow + type chip + timestamp,
 * a serif headline, the "why now" trigger inline, and a right-aligned score
 * with a draft action.
 */
export function OpportunityCard({ signal }: { signal: SignalRow; index?: number }) {
  const meta = signalMeta(signal.signalType);
  const href = signal.trialNctId
    ? `/trials/${signal.trialNctId}`
    : signal.organizationId
      ? `/accounts/${signal.organizationId}`
      : "/signals";

  return (
    <article
      className="fade-in border-b py-5 transition-colors hover:bg-[rgba(150,185,255,.03)]"
      style={{ borderColor: "rgba(150,185,255,.09)" }}
    >
      <div className="flex flex-wrap items-start gap-[18px]">
        <div className="min-w-0 flex-1 basis-[320px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="text-[10.5px] font-semibold uppercase"
              style={{ letterSpacing: ".18em", color: "#B7BFD8" }}
            >
              {signal.organizationName ?? "Unresolved sponsor"}
            </span>
            <span className="h-1 w-1 rotate-45" style={{ background: "rgba(150,185,255,.4)" }} />
            <SignalBadge signalType={signal.signalType} />
            {signal.trialNctId ? (
              <span
                className="text-[11px] text-[var(--dim)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {signal.trialNctId}
              </span>
            ) : null}
          </div>

          <h3
            className="mt-2 text-[17.5px] leading-[1.34]"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 400, color: "#EDF1FC" }}
          >
            <Link href={href} className="hover:text-[var(--accent)]">
              {signal.headline}
            </Link>
          </h3>

          {signal.whyNow ? (
            <WhyNow className="mt-2.5 max-w-[64ch]">{signal.whyNow}</WhyNow>
          ) : (
            <p className="mt-2 max-w-[64ch] text-[13px] leading-[1.55] text-[var(--muted)]">
              {signal.factSummary}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1">
            <ConfidenceIndicator confidence={signal.confidenceScore} />
            <span className="meta text-[11.5px]">
              {meta.personas
                .slice(0, 3)
                .map((p) => p.replace(/_/g, " "))
                .join(" · ")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-[14px]">
          <OpportunityScore
            score={signal.opportunityScore}
            breakdown={signal.scoreBreakdown as Record<string, number>}
          />
          <Link
            href={`/outreach?signal=${signal.id}`}
            className="rounded-[9px] border px-3.5 py-2.5 text-[12.5px] whitespace-nowrap transition-colors"
            style={{
              borderColor: "rgba(150,185,255,.16)",
              background: "rgba(150,185,255,.05)",
              color: "#CDD5EC",
            }}
          >
            Draft
          </Link>
        </div>
      </div>
    </article>
  );
}
