import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { capabilityProfiles, scoringProfiles, sourceRegistry } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { Card, PageHeader, Pill } from "@/components/ui/primitives";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { tenant } = await getActiveTenant();
  const db = await getDb();
  const [cp] = await db
    .select()
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.tenantId, tenant.id))
    .limit(1);
  const [sp] = await db
    .select()
    .from(scoringProfiles)
    .where(eq(scoringProfiles.tenantId, tenant.id))
    .limit(1);
  const sources = await db
    .select()
    .from(sourceRegistry)
    .where(eq(sourceRegistry.tenantId, tenant.id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Settings"
        title="Configuration"
        description="Company capability profile, scoring weights, and source registry. All opportunity scoring references the capability profile (spec §3)."
      />

      <Card className="p-5">
        <div className="eyebrow mb-2">Company capability profile</div>
        {cp ? (
          <div className="grid gap-3 text-[13px] sm:grid-cols-2">
            <Field label="Company">{cp.companyName}</Field>
            <Field label="Minimum opportunity score">{cp.minimumOpportunityScore}</Field>
            <Field label="Capability flags">
              {Object.entries(cp.capabilityFlags ?? {})
                .filter(([, v]) => v)
                .map(([k]) => k)
                .join(", ") || "—"}
            </Field>
            <Field label="Cancer types">{cp.cancerTypes?.join(", ") || "—"}</Field>
            <Field label="Must-pursue">{cp.mustPursue?.join(", ") || "—"}</Field>
            <Field label="Exclusions">{cp.exclusions?.join(", ") || "—"}</Field>
          </div>
        ) : (
          <p className="meta">No profile — run `npm run seed`.</p>
        )}
      </Card>

      <Card className="p-5">
        <div className="eyebrow mb-2">Scoring weights (spec §15 / §88)</div>
        {sp ? (
          <div className="flex flex-wrap gap-2">
            {Object.entries(sp.weights).map(([k, v]) => (
              <Pill key={k} tone="neutral">
                {k}: {v}
              </Pill>
            ))}
          </div>
        ) : (
          <p className="meta">Default model in use (25/20/20/10/10/10/5).</p>
        )}
      </Card>

      <Card className="p-5">
        <div className="eyebrow mb-2">Source registry</div>
        <div className="flex flex-col gap-2">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-[13px]">
              <span>
                <span className="entity-name">{s.name}</span>
                <span className="meta ml-2">{s.sourceType}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="meta">
                  {s.signalsProduced} signals · {s.failureCount} failures
                </span>
                <Pill tone={s.health === "healthy" ? "positive" : "warning"}>
                  {s.health}
                </Pill>
              </span>
            </div>
          ))}
          {!sources.length ? <p className="meta">No sources registered.</p> : null}
        </div>
      </Card>

      <Card className="p-5">
        <div className="eyebrow mb-2">Runtime</div>
        <div className="grid gap-2 text-[13px] sm:grid-cols-2">
          <Field label="Database driver">
            {env.DATABASE_URL ? "PostgreSQL" : "PGlite (embedded)"}
          </Field>
          <Field label="LLM provider">{env.LLM_PROVIDER}</Field>
          <Field label="ClinicalTrials.gov">{env.CLINICALTRIALS_BASE_URL}</Field>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
