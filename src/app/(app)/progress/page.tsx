import Link from "next/link";
import { getActiveTenant } from "@/lib/tenant";
import { listTasks, summarizeProgress } from "@/lib/tasks";
import { TASK_CATEGORY_META } from "@/lib/task-categories";
import { EmptyState, PageHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** Completion per task category, derived from the same task data. */
export default async function ProgressPage() {
  const { tenant, user } = await getActiveTenant();
  const rows = await listTasks(tenant.id, user.id);
  const { byCategory, overall } = summarizeProgress(rows);

  return (
    <div>
      <PageHeader
        eyebrow="Progress"
        title="This week"
        description="How much of the task list is done, overall and by category. Pulls straight from Tasks."
        actions={
          <Link
            href="/tasks"
            className="self-center text-[12.5px] font-medium text-[var(--accent)]"
          >
            Open tasks →
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing to measure yet"
          body="Add and tag tasks on the Tasks page. Completion rolls up here per category as you check them off."
          action={
            <Link
              href="/tasks"
              className="text-[12.5px] font-medium text-[var(--accent)]"
            >
              Go to tasks →
            </Link>
          }
        />
      ) : (
        <>
          <section className="border-b pb-8">
            <div className="flex items-end gap-4">
              <span
                className="tnum leading-none"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "3rem",
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                }}
              >
                {overall.pct}
                <span className="text-[1.25rem] text-[var(--faint)]">%</span>
              </span>
              <span className="meta pb-1.5">
                {overall.done} of {overall.total} tasks complete
              </span>
            </div>
            <Bar pct={overall.pct} className="mt-4" thick />
          </section>

          <div className="mt-8 flex flex-col gap-6">
            {byCategory.map((c) => (
              <div key={c.category}>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[13px] font-medium">{c.label}</span>
                  <span className="meta tabular-nums text-[11.5px]">
                    {c.total === 0
                      ? "no tasks"
                      : `${c.done}/${c.total} · ${c.pct}%`}
                  </span>
                </div>
                <Bar pct={c.pct} muted={c.total === 0} />
                <p className="meta mt-1 text-[11.5px]">
                  {TASK_CATEGORY_META[c.category].blurb}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Bar({
  pct,
  thick,
  muted,
  className,
}: {
  pct: number;
  thick?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-full ${thick ? "h-2" : "h-[5px]"} ${className ?? ""}`}
      style={{ background: "rgba(150,185,255,.12)" }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${pct}%`,
          background: muted ? "var(--faint)" : "var(--accent)",
        }}
      />
    </div>
  );
}
