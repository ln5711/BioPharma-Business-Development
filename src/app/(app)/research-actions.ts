"use server";

/**
 * Explicit "Save / Monitor / Add lead" actions for Ask newwin's public-research
 * results. These are the ONLY way a public result becomes a saved workspace
 * record — loading research never writes anything on its own (Round D §6/§7).
 * Every action is tenant-scoped to the signed-in user and rate-limited.
 */

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { organizations, people, watchlists } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { checkAndIncrement } from "@/lib/ask/rate-limit";
import { importTrialByNct } from "@/integrations/clinicaltrials/ingest";
import { ingestWatchlist } from "@/integrations/clinicaltrials/ingest";

export interface ActionResult {
  ok: boolean;
  message: string;
  href?: string;
}

const NCT_RE = /^NCT\d{8}$/;

async function guard(bucket: string, perMin = 20): Promise<Awaited<ReturnType<typeof getActiveTenant>>> {
  const auth = await getActiveTenant();
  const rl = await checkAndIncrement(`save:${bucket}:${auth.user.id}`, perMin, 60_000);
  if (!rl.ok) throw new Error("You're saving a lot, fast. Try again in a minute.");
  return auth;
}

/** Save a public ClinicalTrials.gov trial into the workspace by NCT id. */
export async function saveTrialToWorkspace(input: { nctId?: string }): Promise<ActionResult> {
  const nctId = String(input?.nctId ?? "").trim().toUpperCase();
  if (!NCT_RE.test(nctId)) return { ok: false, message: "That doesn't look like an NCT id." };

  const { tenant } = await guard("trial");
  const db = await getDb();
  try {
    const r = await importTrialByNct(db, tenant.id, nctId);
    if (!r.imported) {
      return { ok: false, message: `${nctId} could not be found on ClinicalTrials.gov.` };
    }
    revalidatePath("/trials");
    revalidatePath(`/trials/${nctId}`);
    return {
      ok: true,
      message: r.alreadyPresent
        ? `${nctId} is already in your workspace — refreshed it.`
        : `Saved ${nctId} to your workspace.`,
      href: `/trials/${nctId}`,
    };
  } catch (err) {
    return { ok: false, message: (err as Error)?.message?.slice(0, 160) ?? "Could not save that trial." };
  }
}

/**
 * Create a saved ClinicalTrials.gov watch for a topic and pull an initial
 * (bounded) batch so the watchlist isn't empty. Idempotent on the name.
 */
export async function monitorTopic(input: {
  name?: string;
  terms?: string;
  conditions?: string;
}): Promise<ActionResult> {
  const name = String(input?.name ?? "").trim().slice(0, 60);
  const terms = splitList(input?.terms);
  const conditions = splitList(input?.conditions);
  if (!name) return { ok: false, message: "Give the monitor a name." };
  if (!terms.length && !conditions.length) {
    return { ok: false, message: "Nothing to monitor — add a term or a condition." };
  }

  const { tenant, user } = await guard("watch", 10);
  const db = await getDb();

  const [existing] = await db
    .select({ id: watchlists.id })
    .from(watchlists)
    .where(and(eq(watchlists.tenantId, tenant.id), eq(watchlists.name, name)))
    .limit(1);
  if (existing) {
    return { ok: true, message: `You're already monitoring "${name}".`, href: "/watchlists" };
  }

  let watchlistId: string;
  try {
    const [wl] = await db
      .insert(watchlists)
      .values({
        tenantId: tenant.id,
        name,
        description: "Created from Ask newwin research.",
        ownerUserId: user.id,
        ctgovQuery: { terms, conditions },
      })
      .returning({ id: watchlists.id });
    watchlistId = wl.id;
  } catch {
    // Unique (tenant, name) race — treat as success.
    return { ok: true, message: `You're already monitoring "${name}".`, href: "/watchlists" };
  }

  try {
    await ingestWatchlist(db, { tenantId: tenant.id, watchlistId, maxStudies: 25 });
  } catch {
    // The watch is saved; the first pull can be retried by the cron job.
  }
  revalidatePath("/watchlists");
  return { ok: true, message: `Monitoring "${name}" — first results are loading.`, href: "/watchlists" };
}

/** Add a person surfaced by research as a lead (professional info only). */
export async function saveLead(input: {
  name?: string;
  title?: string;
  company?: string;
}): Promise<ActionResult> {
  const name = String(input?.name ?? "").trim().slice(0, 160);
  const title = String(input?.title ?? "").trim().slice(0, 160) || null;
  const company = String(input?.company ?? "").trim().slice(0, 160) || null;
  if (!name) return { ok: false, message: "A lead needs a name." };

  const { tenant } = await guard("lead");
  const db = await getDb();

  let organizationId: string | null = null;
  if (company) {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(and(eq(organizations.tenantId, tenant.id), eq(organizations.canonicalName, company)))
      .limit(1);
    if (org) {
      organizationId = org.id;
    } else {
      try {
        const [created] = await db
          .insert(organizations)
          .values({ tenantId: tenant.id, canonicalName: company, organizationType: "biotech" })
          .returning({ id: organizations.id });
        organizationId = created.id;
      } catch {
        organizationId = null;
      }
    }
  }

  const [dupe] = await db
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.tenantId, tenant.id), eq(people.name, name)))
    .limit(1);
  if (dupe) {
    return {
      ok: true,
      message: `${name} is already a lead.`,
      href: organizationId ? `/accounts/${organizationId}` : "/people",
    };
  }

  await db.insert(people).values({
    tenantId: tenant.id,
    organizationId,
    name,
    title,
    sourceEvidence: [{ kind: "ask_research" }],
  });
  revalidatePath("/people");
  if (organizationId) revalidatePath(`/accounts/${organizationId}`);
  return {
    ok: true,
    message: `Added ${name} as a lead.`,
    href: organizationId ? `/accounts/${organizationId}` : "/people",
  };
}

function splitList(v: unknown): string[] {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}
