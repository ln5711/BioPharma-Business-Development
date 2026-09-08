import Link from "next/link";
import { getActiveTenant } from "@/lib/tenant";
import { listTasks, summarizeProgress } from "@/lib/tasks";
import { TASK_CATEGORIES, TASK_CATEGORY_META } from "@/lib/task-categories";
import { PageHeader } from "@/components/ui/primitives";
import { AddTaskForm } from "./add-task-form";
import { TaskRow } from "./task-row";

export const dynamic = "force-dynamic";

/** A notepad / checklist for the BD workday, tagged by next-best-action family. */
export default async function TasksPage() {
  const { tenant, user } = await getActiveTenant();
  const rows = await listTasks(tenant.id, user.id);
  const { overall } = summarizeProgress(rows);

  return (
    <div>
      <PageHeader
        eyebrow="Tasks"
        title="Task list"
        description="A running checklist for the week, tagged by the kind of BD work it is. Progress by category lives on the Progress page."
        actions={
          rows.length > 0 ? (
            <Link
              href="/progress"
              className="self-center text-[12.5px] font-medium text-[var(--accent)]"
            >
              {overall.done}/{overall.total} done · view progress →
            </Link>
          ) : undefined
        }
      />

      <AddTaskForm />

      {rows.length === 0 ? (
        <p className="meta mt-8 max-w-[52ch] leading-relaxed">
          Nothing on the list yet. Add tasks above and tag each one — Outreach,
          Research, Follow-up, Meeting prep, or Admin. Completion rolls up per
          category on the Progress page.
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-9">
          {TASK_CATEGORIES.map((cat) => {
            const inCat = rows.filter((r) => r.category === cat);
            if (inCat.length === 0) return null;
            const done = inCat.filter((r) => r.done).length;
            return (
              <section key={cat}>
                <div className="mb-1.5 flex items-baseline justify-between border-b pb-1.5">
                  <h2 className="eyebrow">{TASK_CATEGORY_META[cat].label}</h2>
                  <span className="meta tabular-nums text-[11.5px]">
                    {done}/{inCat.length}
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: "var(--hairline)" }}>
                  {inCat.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
