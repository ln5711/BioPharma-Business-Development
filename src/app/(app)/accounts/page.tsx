import Link from "next/link";
import { getActiveTenant } from "@/lib/tenant";
import { listAccounts } from "@/lib/queries";
import { EmptyState, PageHeader, Pill } from "@/components/ui/primitives";
import { Table, Td, Th, Tr } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const { tenant } = await getActiveTenant();
  const rows = await listAccounts(tenant.id);

  return (
    <div>
      <PageHeader
        eyebrow="Accounts"
        title="Accounts"
        description="Companies resolved from trial sponsors and collaborators. Account score is the highest opportunity score across the account's signals; relationship state is layered in with MVP 3."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          body="Accounts are created automatically as trials are ingested and sponsors resolved. Run `npm run ingest:ctgov`."
        />
      ) : (
        <Table
          head={
            <>
              <Th>Company</Th>
              <Th>Type</Th>
              <Th>Tier</Th>
              <Th align="right">Trials</Th>
              <Th align="right">Signals</Th>
              <Th align="right">Top score</Th>
            </>
          }
        >
          {rows.map(({ org, trialCount, signalCount, topScore }) => (
            <Tr key={org.id}>
              <Td>
                <Link
                  href={`/accounts/${org.id}`}
                  className="entity-name text-[14px] hover:text-[var(--accent)]"
                >
                  {org.canonicalName}
                </Link>
                {org.headquarters ? (
                  <div className="meta text-[12px]">{org.headquarters}</div>
                ) : null}
              </Td>
              <Td className="capitalize text-[var(--muted)]">{org.organizationType}</Td>
              <Td>
                <Pill tone={org.accountTier === "strategic" ? "high" : "neutral"}>
                  {org.accountTier}
                </Pill>
              </Td>
              <Td align="right" className="tnum">
                {trialCount}
              </Td>
              <Td align="right" className="tnum">
                {signalCount}
              </Td>
              <Td
                align="right"
                className="tnum text-[15px]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {topScore}
              </Td>
            </Tr>
          ))}
        </Table>
      )}
    </div>
  );
}
