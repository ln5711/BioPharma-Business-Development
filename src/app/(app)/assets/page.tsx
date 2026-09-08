import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assets, organizations } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { EmptyState, PageHeader, Pill } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const { tenant } = await getActiveTenant();
  const db = await getDb();
  const rows = await db
    .select({ asset: assets, orgName: organizations.canonicalName })
    .from(assets)
    .leftJoin(organizations, eq(organizations.id, assets.organizationId))
    .where(eq(assets.tenantId, tenant.id))
    .orderBy(desc(assets.lastUpdatedAt))
    .limit(200);

  return (
    <div>
      <PageHeader
        eyebrow="Assets"
        title="Assets"
        description="Therapeutic programs as first-class commercial objects. Asset ↔ trial ↔ target ↔ indication resolution is seeded for the RAS demo vertical and expands as publications and pipeline pages are ingested (MVP 2)."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No assets resolved yet"
          body="Assets are linked from trial interventions and the RAS seed set. Run `npm run seed` then `npm run ingest:ctgov`."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left">
                <th className="eyebrow px-4 py-2.5 font-semibold">Asset</th>
                <th className="eyebrow px-3 py-2.5 font-semibold">Company</th>
                <th className="eyebrow px-3 py-2.5 font-semibold">MOA</th>
                <th className="eyebrow px-3 py-2.5 font-semibold">Stage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ asset, orgName }) => (
                <tr key={asset.id} className="border-b last:border-0 hover:bg-[var(--panel-2)]">
                  <td className="px-4 py-2.5">
                    <span className="entity-name">{asset.canonicalName}</span>
                    {asset.developmentCode ? (
                      <span className="meta ml-2 font-mono text-[12px]">
                        {asset.developmentCode}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">{orgName}</td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">
                    {asset.mechanismOfAction ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <Pill tone="neutral">{asset.stage.replace(/_/g, " ")}</Pill>
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
