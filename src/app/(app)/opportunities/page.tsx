import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { opportunities, organizations } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { EmptyState, PageHeader, Pill } from "@/components/ui/primitives";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { ConfidenceIndicator } from "@/components/domain/signal-primitives";

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
        <Table
          head={
            <>
              <Th>Opportunity</Th>
              <Th>Stage</Th>
              <Th>Confidence</Th>
              <Th align="right">Score</Th>
            </>
          }
        >
          {rows.map(({ opp, orgName }) => (
            <Tr key={opp.id}>
              <Td>
                <div className="entity-name text-[14px]">{opp.title}</div>
                <div className="meta text-[12px]">{orgName}</div>
              </Td>
              <Td>
                <Pill tone="neutral">{opp.stage}</Pill>
              </Td>
              <Td>
                <ConfidenceIndicator confidence={opp.confidenceScore} />
              </Td>
              <Td
                align="right"
                className="tnum text-[16px]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {opp.opportunityScore}
              </Td>
            </Tr>
          ))}
        </Table>
      )}
    </div>
  );
}
