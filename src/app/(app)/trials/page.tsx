import Link from "next/link";
import { getActiveTenant } from "@/lib/tenant";
import { searchTrials, type TrialPhase, type TrialStatus } from "@/lib/ask/retrieval";
import { EmptyState, PageHeader, Pill } from "@/components/ui/primitives";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { formatRelativeDays } from "@/lib/utils";
import { TrialSearchControls } from "./search-controls";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

const PHASE_UI_TO_ENUM: Record<string, TrialPhase[]> = {
  "1": ["phase_1", "early_phase_1"],
  "1/2": ["phase_1_2"],
  "2": ["phase_2"],
  "2/3": ["phase_2_3"],
  "3": ["phase_3"],
  "4": ["phase_4"],
};
const STATUS_UI_TO_ENUM: Record<string, TrialStatus[]> = {
  recruiting: ["recruiting"],
  not_yet_recruiting: ["not_yet_recruiting"],
  active: ["active_not_recruiting", "enrolling_by_invitation"],
  completed: ["completed"],
  terminated: ["terminated", "withdrawn", "suspended"],
};

export default async function TrialsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { tenant } = await getActiveTenant();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim();
  const nctInQ = /^NCT\d{8}$/i.test(q) ? q.toUpperCase() : undefined;

  const { evidence, total } = await searchTrials(
    { tenantId: tenant.id, userId: "" },
    {
      nctId: nctInQ ?? (sp.nct as string | undefined),
      company: sp.company || (!nctInQ && q ? q : undefined),
      biomarker: sp.biomarker || undefined,
      indication: sp.indication || undefined,
      phases: sp.phase ? PHASE_UI_TO_ENUM[sp.phase] : undefined,
      statuses: sp.status ? STATUS_UI_TO_ENUM[sp.status] : undefined,
      updatedWithinDays: sp.updated ? Number(sp.updated) : undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    },
  );

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const u = new URLSearchParams(sp as Record<string, string>);
    u.set("page", String(p));
    return `/trials?${u.toString()}`;
  };

  return (
    <div>
      <PageHeader
        eyebrow="Clinical trials"
        title="Trials"
        description="Every trial is snapshotted and diffed on each refresh. Flags are derived deterministically from the public record — molecular eligibility, ctDNA / MRD / NGS language, serial sampling."
      />

      <TrialSearchControls />

      <div className="mb-3 text-[12.5px] text-[var(--muted)]">
        {total === 0 ? "No matching trials" : `${total} trial${total === 1 ? "" : "s"}`}
        {total > PAGE_SIZE ? ` · page ${page} of ${pages}` : ""}
      </div>

      {evidence.length === 0 ? (
        <EmptyState
          title={total === 0 ? "No trials match these filters" : "No results on this page"}
          body={
            total === 0
              ? "Loosen a filter, or set up a monitoring query on the Monitoring page to pull trials from ClinicalTrials.gov into your workspace."
              : "Go back to page 1."
          }
        />
      ) : (
        <>
          <Table
            head={
              <>
                <Th>Trial</Th>
                <Th>Sponsor / conditions</Th>
                <Th>Phase</Th>
                <Th>Status</Th>
                <Th align="right">Updated</Th>
              </>
            }
          >
            {evidence.map((t) => {
              const meta = t.meta ?? {};
              return (
                <Tr key={t.id}>
                  <Td>
                    <Link
                      href={t.recordUrl}
                      className="font-mono text-[11.5px] text-[var(--accent)]"
                    >
                      {t.id}
                    </Link>
                    <div className="entity-name mt-0.5 line-clamp-2 max-w-[360px] text-[13.5px] leading-snug">
                      {t.title.replace(/^NCT\d{8} — /, "")}
                    </div>
                  </Td>
                  <Td className="max-w-[240px] text-[var(--muted)]">
                    <span className="line-clamp-2">{t.summary}</span>
                  </Td>
                  <Td className="font-medium">
                    <Pill tone="neutral">{String(meta.phase ?? "").replace(/_/g, " ") || "—"}</Pill>
                  </Td>
                  <Td>
                    <span className="text-[12px] text-[var(--muted)]">
                      {String(meta.status ?? "").replace(/_/g, " ")}
                    </span>
                  </Td>
                  <Td align="right" className="text-[var(--muted)]">
                    {t.eventDate ? formatRelativeDays(new Date(t.eventDate)) : "—"}
                    <div className="text-[10.5px] text-[var(--faint)]">
                      {t.eventDateKind === "source_update"
                        ? "CT.gov update"
                        : t.eventDateKind === "first_posted"
                          ? "first posted"
                          : "detected"}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </Table>

          {pages > 1 ? (
            <div className="mt-4 flex items-center gap-2 text-[12.5px]">
              {page > 1 ? (
                <Link href={qs(page - 1)} className="rounded-[8px] border px-3 py-1.5 text-[var(--muted)]" style={{ borderColor: "var(--card-border)" }}>
                  ← Prev
                </Link>
              ) : null}
              <span className="text-[var(--faint)]">
                Page {page} / {pages}
              </span>
              {page < pages ? (
                <Link href={qs(page + 1)} className="rounded-[8px] border px-3 py-1.5 text-[var(--muted)]" style={{ borderColor: "var(--card-border)" }}>
                  Next →
                </Link>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
