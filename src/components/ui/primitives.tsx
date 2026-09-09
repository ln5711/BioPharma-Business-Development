import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A white surface with a hairline border; add `lift` for a hover raise. */
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

/** Page masthead: eyebrow · serif title · standfirst, closed by a hairline. */
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
    <div className="mb-7">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="display-lg mt-3">{title}</h1>
          {description ? (
            <p className="mt-3 max-w-[64ch] text-[14.5px] leading-[1.6] text-[var(--muted)]">
              {description}
            </p>
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
    <div className="mb-4 flex items-end justify-between gap-4 border-b pb-3">
      <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {children}
      </h2>
      {aside ? <div className="text-[12.5px] text-[var(--accent)]">{aside}</div> : null}
    </div>
  );
}

export function Stat({
  value,
  label,
  delta,
  width,
  tone = "default",
}: {
  value: ReactNode;
  label: string;
  delta?: string;
  /** 0–100 bar fill; omit to hide the bar. */
  width?: number;
  tone?: "default" | "accent";
}) {
  const color = tone === "accent" ? "var(--accent)" : "var(--fg)";
  return (
    <div>
      <div className="flex items-baseline gap-[7px]">
        <span
          className="tnum"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2rem",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color,
          }}
        >
          {value}
        </span>
        {delta ? (
          <span className="text-[12px] font-semibold text-[var(--color-positive)]">
            {delta}
          </span>
        ) : null}
      </div>
      <div className="mt-1 text-[12.5px] text-[var(--muted)]">{label}</div>
      {width != null ? (
        <div className="mt-2.5 h-[3px] overflow-hidden rounded" style={{ background: "#e3eaf7" }}>
          <span
            className="grow-bar block h-full rounded"
            style={{ width: `${width}%`, background: color }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Stat rail — auto-fit grid, each with an animated fill bar. */
export function StatRail({
  items,
}: {
  items: {
    value: ReactNode;
    label: string;
    delta?: string;
    width?: number;
    tone?: "default" | "accent";
  }[];
}) {
  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
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
      className="flex flex-col items-start gap-3.5 rounded-[14px] border border-dashed p-8"
      style={{ borderColor: "#cfdbee", background: "var(--panel)" }}
    >
      <div className="flex gap-1.5">
        <span className="h-[9px] w-[9px] rounded-full" style={{ background: "var(--accent)" }} />
        <span className="h-[9px] w-[9px] rounded-full" style={{ background: "var(--color-sky-300)" }} />
        <span className="h-[9px] w-[9px] rounded-full" style={{ background: "#dce6f6" }} />
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

const TONE_STYLE: Record<
  string,
  { color: string; bg: string; border: string }
> = {
  high: { color: "var(--color-navy-800)", bg: "var(--color-sky-100)", border: "#d3e0fa" },
  medium: { color: "var(--color-blue-600)", bg: "var(--color-sky-50)", border: "#dbe6fb" },
  positive: { color: "var(--color-positive)", bg: "var(--color-teal-100)", border: "#cfe6e2" },
  warning: { color: "var(--color-warning)", bg: "#fbf1dc", border: "#efdcb0" },
  critical: { color: "var(--color-critical)", bg: "#fbe6e2", border: "#f2c9c0" },
  info: { color: "var(--color-navy-800)", bg: "var(--color-sky-100)", border: "#d3e0fa" },
  neutral: { color: "var(--muted)", bg: "var(--panel-2)", border: "var(--hairline)" },
};

/** Small label chip — tinted fill + hairline border. */
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
        "inline-flex items-center gap-1 rounded-[5px] border px-2 py-[2px] text-[10.5px] font-medium tracking-wide",
        className,
      )}
      style={{ color: s.color, background: s.bg, borderColor: s.border }}
    >
      {children}
    </span>
  );
}
