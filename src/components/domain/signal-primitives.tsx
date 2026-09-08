import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { signalMeta } from "@/lib/signals/taxonomy";
import { Pill } from "@/components/ui/primitives";

/** Small consistent identifier per signal category (spec §135). */
export function SignalBadge({ signalType }: { signalType: string }) {
  const meta = signalMeta(signalType);
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: categoryColor(meta.category) }}
      />
      {meta.label}
    </span>
  );
}

function categoryColor(category: string): string {
  const map: Record<string, string> = {
    clinical_trial: "var(--color-violet-500)",
    publication: "var(--color-info)",
    regulatory: "var(--color-warning)",
    corporate: "var(--color-ink-400)",
    leadership: "var(--color-lavender-300)",
    conference: "var(--color-violet-400)",
    partnership: "var(--color-positive)",
    relationship: "var(--color-priority-medium)",
    crm: "var(--color-ink-400)",
  };
  return map[category] ?? "var(--color-ink-400)";
}

/**
 * "WHY NOW" — a recognizable component used everywhere a trigger appears
 * (spec §136 — "core intellectual property of the UX").
 */
export function WhyNow({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md px-3 py-2 text-[13px]",
        className,
      )}
      style={{ background: "var(--color-lavender-50)", color: "var(--color-plum-800)" }}
    >
      <Zap size={14} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
      <span>
        <span className="eyebrow mr-2 align-middle">Why now</span>
        {children}
      </span>
    </div>
  );
}

/** Opportunity score — a number with an expandable component breakdown (spec §137). */
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
  const dims = size === "lg" ? "text-4xl" : size === "sm" ? "text-xl" : "text-2xl";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className={cn(dims, "font-semibold tabular-nums tracking-tight")}>
          {value}
        </span>
        <span className="eyebrow">Opportunity</span>
        {tone !== "neutral" ? (
          <Pill tone={tone === "high" ? "high" : "medium"}>
            {tone === "high" ? "High priority" : "Medium"}
          </Pill>
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
    <div className="mt-1 flex flex-col gap-1">
      {rows.map((key) => {
        const val = breakdown[key] ?? 0;
        const max = COMPONENT_MAX[key];
        return (
          <div key={key} className="flex items-center gap-2 text-[12px]">
            <span className="w-28 shrink-0 text-[var(--muted)]">
              {COMPONENT_LABEL[key]}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--panel-2)]">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${(val / max) * 100}%`,
                  background: "var(--color-violet-500)",
                }}
              />
            </span>
            <span className="w-10 shrink-0 text-right tabular-nums">
              {val}/{max}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Confidence is visually distinct from opportunity (spec §138). */
export function ConfidenceIndicator({ confidence }: { confidence: number | null | undefined }) {
  const v = confidence ?? 0;
  const label = v >= 80 ? "High" : v >= 55 ? "Moderate" : "Low";
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
      <span className="eyebrow">Confidence</span>
      <span className="font-medium text-[var(--fg)]">
        {label} · {v}%
      </span>
    </span>
  );
}
