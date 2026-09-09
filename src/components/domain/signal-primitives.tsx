import { cn } from "@/lib/utils";
import { signalMeta } from "@/lib/signals/taxonomy";

/** Signal category identifier — a small glowing dot + label. */
export function SignalBadge({ signalType }: { signalType: string }) {
  const meta = signalMeta(signalType);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-[2px] text-[11px]"
      style={{ color: "var(--accent)", background: "var(--accent-tint)" }}
    >
      {meta.label}
    </span>
  );
}

/**
 * "Why now" — a recognizable recurring element (spec §136). Glowing diamond +
 * mono cap label, set inline with the trigger.
 */
export function WhyNow({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("why-now", className)}>
      <span className="diamond mt-[6px]" style={{ width: 4, height: 4 }} />
      <span className="text-[13px] leading-[1.55] text-[var(--muted)]">
        <span
          className="mr-2 text-[10px] uppercase"
          style={{ letterSpacing: ".18em", color: "var(--accent)", fontFamily: "var(--font-mono)" }}
        >
          Why now
        </span>
        {children}
      </span>
    </div>
  );
}

/** Opportunity score — serif-300 figure + label, with an optional breakdown. */
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
  const tone = value >= 85 ? "high" : value >= 60 ? "medium" : "neutral";
  const px = size === "lg" ? "2.25rem" : size === "sm" ? "1.35rem" : "1.65rem";
  const color =
    tone === "high" ? "var(--accent)" : tone === "medium" ? "var(--muted)" : "var(--faint)";

  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className="tnum leading-none"
        style={{ fontFamily: "var(--font-serif)", fontSize: px, fontWeight: 300, color }}
      >
        {value}
      </span>
      <span
        className="text-[9.5px] uppercase"
        style={{ letterSpacing: ".14em", color: "#6B7398", fontFamily: "var(--font-mono)" }}
      >
        {tone === "high" ? "Critical" : tone === "medium" ? "Priority" : "Watch"}
      </span>
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
              className="h-[4px] flex-1 overflow-hidden rounded"
              style={{ background: "rgba(150,185,255,.12)" }}
            >
              <span
                className="grow-bar block h-full rounded"
                style={{
                  width: `${(val / max) * 100}%`,
                  background: "linear-gradient(90deg,#5A7FE8,#8FD3FF)",
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
