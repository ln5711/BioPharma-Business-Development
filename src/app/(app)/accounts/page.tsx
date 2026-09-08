import Link from "next/link";
import { getActiveTenant } from "@/lib/tenant";
import { listAccounts } from "@/lib/queries";
import { EmptyState, PageHeader, Pill } from "@/components/ui/primitives";

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
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left">
                <th className="eyebrow px-4 py-2.5 font-semibold">Company</th>
                <th className="eyebrow px-3 py-2.5 font-semibold">Type</th>
                <th className="eyebrow px-3 py-2.5 font-semibold">Tier</th>
                <th className="eyebrow px-3 py-2.5 font-semibold">Trials</th>
                <th className="eyebrow px-3 py-2.5 font-semibold">Signals</th>
                <th className="eyebrow px-3 py-2.5 font-semibold">Top score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ org, trialCount, signalCount, topScore }) => (
                <tr
                  key={org.id}
                  className="border-b last:border-0 hover:bg-[var(--panel-2)]"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/accounts/${org.id}`}
                      className="entity-name text-[13.5px] text-[var(--accent)]"
                    >
                      {org.canonicalName}
                    </Link>
                    {org.headquarters ? (
                      <div className="meta text-[12px]">{org.headquarters}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">
                    {org.organizationType}
                  </td>
                  <td className="px-3 py-2.5">
                    <Pill tone={org.accountTier === "strategic" ? "high" : "neutral"}>
                      {org.accountTier}
                    </Pill>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{trialCount}</td>
                  <td className="px-3 py-2.5 tabular-nums">{signalCount}</td>
                  <td className="px-3 py-2.5 tabular-nums font-semibold">{topScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
