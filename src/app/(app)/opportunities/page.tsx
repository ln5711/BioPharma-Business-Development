import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { opportunities, organizations } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { EmptyState, PageHeader, Pill } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const { tenant } = await getActiveTenant();
  const db = await getDb();
  const rows = await db
    .select({ opp: opportunities, orgName: organizations.canonicalName })
    .from(opportunities)
    .leftJoin(organizations, eq(organizations.id, opportunities.organizationId))
    .where(eq(opportunities.tenantId, tenant.id))
    .orderBy(desc(opportunities.opportunityScore))
    .limit(100);

  return (
    <div>
      <PageHeader
        eyebrow="Opportunities"
        title="Opportunities"
        description="Promoted from high-scoring signals. Score components are always exposed (spec §86); opportunity attractiveness and interpretation confidence are shown as separate numbers (spec §16)."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No opportunities promoted yet"
          body="Signals above the tenant threshold can be promoted to tracked opportunities with an owner, stage, timing classification and next action. This action ships with the signal review flow."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <tbody>
              {rows.map(({ opp, orgName }) => (
                <tr key={opp.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="entity-name">{opp.title}</div>
                    <div className="meta">{orgName}</div>
                  </td>
                  <td className="px-3 py-3">
                    <Pill tone="neutral">{opp.stage}</Pill>
                  </td>
                  <td className="px-3 py-3 tabular-nums font-semibold">
                    {opp.opportunityScore}
                  </td>
                  <td className="px-3 py-3 meta">conf {opp.confidenceScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
