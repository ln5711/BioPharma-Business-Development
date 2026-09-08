import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assets, organizations } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { EmptyState, PageHeader, Pill } from "@/components/ui/primitives";
import { Table, Td, Th, Tr } from "@/components/ui/table";

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
        <Table
          head={
            <>
              <Th>Asset</Th>
              <Th>Company</Th>
              <Th>Mechanism of action</Th>
              <Th>Stage</Th>
            </>
          }
        >
          {rows.map(({ asset, orgName }) => (
            <Tr key={asset.id}>
              <Td>
                <span className="entity-name text-[14px]">{asset.canonicalName}</span>
                {asset.developmentCode ? (
                  <span className="meta ml-2 font-mono text-[11.5px]">
                    {asset.developmentCode}
                  </span>
                ) : null}
              </Td>
              <Td className="text-[var(--muted)]">{orgName}</Td>
              <Td className="text-[var(--muted)]">{asset.mechanismOfAction ?? "—"}</Td>
              <Td>
                <Pill tone="neutral">{asset.stage.replace(/_/g, " ")}</Pill>
              </Td>
            </Tr>
          ))}
        </Table>
      )}
    </div>
  );
}
