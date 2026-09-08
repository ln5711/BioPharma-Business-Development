import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { capabilityProfiles, scoringProfiles, sourceRegistry } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { PageHeader, Pill, SectionHeading } from "@/components/ui/primitives";
import { env, usingPglite } from "@/lib/env";

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
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Configuration"
        description="Company capability profile, scoring weights, and source registry. All opportunity scoring references the capability profile (spec §3)."
      />

      <div className="flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
        <section className="py-7 first:pt-0">
          <SectionHeading>Company capability profile</SectionHeading>
          {cp ? (
            <div className="grid max-w-[64ch] gap-x-10 gap-y-4 text-[13px] sm:grid-cols-2">
              <Field label="Company">{cp.companyName}</Field>
              <Field label="Minimum opportunity score">
                {cp.minimumOpportunityScore}
              </Field>
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
        </section>

        <section className="py-7">
          <SectionHeading aside="spec §15 / §88">Scoring weights</SectionHeading>
          {sp ? (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(sp.weights).map(([k, v]) => (
                <Pill key={k} tone="neutral">
                  {k} · {v}
                </Pill>
              ))}
            </div>
          ) : (
            <p className="meta">Default model in use (25 / 20 / 20 / 10 / 10 / 10 / 5).</p>
          )}
        </section>

        <section className="py-7">
          <SectionHeading>Source registry</SectionHeading>
          <div className="flex max-w-[64ch] flex-col gap-2.5">
            {sources.map((s) => (
              <div
                key={s.id}
                className="flex items-baseline justify-between gap-4 text-[13px]"
              >
                <span>
                  <span className="entity-name">{s.name}</span>
                  <span className="meta ml-2 text-[11.5px]">{s.sourceType}</span>
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="meta text-[11.5px]">
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
        </section>

        <section className="py-7">
          <SectionHeading>Runtime</SectionHeading>
          <div className="grid max-w-[64ch] gap-x-10 gap-y-4 text-[13px] sm:grid-cols-2">
            <Field label="Database driver">
              {usingPglite ? "PGlite (embedded)" : "PostgreSQL"}
            </Field>
            <Field label="LLM provider">{env.LLM_PROVIDER}</Field>
            <Field label="ClinicalTrials.gov">{env.CLINICALTRIALS_BASE_URL}</Field>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
