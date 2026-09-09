import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A translucent surface with a hairline border; `lift` adds a hover raise. */
export function Card({
  className,
  lift,
  children,
}: {
  className?: string;
  lift?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("card fade-in", lift && "card-lift", className)}>{children}</div>
  );
}

/** A glassy gradient panel — the Pulsar signature surface. */
export function GlassPanel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("panel-glass fade-in", className)}>{children}</div>;
}

/** Page masthead: mono eyebrow · serif-300 title · standfirst. */
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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0">
        {eyebrow ? <div className="kicker">{eyebrow}</div> : null}
        <h1 className="display-lg mt-3.5">{title}</h1>
        {description ? (
          <p className="mt-3.5 max-w-[66ch] text-[15px] leading-[1.65] text-[var(--muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeading({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div
      className="mb-4 flex items-end justify-between gap-4 border-b pb-[11px]"
      style={{ borderColor: "var(--hairline)" }}
    >
      <h2
        className="text-[10.5px] font-semibold uppercase"
        style={{ letterSpacing: ".24em", color: "var(--muted)", fontFamily: "var(--font-mono)" }}
      >
        {children}
      </h2>
      {aside ? <div className="text-[12.5px] text-[var(--accent)]">{aside}</div> : null}
    </div>
  );
}

export function Stat({
  value,
  label,
  width,
  tone = "default",
}: {
  value: ReactNode;
  label: string;
  /** 0–100 bar fill; omit to hide the bar. */
  width?: number;
  tone?: "default" | "accent";
}) {
  const color = tone === "accent" ? "var(--accent)" : "var(--fg)";
  return (
    <div className="min-w-[92px]">
      <div
        className="tnum leading-none"
        style={{ fontFamily: "var(--font-serif)", fontSize: "1.875rem", fontWeight: 300, color }}
      >
        {value}
      </div>
      <div className="mt-1.5 whitespace-nowrap text-[11.5px] text-[var(--faint)]">{label}</div>
      {width != null ? (
        <div className="mt-2 h-[2px] overflow-hidden" style={{ background: "rgba(150,185,255,.12)" }}>
          <span className="grow-bar block h-full" style={{ width: `${width}%`, background: color }} />
        </div>
      ) : null}
    </div>
  );
}

export function StatRail({
  items,
}: {
  items: { value: ReactNode; label: string; width?: number; tone?: "default" | "accent" }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-[22px] gap-y-5">
      {items.map((it) => (
        <Stat key={it.label} {...it} />
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
  return (
    <div
      className="flex flex-col items-start gap-3.5 rounded-[16px] border p-8"
      style={{ borderColor: "var(--card-border)", background: "var(--panel)" }}
    >
      <div className="flex gap-1.5">
        <span className="diamond" />
        <span className="h-[5px] w-[5px] rotate-45" style={{ background: "#7FA6F0" }} />
        <span className="h-[5px] w-[5px] rotate-45" style={{ background: "rgba(150,185,255,.3)" }} />
      </div>
      <div className="display-md">{title}</div>
      <p className="meta max-w-[54ch] leading-relaxed">{body}</p>
      {action ? <div className="mt-1">{action}</div> : null}
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

const TONE_STYLE: Record<string, { color: string; bg: string }> = {
  high: { color: "var(--accent)", bg: "var(--accent-tint)" },
  medium: { color: "var(--priority-medium, #7FA6F0)", bg: "var(--accent-tint)" },
  positive: { color: "var(--success)", bg: "var(--success-bg)" },
  warning: { color: "var(--warn)", bg: "var(--warn-bg)" },
  critical: { color: "var(--danger)", bg: "var(--danger-bg)" },
  info: { color: "var(--accent)", bg: "var(--accent-tint)" },
  neutral: { color: "var(--muted)", bg: "var(--panel-2)" },
};

/** Small label chip — tinted fill, no border. */
export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof TONE_STYLE;
  className?: string;
}) {
  const s = TONE_STYLE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[4px] px-2 py-[2px] text-[10.5px] font-medium tracking-wide",
        className,
      )}
      style={{ color: s.color, background: s.bg }}
    >
      {children}
    </span>
  );
}
