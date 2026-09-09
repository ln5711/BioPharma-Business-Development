import { cn } from "@/lib/utils";
import { signalMeta } from "@/lib/signals/taxonomy";

/** Small consistent identifier per signal category (spec §135) — a dot + label. */
export function SignalBadge({ signalType }: { signalType: string }) {
  const meta = signalMeta(signalType);
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-[var(--muted)]">
      <span
        className="h-[5px] w-[5px] rounded-full"
        style={{ background: categoryColor(meta.category) }}
      />
      {meta.label}
    </span>
  );
}

function categoryColor(category: string): string {
  const map: Record<string, string> = {
    clinical_trial: "var(--color-blue-500)",
    publication: "var(--color-teal-600)",
    regulatory: "var(--color-warning)",
    corporate: "var(--color-ink-400)",
    leadership: "var(--color-sky-300)",
    conference: "var(--color-blue-400)",
    partnership: "var(--color-positive)",
    relationship: "var(--color-priority-medium)",
    crm: "var(--color-ink-400)",
  };
  return map[category] ?? "var(--color-ink-400)";
}

/**
 * "Why now" — a recognizable recurring element (spec §136). A thin accent rule
 * and a serif-italic aside; the trigger, set apart like a pull quote.
 */
export function WhyNow({ children, className }: { children: string; className?: string }) {
  return (
    <p
      className={cn(
        "border-l-2 py-0.5 pl-3 text-[13px] leading-relaxed",
        className,
      )}
      style={{ borderColor: "var(--accent)", color: "var(--fg)" }}
    >
      <span className="eyebrow mr-2 align-[0.08em]">Why now</span>
      <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
        {children}
      </span>
    </p>
  );
}

/** Opportunity score — a serif figure with an expandable component breakdown (spec §137). */
export function OpportunityScore({
  score,
  breakdown,
  size = "md",
}: {
  score: number | null | undefined;
  breakdown?: Record<string, number>;
  size?: "sm" | "md" | "lg";
}) {
  const value = score ?? 0;
  const tone = value >= 75 ? "high" : value >= 55 ? "medium" : "neutral";
  const px = size === "lg" ? "2.6rem" : size === "sm" ? "1.4rem" : "2rem";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-baseline gap-1.5">
        <span
          className="tnum font-medium leading-none"
          style={{ fontFamily: "var(--font-serif)", fontSize: px, letterSpacing: "-0.01em" }}
        >
          {value}
        </span>
        <span className="text-[11px] text-[var(--faint)]">/100</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="eyebrow">Opportunity</span>
        {tone === "high" ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-priority-high)]">
            High
          </span>
        ) : null}
      </div>
      {breakdown ? <ScoreBreakdown breakdown={breakdown} /> : null}
    </div>
  );
}

const COMPONENT_MAX: Record<string, number> = {
  commercialFit: 25,
  clinicalTiming: 20,
  biomarkerNeed: 20,
  relationshipAccessibility: 10,
  signalStrength: 10,
  accountStrategicValue: 10,
  urgency: 5,
};

const COMPONENT_LABEL: Record<string, string> = {
  commercialFit: "Commercial fit",
  clinicalTiming: "Clinical timing",
  biomarkerNeed: "Biomarker need",
  relationshipAccessibility: "Relationship",
  signalStrength: "Signal strength",
  accountStrategicValue: "Account value",
  urgency: "Urgency",
};

export function ScoreBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const rows = Object.keys(COMPONENT_MAX).filter((k) => k in breakdown);
  if (!rows.length) return null;
  return (
    <div className="mt-2 flex w-[220px] flex-col gap-[5px]">
      {rows.map((key) => {
        const val = breakdown[key] ?? 0;
        const max = COMPONENT_MAX[key];
        return (
          <div key={key} className="flex items-center gap-2 text-[11px]">
            <span className="w-[92px] shrink-0 text-left text-[var(--muted)]">
              {COMPONENT_LABEL[key]}
            </span>
            <span
              className="h-[3px] flex-1 overflow-hidden rounded-full"
              style={{ background: "color-mix(in oklab, var(--fg) 8%, transparent)" }}
            >
              <span
                className="block h-full rounded-full"
                style={{ width: `${(val / max) * 100}%`, background: "var(--accent)" }}
              />
            </span>
            <span className="tnum w-8 shrink-0 text-right text-[var(--faint)]">
              {val}/{max}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Confidence — visually distinct from the opportunity score (spec §138). */
export function ConfidenceIndicator({ confidence }: { confidence: number | null | undefined }) {
  const v = confidence ?? 0;
  const label = v >= 80 ? "High" : v >= 55 ? "Moderate" : "Low";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--muted)]">
      <span className="eyebrow">Confidence</span>
      <span className="tnum font-medium text-[var(--fg)]">
        {label} · {v}%
      </span>
    </span>
  );
}
