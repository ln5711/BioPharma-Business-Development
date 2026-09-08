import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { watchlistItems } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { getWatchlists } from "@/lib/queries";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function WatchlistsPage() {
  const { tenant } = await getActiveTenant();
  const db = await getDb();
  const lists = await getWatchlists(tenant.id);
  const items = lists.length
    ? await db
        .select()
        .from(watchlistItems)
        .where(eq(watchlistItems.watchlistId, lists[0].id))
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="Watchlists"
        title="Watchlists"
        description="A saved set of entities and keywords with its own score threshold and alert cadence. The ClinicalTrials.gov adapter runs one query per watchlist."
      />
      {lists.length === 0 ? (
        <EmptyState
          title="No watchlists"
          body="Run `npm run seed` to create the RAS/KRAS demo watchlist (spec §81 / §116)."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {lists.map((wl) => (
            <Card key={wl.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="entity-name text-[16px]">{wl.name}</h3>
                  <p className="meta mt-1">{wl.description}</p>
                </div>
                <div className="flex gap-2">
                  <Pill tone="neutral">min score {wl.minOpportunityScore}</Pill>
                  <Pill tone="neutral">{wl.alertMode.replace(/_/g, " ")}</Pill>
                </div>
              </div>
              {wl.ctgovQuery ? (
                <div className="mt-3 text-[12.5px] text-[var(--muted)]">
                  <span className="eyebrow mr-2">CT.gov query</span>
                  terms: {wl.ctgovQuery.terms.join(", ")}
                  {wl.ctgovQuery.conditions?.length
                    ? ` · conditions: ${wl.ctgovQuery.conditions.join(", ")}`
                    : ""}
                </div>
              ) : null}
              {wl.id === lists[0].id && items.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {items.map((it) => (
                    <Pill key={it.id} tone="info">
                      {it.entityKind}: {it.label}
                    </Pill>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
