import Link from "next/link";
import { getActiveTenant } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/primitives";
import { getSavedContacts, savedContactToViewModel, type SavedContactFilters } from "@/lib/contacts/query-contacts";
import { getTopSignalsForOutreach } from "@/lib/contacts/top-signals";
import { DiscoverPanel } from "@/components/outreach/discover-panel";
import { SavedContactsClient } from "@/components/outreach/saved-contacts-client";

export const dynamic = "force-dynamic";

type Tab = "discover" | "saved" | "favorites" | "followups";
const TABS: { key: Tab; label: string }[] = [
  { key: "discover", label: "Discover contacts" },
  { key: "saved", label: "Saved contacts" },
  { key: "favorites", label: "Favorites" },
  { key: "followups", label: "Follow-ups" },
];

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tab = (typeof sp.tab === "string" && TABS.some((t) => t.key === sp.tab) ? sp.tab : "discover") as Tab;
  const { tenant } = await getActiveTenant();

  return (
    <div>
      <PageHeader
        eyebrow="Outreach"
        title="Outreach"
        description="Signal-driven contact discovery, evidence-backed relevance, professional email discovery, and a persistent tracker — one workspace from a company signal to a logged conversation."
      />

      <nav className="mb-8 flex flex-wrap gap-1.5 border-b pb-3" style={{ borderColor: "var(--card-border)" }}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/outreach?tab=${t.key}`}
            className="rounded-[8px] px-3.5 py-2 text-[12.5px] font-medium transition-colors"
            style={
              tab === t.key
                ? { background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }
                : { color: "var(--muted)" }
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "discover" ? <DiscoverTab tenantId={tenant.id} /> : null}
      {tab === "saved" ? <SavedTab tenantId={tenant.id} searchParams={sp} /> : null}
      {tab === "favorites" ? <FavoritesTab tenantId={tenant.id} /> : null}
      {tab === "followups" ? <FollowUpsTab tenantId={tenant.id} /> : null}
    </div>
  );
}

async function DiscoverTab({ tenantId }: { tenantId: string }) {
  const topSignals = await getTopSignalsForOutreach(tenantId, 6);
  return <DiscoverPanel topSignals={topSignals} />;
}

async function SavedTab({
  tenantId,
  searchParams,
}: {
  tenantId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
  const filters: SavedContactFilters = {
    q: str(searchParams.q),
    function: str(searchParams.function),
    seniority: str(searchParams.seniority),
    emailAvailability: (str(searchParams.email) as SavedContactFilters["emailAvailability"]) ?? "any",
    outreachStatus: str(searchParams.status),
  };
  const rows = await getSavedContacts(tenantId, filters);
  const models = rows.map(savedContactToViewModel);

  return (
    <div>
      <form className="mb-5 flex flex-wrap items-center gap-2.5" method="get">
        <input type="hidden" name="tab" value="saved" />
        <input name="q" defaultValue={filters.q ?? ""} placeholder="Search name, title, company" className={filterInput} style={filterInputStyle} />
        <select name="function" defaultValue={filters.function ?? ""} className={filterInput} style={filterInputStyle}>
          <option value="">Any function</option>
          {["translational_medicine", "biomarker_development", "precision_medicine", "companion_diagnostics", "clinical_development", "clinical_operations", "program_leadership", "external_innovation", "medical_affairs", "business_development", "executive", "other"].map((f) => (
            <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select name="seniority" defaultValue={filters.seniority ?? ""} className={filterInput} style={filterInputStyle}>
          <option value="">Any seniority</option>
          {["c_suite", "svp", "vp", "head", "director", "senior_manager", "manager", "scientist", "individual_contributor"].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select name="email" defaultValue={filters.emailAvailability} className={filterInput} style={filterInputStyle}>
          <option value="any">Any email status</option>
          <option value="has_email">Has an email</option>
          <option value="no_email">No email found</option>
        </select>
        <select name="status" defaultValue={filters.outreachStatus ?? ""} className={filterInput} style={filterInputStyle}>
          <option value="">Any status</option>
          {["new", "researching", "ready_to_contact", "contacted", "follow_up_due", "replied", "meeting_scheduled", "qualified_opportunity", "not_interested", "do_not_contact"].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <button type="submit" className="rounded-[10px] px-4 py-2 text-[12.5px] font-semibold" style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}>
          Filter
        </button>
      </form>
      <SavedContactsClient initialRows={models} filters={filters} emptyLabel="No saved contacts match these filters yet. Discover and add some from the Discover tab." />
    </div>
  );
}

async function FavoritesTab({ tenantId }: { tenantId: string }) {
  const rows = await getSavedContacts(tenantId, { view: "favorites" });
  const models = rows.map(savedContactToViewModel);
  return <SavedContactsClient initialRows={models} filters={{ view: "favorites" }} emptyLabel="No favorites yet — star a saved contact to pin them here." />;
}

async function FollowUpsTab({ tenantId }: { tenantId: string }) {
  const rows = await getSavedContacts(tenantId, { view: "followups" });
  const models = rows.map(savedContactToViewModel);
  return <SavedContactsClient initialRows={models} filters={{ view: "followups" }} emptyLabel="Nothing is due for follow-up. Log outreach with a follow-up date to see it here." />;
}

const filterInput =
  "rounded-[10px] border bg-transparent px-3 py-2 text-[12.5px] text-[var(--fg)] outline-none placeholder:text-[var(--faint)]";
const filterInputStyle = { borderColor: "var(--card-border)" };
