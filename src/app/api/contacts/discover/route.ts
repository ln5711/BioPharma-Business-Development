import { NextResponse } from "next/server";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { discoveredContacts, discoveryJobs } from "@/db/schema";
import { getOptionalAuth } from "@/lib/tenant";
import { checkAndIncrement } from "@/lib/ask/rate-limit";
import { runDiscoveryJob, startDiscoveryJob } from "@/lib/contacts/discover";
import { parseContactQuery } from "@/lib/contacts/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PER_MIN = 8;
const TENANT_PER_MIN = 20;

/** POST — start a bounded discovery run. Returns immediately with a job id;
 * the actual research runs via `after()` so the client polls GET for
 * progress/results instead of holding one long request open. */
export async function POST(req: Request) {
  const auth = await getOptionalAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { tenant, user } = auth;

  const [byUser, byTenant] = await Promise.all([
    checkAndIncrement(`contacts:discover:user:${user.id}`, PER_MIN, 60_000),
    checkAndIncrement(`contacts:discover:tenant:${tenant.id}`, TENANT_PER_MIN, 60_000),
  ]);
  if (!byUser.ok || !byTenant.ok) {
    return NextResponse.json({ error: "rate_limited", message: "Too many searches — try again in a minute." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const queryText = String(body.query ?? "").trim().slice(0, 400);
  if (!queryText) return NextResponse.json({ error: "empty_query" }, { status: 400 });

  const companyName = typeof body.companyName === "string" ? body.companyName.trim().slice(0, 200) : null;
  const parsed = parseContactQuery(queryText, {
    companyName,
    assetOrTrialLabel: typeof body.assetOrTrialLabel === "string" ? body.assetOrTrialLabel : null,
    useCase: typeof body.useCase === "string" ? body.useCase : null,
  });

  const { jobId } = await startDiscoveryJob({
    tenantId: tenant.id,
    userId: user.id,
    queryText,
    companyName: parsed.companyName,
    organizationId: typeof body.organizationId === "string" ? body.organizationId : null,
    signalId: typeof body.signalId === "string" ? body.signalId : null,
    assetId: typeof body.assetId === "string" ? body.assetId : null,
    trialId: typeof body.trialId === "string" ? body.trialId : null,
    useCase: typeof body.useCase === "string" ? body.useCase : parsed.useCaseHints[0] ?? null,
    forceRefresh: Boolean(body.forceRefresh),
  });

  after(() => runDiscoveryJob(jobId, { forceRefresh: Boolean(body.forceRefresh) }));

  return NextResponse.json({ jobId, status: "queued" }, { status: 202 });
}

/** GET ?jobId=... — poll job status; when complete/partial, includes results. */
export async function GET(req: Request) {
  const auth = await getOptionalAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "missing jobId" }, { status: 400 });

  const db = await getDb();
  const [job] = await db
    .select()
    .from(discoveryJobs)
    .where(and(eq(discoveryJobs.id, jobId), eq(discoveryJobs.tenantId, auth.tenant.id)))
    .limit(1);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let results: (typeof discoveredContacts.$inferSelect)[] = [];
  if (job.status === "complete" || job.status === "partial") {
    results = await db
      .select()
      .from(discoveredContacts)
      .where(and(eq(discoveredContacts.jobId, job.id), eq(discoveredContacts.tenantId, auth.tenant.id)))
      .orderBy(discoveredContacts.relevanceScore);
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  return NextResponse.json({
    job: {
      id: job.id,
      status: job.status,
      coverage: job.coverage,
      error: job.error,
      resultCount: job.resultCount,
      queryText: job.queryText,
      createdAt: job.createdAt,
    },
    results,
  });
}
