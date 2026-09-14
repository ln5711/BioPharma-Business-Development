import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { discoveredContacts, discoveryJobs, organizations } from "@/db/schema";
import { resolveOrganization } from "@/integrations/clinicaltrials/entities";
import { anthropic } from "@/lib/llm";
import { contactDiscoveryCacheKey, getCachedExtraction, putCachedExtraction } from "./cache";
import { resolveContactEmail } from "./email";
import { countUseCaseKeywordHits, scoreContact } from "./rank";
import { ExtractionSchema, type Candidate, type Extraction } from "./types";
import { sanitizeUrl } from "./url-safety";

export interface StartDiscoveryParams {
  tenantId: string;
  userId: string;
  queryText: string;
  companyName?: string | null;
  organizationId?: string | null;
  signalId?: string | null;
  assetId?: string | null;
  trialId?: string | null;
  assetOrTrialLabel?: string | null;
  useCase?: string | null;
  forceRefresh?: boolean;
}

export async function startDiscoveryJob(params: StartDiscoveryParams): Promise<{ jobId: string }> {
  const db = await getDb();
  const [row] = await db
    .insert(discoveryJobs)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      queryText: params.queryText.slice(0, 500),
      companyName: params.companyName ?? null,
      organizationId: params.organizationId ?? null,
      signalId: params.signalId ?? null,
      assetId: params.assetId ?? null,
      trialId: params.trialId ?? null,
      useCase: params.useCase ?? null,
      status: "queued",
    })
    .returning({ id: discoveryJobs.id });
  return { jobId: row.id };
}

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

function cleanDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return DOMAIN_RE.test(d) ? d : null;
}

/** Bounded, real research → structured extraction pipeline (spec §8: not a
 * fictional-people fallback — a failure stays a failure). Runs to completion
 * inside ONE invocation (see the route's `after()` wiring for how the response
 * returns before this runs), updating `discoveryJobs` as it goes so the client
 * can poll for partial progress / recovery. */
export async function runDiscoveryJob(jobId: string, opts: { forceRefresh?: boolean } = {}): Promise<void> {
  const db = await getDb();
  const [job] = await db.select().from(discoveryJobs).where(eq(discoveryJobs.id, jobId)).limit(1);
  if (!job) return;

  await db.update(discoveryJobs).set({ status: "running", updatedAt: new Date() }).where(eq(discoveryJobs.id, jobId));

  const client = anthropic();
  if (!client) {
    await db
      .update(discoveryJobs)
      .set({ status: "provider_not_configured", error: "Research provider is not configured (ANTHROPIC_API_KEY / LLM_PROVIDER).", updatedAt: new Date() })
      .where(eq(discoveryJobs.id, jobId));
    return;
  }

  try {
    // ── resolve the target organization + its known email domain ──────────
    let org: { id: string; canonicalName: string; canonicalDomain: string | null } | null = null;
    if (job.organizationId) {
      const [o] = await db
        .select({ id: organizations.id, canonicalName: organizations.canonicalName, canonicalDomain: organizations.canonicalDomain })
        .from(organizations)
        .where(eq(organizations.id, job.organizationId))
        .limit(1);
      org = o ?? null;
    } else if (job.companyName) {
      const orgId = await resolveOrganization(db, job.tenantId, job.companyName);
      if (orgId) {
        const [o] = await db
          .select({ id: organizations.id, canonicalName: organizations.canonicalName, canonicalDomain: organizations.canonicalDomain })
          .from(organizations)
          .where(eq(organizations.id, orgId))
          .limit(1);
        org = o ?? null;
      }
    }

    const companyLabel = org?.canonicalName ?? job.companyName ?? null;
    const cacheKey = companyLabel
      ? contactDiscoveryCacheKey(companyLabel, `${job.queryText}|${job.useCase ?? ""}`)
      : null;

    let extraction: Extraction | null = null;
    if (cacheKey && !opts.forceRefresh) {
      const cached = await getCachedExtraction(cacheKey);
      if (cached) extraction = cached.extraction;
    }

    let researchRequestId: string | null = null;
    let extractionRequestId: string | null = null;

    if (!extraction) {
      const focus = [companyLabel, job.useCase].filter(Boolean).join(" — ");
      const research = await client.research({
        system:
          "You are a professional background researcher for oncology business development. " +
          "Search PUBLIC, INDEXED professional sources only: official company leadership / scientific-team / " +
          "program pages, conference speaker biographies and presentations, publications and current " +
          "affiliations, ClinicalTrials.gov sponsor/contact records, and company announcements. " +
          "Do NOT attempt to log into LinkedIn, bypass a login wall or CAPTCHA, or access any paywalled/" +
          "restricted source. If LinkedIn results are not reachable through public search, say so plainly " +
          "and continue with the other sources — never fabricate a LinkedIn URL. " +
          "Cite the exact source URL for every fact; do not rely on training memory for current employment " +
          "or roles. For each promising person prioritise these functions: translational medicine, biomarker " +
          "development/strategy, precision medicine, companion diagnostics, oncology clinical development, " +
          "clinical program leadership, clinical operations (when assay-relevant), and external innovation / " +
          "diagnostic partnerships. Distinguish sponsor EMPLOYEES from academic investigators and " +
          "patient-recruitment/site or media contacts. Also separately note any OTHER named employees at the " +
          "company whose email address is published anywhere (a press release, paper, or contact page) — " +
          "these are used only to infer the company's email naming convention.",
        prompt:
          `Research query: ${job.queryText}\n` +
          (focus ? `Focus: ${focus}\n` : "") +
          "Return a readable briefing covering the people found, their roles, and cited evidence, plus any " +
          "named-employee email examples for the company's domain.",
        maxUses: 6,
        timeoutMs: 40_000,
      });
      researchRequestId = research.meta.requestId;

      const extracted = await client.generateObject({
        system:
          "Extract STRUCTURED candidate contact records from the research text. Only include a person when " +
          "the text gives at least one concrete, cited piece of evidence for them (a URL) — never invent a " +
          "person or an unsupported claim. Exclude patient-recruitment/site staff, media/press contacts, and " +
          "academic investigators with no sponsor-employee evidence, unless they otherwise hold a listed " +
          "relevant function. Set hasDirectProgramEvidence=true ONLY when a citation explicitly names this " +
          "person in connection with the specific asset/trial/program asked about — being employed at the " +
          "sponsor company alone is NOT enough. Do not include a headshotUrl unless a cited source is " +
          "literally a photo of this named person — omit it otherwise, never guess or construct one. " +
          "companyDomain should be the company's own primary email/website domain if evident from the sources.",
        prompt: JSON.stringify({
          query: job.queryText,
          company: companyLabel,
          useCase: job.useCase,
          researchBriefing: research.text,
          citations: research.citations,
        }).slice(0, 40_000),
        schema: ExtractionSchema,
        timeoutMs: 25_000,
      });
      extraction = extracted;
      extractionRequestId = researchRequestId; // generateObject doesn't currently surface a separate id
      if (cacheKey) void putCachedExtraction(cacheKey, extraction);
    }

    // ── resolve employer domain (persist back onto the org if newly found) ──
    const domain = org?.canonicalDomain ?? cleanDomain(extraction.companyDomain);
    if (domain && org && !org.canonicalDomain) {
      await db.update(organizations).set({ canonicalDomain: domain, updatedAt: new Date() }).where(eq(organizations.id, org.id));
    }

    // Pool of named-employee examples ACROSS all candidates, for pattern inference.
    const pooledExamples = extraction.candidates.flatMap((c) =>
      c.employeeEmailExamples
        .filter((e) => sanitizeUrl(e.sourceUrl))
        .map((e) => ({ ...e, sourceUrl: e.sourceUrl })),
    );

    let inserted = 0;
    const assetOrTrialLabel = job.useCase; // context label, set by the caller when applicable
    for (const cand of extraction.candidates) {
      const row = buildDiscoveredContactRow(cand, {
        jobId,
        tenantId: job.tenantId,
        organizationId: org?.id ?? null,
        companyLabel,
        assetId: job.assetId,
        trialId: job.trialId,
        signalId: job.signalId,
        useCase: job.useCase,
        assetOrTrialLabel,
        domain,
        pooledExamples,
      });
      if (!row) continue;
      await db.insert(discoveredContacts).values(row);
      inserted++;
    }

    await db
      .update(discoveryJobs)
      .set({
        status: inserted > 0 || extraction.candidates.length === 0 ? "complete" : "partial",
        coverage: extraction.coverage,
        resultCount: inserted,
        researchRequestId,
        extractionRequestId,
        updatedAt: new Date(),
      })
      .where(eq(discoveryJobs.id, jobId));
  } catch (err) {
    await db
      .update(discoveryJobs)
      .set({ status: "failed", error: (err as Error)?.message?.slice(0, 300) ?? "research failed", updatedAt: new Date() })
      .where(eq(discoveryJobs.id, jobId));
  }
}

function buildDiscoveredContactRow(
  cand: Candidate,
  ctx: {
    jobId: string;
    tenantId: string;
    organizationId: string | null;
    companyLabel: string | null;
    assetId: string | null;
    trialId: string | null;
    signalId: string | null;
    useCase: string | null;
    assetOrTrialLabel: string | null;
    domain: string | null;
    pooledExamples: { name: string; email: string; sourceUrl: string; date?: string | null }[];
  },
) {
  const evidence = cand.evidence
    .map((e) => ({ kind: e.kind, url: sanitizeUrl(e.url) ?? undefined, excerpt: e.excerpt ?? undefined, date: e.date ?? null }))
    .filter((e) => e.url);
  if (evidence.length === 0) return null; // no evidence → not a result, per spec

  const descText = [cand.description, cand.whyThisPerson, ...evidence.map((e) => e.excerpt ?? "")].join(" ");
  const label = ctx.assetOrTrialLabel?.toLowerCase();
  // Cross-check the model's own claim: don't trust hasDirectProgramEvidence
  // unless the evidence text actually names the program, when we know its label.
  const hasDirectProgramEvidence =
    cand.hasDirectProgramEvidence && (!label || descText.toLowerCase().includes(label));

  const publishedEmail =
    cand.publishedEmail && evidence[0]?.url
      ? { address: cand.publishedEmail, source: { kind: "company_page", url: evidence[0].url } }
      : null;

  const emailResult = resolveContactEmail({
    personName: cand.name,
    publishedEmail,
    employerDomain: ctx.domain,
    employeeExamples: ctx.pooledExamples,
    resolvedAt: new Date().toISOString(),
  });

  const rank = scoreContact({
    function: cand.function,
    seniority: cand.seniority,
    hasDirectProgramEvidence,
    useCaseKeywordHits: countUseCaseKeywordHits(descText),
    evidenceCount: evidence.length,
    independentSourceCount: new Set(evidence.map((e) => e.url)).size,
    newestEvidenceDate: evidence.map((e) => e.date).filter((d): d is string => !!d).sort().pop() ?? null,
  });

  return {
    jobId: ctx.jobId,
    tenantId: ctx.tenantId,
    name: cand.name.slice(0, 150),
    title: cand.title ?? null,
    company: ctx.companyLabel,
    organizationId: ctx.organizationId,
    function: cand.function,
    seniority: cand.seniority,
    professionalProfileUrl: sanitizeUrl(cand.professionalProfileUrl),
    headshotUrl: sanitizeUrl(cand.headshotUrl),
    headshotSourceUrl: sanitizeUrl(cand.headshotSourceUrl),
    description: cand.description ?? null,
    whyThisPerson: cand.whyThisPerson,
    whyNow: ctx.useCase ? `Signal/use case: ${ctx.useCase}` : null,
    relatedAssetId: ctx.assetId,
    relatedTrialId: ctx.trialId,
    relatedSignalId: ctx.signalId,
    useCase: ctx.useCase,
    contactLabel: rank.label,
    relevanceScore: rank.total,
    relevanceBreakdown: rank.breakdown as unknown as Record<string, number>,
    sourceEvidence: evidence,
    emailResult,
    emailAddress: emailResult.address,
    emailProvenance: emailResult.provenance,
    emailDeliverability: "not_checked" as const,
  };
}
