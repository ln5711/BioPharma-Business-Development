import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Not-everything-is-a-card, but when it is a card it breathes (spec §130). */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("card fade-in", className)}>{children}</div>;
}

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
    <div className="mb-6 flex items-end justify-between gap-6">
      <div>
        {eyebrow ? <div className="eyebrow mb-1.5">{eyebrow}</div> : null}
        <h1 className="display-lg">{title}</h1>
        {description ? (
          <p className="meta mt-2 max-w-2xl leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
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
      <div className="eyebrow mt-1">{label}</div>
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
  // Communicates what the system can do — never "Nothing here yet!" (spec §150).
  return (
    <div
      className="card flex flex-col items-start gap-2 px-6 py-10"
      style={{ background: "var(--panel-2)" }}
    >
      <div className="eyebrow">{title}</div>
      <p className="meta max-w-lg leading-relaxed">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="my-6 border-t" />;
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="eyebrow">{label}</span>
      <hr className="flex-1 border-t" />
    </div>
  );
}

const TONE_CLASS: Record<string, string> = {
  high: "text-[var(--color-priority-high)] bg-[var(--color-lavender-100)]",
  medium: "text-[var(--color-priority-medium)] bg-[var(--color-lavender-50)]",
  positive: "text-[var(--color-positive)] bg-[#e7f6ef]",
  warning: "text-[var(--color-warning)] bg-[#fbf1dc]",
  critical: "text-[var(--color-critical)] bg-[#fbe5e7]",
  info: "text-[var(--color-info)] bg-[#e9ecfb]",
  neutral: "text-[var(--muted)] bg-[var(--panel-2)]",
};

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
        "inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-0.5 text-[11px] font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
