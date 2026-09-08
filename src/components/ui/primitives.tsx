import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A surface, when a surface is warranted — not everything needs one (spec §130). */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("card fade-in", className)}>{children}</div>;
}

/** Editorial page masthead: kicker · serif title · standfirst, closed by a rule. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 border-b pb-5">
      <div className="flex items-end justify-between gap-8">
        <div className="min-w-0">
          {eyebrow ? <div className="eyebrow mb-2">{eyebrow}</div> : null}
          <h1 className="display-lg">{title}</h1>
          {description ? (
            <p className="meta mt-2.5 max-w-[52ch] leading-relaxed">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

/** Section label above a block of content. */
export function SectionHeading({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 className="eyebrow">{children}</h2>
      {aside ? <div className="meta">{aside}</div> : null}
    </div>
  );
}

export function Stat({
  value,
  label,
  tone = "default",
}: {
  value: ReactNode;
  label: string;
  tone?: "default" | "accent";
}) {
  return (
    <div>
      <div
        className="metric-number"
        style={tone === "accent" ? { color: "var(--accent)" } : undefined}
      >
        {value}
      </div>
      <div className="eyebrow mt-1.5">{label}</div>
    </div>
  );
}

/** "By the numbers" strip — figures separated by hairlines, journal-style. */
export function StatRail({
  items,
}: {
  items: { value: ReactNode; label: string; tone?: "default" | "accent" }[];
}) {
  return (
    <div className="flex flex-wrap items-stretch">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={cn("pr-8", i > 0 && "border-l pl-8")}
        >
          <Stat value={it.value} label={it.label} tone={it.tone} />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  // States what the system can do — never "Nothing here yet!" (spec §150).
  return (
    <div className="border-l-2 py-1 pl-5" style={{ borderColor: "var(--hairline)" }}>
      <div className="display-md mb-2">{title}</div>
      <p className="meta max-w-[54ch] leading-relaxed">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="rule my-8" />;
  return (
    <div className="my-8 flex items-center gap-3">
      <span className="eyebrow">{label}</span>
      <hr className="rule flex-1" />
    </div>
  );
}

const TONE_CLASS: Record<string, string> = {
  high: "text-[var(--color-priority-high)] border-[color-mix(in_oklab,var(--color-priority-high)_30%,transparent)]",
  medium: "text-[var(--color-priority-medium)] border-[color-mix(in_oklab,var(--color-priority-medium)_35%,transparent)]",
  positive: "text-[var(--color-positive)] border-[color-mix(in_oklab,var(--color-positive)_30%,transparent)]",
  warning: "text-[var(--color-warning)] border-[color-mix(in_oklab,var(--color-warning)_30%,transparent)]",
  critical: "text-[var(--color-critical)] border-[color-mix(in_oklab,var(--color-critical)_30%,transparent)]",
  info: "text-[var(--color-info)] border-[color-mix(in_oklab,var(--color-info)_30%,transparent)]",
  neutral: "text-[var(--muted)] border-[var(--hairline)]",
};

/** Understated label chip — thin outline, no fill (spec §154). */
export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof TONE_CLASS;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-1.5 py-[1px] text-[10.5px] font-medium tracking-wide",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
