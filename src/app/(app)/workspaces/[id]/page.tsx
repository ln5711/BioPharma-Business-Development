import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workspaceItems, workspaces } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { TEMPLATE_META } from "@/lib/workspaces";
import { addItem, setWorkspaceStatus, toggleItem } from "../actions";

export const dynamic = "force-dynamic";

const SECTION_LABEL: Record<string, string> = {
  todo: "To-do",
  signals: "Recent signals",
  assets: "Relevant assets",
  trials: "Trials",
  evidence: "Evidence",
  people: "People",
  notes: "Notes",
  output: "Output",
};

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();

  const [w] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.tenantId, tenant.id), eq(workspaces.userId, user.id)))
    .limit(1);
  if (!w) notFound();

  const items = await db
    .select()
    .from(workspaceItems)
    .where(eq(workspaceItems.workspaceId, w.id))
    .orderBy(asc(workspaceItems.section), asc(workspaceItems.sortIndex), asc(workspaceItems.createdAt));

  const sections = TEMPLATE_META[w.template as keyof typeof TEMPLATE_META]?.sections ?? ["todo", "notes"];
  const todos = items.filter((i) => i.section === "todo");
  const doneCount = todos.filter((i) => i.done).length;

  return (
    <div>
      <Link href="/workspaces" className="meta hover:text-[var(--fg)]">
        ← Workspaces
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4 border-b pb-6" style={{ borderColor: "var(--hairline)" }}>
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase" style={{ letterSpacing: ".2em", color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
            {TEMPLATE_META[w.template as keyof typeof TEMPLATE_META]?.label ?? w.template}
          </div>
          <h1 className="display-lg mt-3">{w.title}</h1>
          {w.objective ? (
            <p className="mt-2.5 max-w-[70ch] text-[14.5px] leading-[1.6] text-[var(--muted)]">{w.objective}</p>
          ) : null}
        </div>
        <form action={setWorkspaceStatus}>
          <input type="hidden" name="ws" value={w.id} />
          <input type="hidden" name="status" value={w.status === "done" ? "active" : "done"} />
          <button
            className="rounded-[10px] border px-3.5 py-2 text-[12px]"
            style={{ borderColor: "rgba(150,185,255,.16)", color: "var(--muted)" }}
          >
            {w.status === "done" ? "Reopen" : "Mark complete"}
          </button>
        </form>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(240px,1fr)]">
        <section>
          <div className="mb-3 flex items-end justify-between border-b pb-2" style={{ borderColor: "var(--hairline)" }}>
            <h2 className="text-[10.5px] uppercase" style={{ letterSpacing: ".2em", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
              newwin recommends — {doneCount}/{todos.length}
            </h2>
          </div>
          <div className="flex flex-col">
            {todos.map((it) => (
              <form key={it.id} action={toggleItem} className="flex items-start gap-3 border-b py-2.5" style={{ borderColor: "rgba(150,185,255,.08)" }}>
                <input type="hidden" name="id" value={it.id} />
                <input type="hidden" name="ws" value={w.id} />
                <input type="hidden" name="done" value={it.done ? "1" : "0"} />
                <button
                  type="submit"
                  aria-label={it.done ? "Mark incomplete" : "Mark complete"}
                  className="mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border text-[10px]"
                  style={{
                    borderColor: it.done ? "transparent" : "var(--faint)",
                    background: it.done ? "var(--accent)" : "transparent",
                    color: it.done ? "var(--accent-btn-ink)" : "transparent",
                    boxShadow: it.done ? "var(--accent-glow)" : "none",
                  }}
                >
                  ✓
                </button>
                <span className={`flex-1 text-[13.5px] leading-relaxed ${it.done ? "text-[var(--faint)] line-through" : "text-[var(--body)]"}`}>
                  {it.title}
                </span>
              </form>
            ))}
          </div>
          <form action={addItem} className="mt-3 flex gap-2">
            <input type="hidden" name="ws" value={w.id} />
            <input type="hidden" name="section" value="todo" />
            <input
              name="title"
              required
              placeholder="Add a step…"
              className="flex-1 rounded-[10px] border border-[var(--hairline)] bg-[var(--input-bg)] px-3 py-2.5 text-[13px] text-[var(--fg)] outline-none placeholder:text-[var(--placeholder)] focus:border-[var(--accent-border)]"
            />
            <button className="rounded-[10px] border px-3.5 py-2.5 text-[12px] text-[var(--accent)]" style={{ borderColor: "var(--accent-border)", background: "var(--accent-tint)" }}>
              Add
            </button>
          </form>
        </section>

        <aside className="flex flex-col gap-4">
          {sections
            .filter((s) => s !== "todo")
            .map((section) => {
              const rows = items.filter((i) => i.section === section);
              return (
                <div key={section} className="card p-4">
                  <div className="text-[10px] uppercase" style={{ letterSpacing: ".16em", color: "var(--faint)", fontFamily: "var(--font-mono)" }}>
                    {SECTION_LABEL[section] ?? section}
                  </div>
                  {rows.length === 0 ? (
                    <p className="mt-2 text-[12px] text-[var(--faint)]">Nothing yet.</p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-2">
                      {rows.map((r) => (
                        <li key={r.id} className="text-[12.5px] leading-[1.5] text-[var(--body)]">
                          {r.title}
                          {r.body ? <span className="block text-[11.5px] text-[var(--muted)]">{r.body}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  <form action={addItem} className="mt-2.5 flex gap-1.5">
                    <input type="hidden" name="ws" value={w.id} />
                    <input type="hidden" name="section" value={section} />
                    <input
                      name="title"
                      required
                      placeholder="Add…"
                      className="min-w-0 flex-1 rounded-[8px] border border-[var(--hairline)] bg-[var(--input-bg)] px-2.5 py-2 text-[12px] text-[var(--fg)] outline-none placeholder:text-[var(--placeholder)] focus:border-[var(--accent-border)]"
                    />
                    <button className="rounded-[8px] border px-2.5 py-2 text-[11px] text-[var(--muted)]" style={{ borderColor: "var(--hairline)" }}>
                      +
                    </button>
                  </form>
                </div>
              );
            })}
        </aside>
      </div>
    </div>
  );
}
