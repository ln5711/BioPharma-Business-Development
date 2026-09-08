import Link from "next/link";
import { getActiveTenant } from "@/lib/tenant";
import { listTrials } from "@/lib/queries";
import { EmptyState, PageHeader, Pill } from "@/components/ui/primitives";
import { formatRelativeDays } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PHASE_LABEL: Record<string, string> = {
  early_phase_1: "EP1",
  phase_1: "P1",
  phase_1_2: "P1/2",
  phase_2: "P2",
  phase_2_3: "P2/3",
  phase_3: "P3",
  phase_4: "P4",
  not_applicable: "N/A",
  unknown: "—",
};

export default async function TrialsPage() {
  const { tenant } = await getActiveTenant();
  const rows = await listTrials(tenant.id, 200);

  return (
    <div>
      <PageHeader
        eyebrow="Clinical trials"
        title="Trials"
        description="Every trial is snapshotted and diffed on each refresh. Flags below are derived deterministically from the public record — molecular eligibility, ctDNA/MRD/NGS language, serial sampling."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No trials ingested"
          body="Run `npm run ingest:ctgov` to fetch the seeded RAS/KRAS watchlist from ClinicalTrials.gov API v2."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left">
                <th className="eyebrow px-4 py-2.5 font-semibold">Trial</th>
                <th className="eyebrow px-3 py-2.5 font-semibold">Sponsor</th>
                <th className="eyebrow px-3 py-2.5 font-semibold">Phase</th>
                <th className="eyebrow px-3 py-2.5 font-semibold">Status</th>
                <th className="eyebrow px-3 py-2.5 font-semibold">Enroll.</th>
                <th className="eyebrow px-3 py-2.5 font-semibold">Signals in record</th>
                <th className="eyebrow px-3 py-2.5 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-[var(--panel-2)]">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/trials/${t.nctId}`}
                      className="font-mono text-[12px] text-[var(--accent)]"
                    >
                      {t.nctId}
                    </Link>
                    <div className="entity-name mt-0.5 line-clamp-1 max-w-[320px] text-[13px]">
                      {t.title}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">
                    <span className="line-clamp-1 max-w-[160px]">{t.sponsorName}</span>
                  </td>
                  <td className="px-3 py-2.5 font-medium">{PHASE_LABEL[t.phase] ?? t.phase}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[12px] text-[var(--muted)]">
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{t.enrollment ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {t.molecularEligibility ? <Pill tone="high">mol. elig.</Pill> : null}
                      {t.ctdnaMentions ? <Pill tone="info">ctDNA</Pill> : null}
                      {t.mrdMentions ? <Pill tone="info">MRD</Pill> : null}
                      {t.ngsMentions ? <Pill tone="neutral">NGS</Pill> : null}
                      {t.serialSamplingMentions ? <Pill tone="neutral">serial</Pill> : null}
                      {!t.molecularEligibility &&
                      !t.ctdnaMentions &&
                      !t.mrdMentions &&
                      !t.ngsMentions ? (
                        <span className="meta">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">
                    {formatRelativeDays(t.lastCtgovUpdate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
