import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { workspaceItems, workspaces } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { TEMPLATE_META } from "@/lib/workspaces";
import { PageHeader } from "@/components/ui/primitives";
import { createWorkspace } from "./actions";

export const dynamic = "force-dynamic";

export default async function WorkspacesPage() {
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();
  const rows = await db
    .select({
      w: workspaces,
      total: sql<number>`count(${workspaceItems.id})::int`,
      done: sql<number>`count(${workspaceItems.id}) filter (where ${workspaceItems.done})::int`,
    })
    .from(workspaces)
    .leftJoin(workspaceItems, eq(workspaceItems.workspaceId, workspaces.id))
    .where(and(eq(workspaces.tenantId, tenant.id), eq(workspaces.userId, user.id)))
    .groupBy(workspaces.id)
    .orderBy(desc(workspaces.updatedAt));

  return (
    <div>
      <PageHeader
        eyebrow="Working environment"
        title="Workspaces"
        description="Where fragmented research becomes one place. Pick a template or describe what you're working on — newwin assembles the sections and a recommended checklist."
      />

      <form
        action={createWorkspace}
        className="panel-glass mb-8 flex flex-col gap-3 p-5"
      >
        <div className="text-[10.5px] uppercase" style={{ letterSpacing: ".22em", color: "#8FD3FF", fontFamily: "var(--font-mono)" }}>
          New workspace — what are you working on?
        </div>
        <input
          name="objective"
          placeholder="e.g. Prepare a presentation for Novartis today"
          maxLength={280}
          className="rounded-[11px] border border-[rgba(150,185,255,.16)] bg-[rgba(10,8,22,.5)] px-3.5 py-3 text-[14px] text-[var(--fg)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent-border)]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            name="template"
            defaultValue="account_research"
            className="rounded-[10px] border border-[rgba(150,185,255,.16)] bg-[rgba(10,8,22,.5)] px-3 py-2.5 text-[12.5px] text-[var(--fg)] outline-none"
          >
            {Object.entries(TEMPLATE_META).map(([id, m]) => (
              <option key={id} value={id}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold"
            style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
          >
            Create workspace
          </button>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="text-[14px] text-[var(--muted)]">No workspaces yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ w, total, done }) => (
            <Link key={w.id} href={`/workspaces/${w.id}`} className="card card-lift block p-5">
              <div className="text-[10px] uppercase" style={{ letterSpacing: ".16em", color: "#8FD3FF", fontFamily: "var(--font-mono)" }}>
                {TEMPLATE_META[w.template as keyof typeof TEMPLATE_META]?.label ?? w.template}
              </div>
              <div className="mt-2 text-[15.5px]" style={{ fontFamily: "var(--font-serif)", color: "#EDF1FC" }}>
                {w.title}
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11.5px] text-[var(--faint)]" style={{ fontFamily: "var(--font-mono)" }}>
                <span>{done}/{total} done</span>
                {w.status !== "active" ? <span>· {w.status}</span> : null}
              </div>
              <div className="mt-2 h-[3px] overflow-hidden rounded" style={{ background: "rgba(150,185,255,.12)" }}>
                <span className="grow-bar block h-full rounded" style={{ width: `${total ? (done / total) * 100 : 0}%`, background: "var(--accent)" }} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
