import Link from "next/link";
import { getActiveTenant } from "@/lib/tenant";
import { listTrials } from "@/lib/queries";
import { EmptyState, PageHeader, Pill } from "@/components/ui/primitives";
import { Table, Td, Th, Tr } from "@/components/ui/table";
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
        description="Every trial is snapshotted and diffed on each refresh. The flags are derived deterministically from the public record — molecular eligibility, ctDNA / MRD / NGS language, serial sampling."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No trials ingested"
          body="Run `npm run ingest:ctgov` to fetch the seeded RAS/KRAS watchlist from ClinicalTrials.gov API v2."
        />
      ) : (
        <Table
          head={
            <>
              <Th>Trial</Th>
              <Th>Sponsor</Th>
              <Th>Phase</Th>
              <Th>Status</Th>
              <Th align="right">Enroll.</Th>
              <Th>Testing language</Th>
              <Th align="right">Updated</Th>
            </>
          }
        >
          {rows.map((t) => (
            <Tr key={t.id}>
              <Td>
                <Link
                  href={`/trials/${t.nctId}`}
                  className="font-mono text-[11.5px] text-[var(--accent)]"
                >
                  {t.nctId}
                </Link>
                <div className="entity-name mt-0.5 line-clamp-2 max-w-[340px] text-[13.5px] leading-snug">
                  {t.title}
                </div>
              </Td>
              <Td className="text-[var(--muted)]">
                <span className="line-clamp-2 max-w-[160px]">{t.sponsorName}</span>
              </Td>
              <Td className="font-medium">{PHASE_LABEL[t.phase] ?? t.phase}</Td>
              <Td>
                <span className="text-[12px] text-[var(--muted)]">
                  {t.status.replace(/_/g, " ")}
                </span>
              </Td>
              <Td align="right" className="tnum">
                {t.enrollment ?? "—"}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {t.molecularEligibility ? <Pill tone="high">mol. elig.</Pill> : null}
                  {t.ctdnaMentions ? <Pill tone="info">ctDNA</Pill> : null}
                  {t.mrdMentions ? <Pill tone="info">MRD</Pill> : null}
                  {t.ngsMentions ? <Pill tone="neutral">NGS</Pill> : null}
                  {t.serialSamplingMentions ? <Pill tone="neutral">serial</Pill> : null}
                  {!t.molecularEligibility &&
                  !t.ctdnaMentions &&
                  !t.mrdMentions &&
                  !t.ngsMentions &&
                  !t.serialSamplingMentions ? (
                    <span className="meta">—</span>
                  ) : null}
                </div>
              </Td>
              <Td align="right" className="text-[var(--muted)]">
                {formatRelativeDays(t.lastCtgovUpdate)}
              </Td>
            </Tr>
          ))}
        </Table>
      )}
    </div>
  );
}
