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
 * "Why now" — a recognizable recurring element (spec §136). Gradient-tint rule
 * with the blue diamond and a mono-cap label; the trigger, set apart.
 */
export function WhyNow({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("why-now flex items-start gap-2.5 px-3.5 py-2.5", className)}>
      <span
        className="mt-[7px] h-1 w-1 shrink-0 rotate-45"
        style={{ background: "var(--accent)" }}
      />
      <span className="text-[13.5px] leading-[1.55] text-[var(--color-navy-800)]">
        <span
          className="mr-2 align-[1px] text-[10.5px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--accent)" }}
        >
          Why now
        </span>
        {children}
      </span>
    </div>
  );
}

/** Opportunity score — a serif figure with a component breakdown (spec §137). */
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
  const px = size === "lg" ? "2.4rem" : size === "sm" ? "1.35rem" : "1.9rem";
  const scoreColor =
    tone === "high"
      ? "var(--color-navy-800)"
      : tone === "medium"
        ? "var(--color-blue-600)"
        : "var(--color-ink-500)";

  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className="tnum font-medium leading-none"
        style={{ fontFamily: "var(--font-serif)", fontSize: px, letterSpacing: "-0.02em", color: scoreColor }}
      >
        {value}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
          {tone === "high" ? "High priority" : "Opportunity"}
        </span>
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
    <div className="mt-2.5 flex w-[236px] flex-col gap-1.5">
      {rows.map((key) => {
        const val = breakdown[key] ?? 0;
        const max = COMPONENT_MAX[key];
        return (
          <div key={key} className="flex items-center gap-3 text-[11px]">
            <span className="w-[92px] shrink-0 text-left text-[var(--muted)]">
              {COMPONENT_LABEL[key]}
            </span>
            <span
              className="h-[5px] flex-1 overflow-hidden rounded"
              style={{ background: "#edf1fa" }}
            >
              <span
                className="grow-bar block h-full rounded"
                style={{
                  width: `${(val / max) * 100}%`,
                  background: "linear-gradient(90deg,#3a6ee0,#1b4fd8)",
                }}
              />
            </span>
            <span
              className="w-8 shrink-0 text-right text-[var(--fg)]"
              style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
            >
              {val}
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
