# Architecture

## 1. Product thesis

BD professionals do not need more information — they need fragmented scientific
and corporate information turned into **prioritized commercial action**. Every
capability in this system exists to move a user from *"I found an interesting
article"* to *"This Phase II program just added a ctDNA exploratory endpoint;
their Translational Medicine lead hasn't been contacted in 94 days; here are the
two decision-makers, the source, and a personalized message."*

The unique capability — the moat — is **scientific event → commercial action**.
The system understands company, asset, molecular target, pathway, indication,
trial, cohort, endpoint, biomarker, specimen, diagnostic need, scientific
stakeholder, relationship and commercial timing as **structured, related
entities** — not documents.

## 2. Layered design

```
┌─────────────────────────────────────────────────────────────────────┐
│  UI  — Next.js App Router (RSC), design system (spec §126–§158)      │
│        app shell · dashboard · signals feed · account/asset/trial    │
├─────────────────────────────────────────────────────────────────────┤
│  Application services  (src/lib)                                     │
│    signals/        taxonomy · emit (dedupe, FACT/INFERENCE/REC)      │
│    scoring/        deterministic 7-component opportunity model       │
│    oncology/       keyword + ontology detectors, term normalization  │
│    llm/            provider abstraction (anthropic | openai | mock)  │
│    queries.ts      read models for pages                             │
├─────────────────────────────────────────────────────────────────────┤
│  Integration adapters  (src/integrations/<source>)                   │
│    fetch() · normalize() · resolveEntities() · detectChanges()       │
│    · emitSignals()          — one adapter per source, never a        │
│                               monolithic scraper (spec §58)          │
├─────────────────────────────────────────────────────────────────────┤
│  Data  — Drizzle ORM · PostgreSQL / PGlite · SQL migrations          │
│         relational knowledge model (spec §4/§5/§62)                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Deterministic vs. AI (spec §57)

| Deterministic code | Language model |
| --- | --- |
| Opportunity & confidence scores | Scientific interpretation |
| Dates, diffs, dedupe keys, hashes | Commercial classification |
| Entity resolution / alias matching | Entity extraction from free text |
| All database + CRM writes | Summarization |
| Signal-type classification (rules) | Outreach & follow-up generation |
|  | Reply classification, meeting briefs, copilot |

The LLM never produces a score. Structured LLM output is validated with Zod and
retried once on a validation miss.

## 3. Request & job flow

**Read path** — RSC pages call `src/lib/queries.ts` / `src/db` directly. Every
query filters by `tenantId`. Pages that touch the DB are `force-dynamic`.

**Ingestion path** — `scripts/ingest-ctgov.ts` or `POST /api/cron/ctgov`
→ `integrations/clinicaltrials/ingest.ts`:

```
CtgovClient.studies(query)           paginated, polite UA, backoff
  → normalizeStudy()                 nested v2 modules → NormalizedTrial
                                     + derived commercial flags + recordVersionHash
  → resolveOrganization()            sponsor → Organization (alias-aware, autocreate)
  → upsert trials row
  → insert trial_snapshots           immutable, one per version hash
  → diffTrials(prev, next)           field-level DetectedChange[] (spec §14)
      → insert trial_changes         first-class, deduped
      → emitSignal()                 CommercialSignal + signal_sources
          → scoreOpportunity()       deterministic 7-component model
```

Idempotency: `recordVersionHash` is computed only over commercially meaningful
fields, so cosmetic upstream churn is a no-op. `trial_changes` and
`commercial_signals` have unique dedupe indexes (acceptance tests §105/§110).

## 4. Multi-tenancy

MVP 1 is single-tenant in the UI (`getActiveTenant()` returns the first tenant),
but the schema is already tenant-scoped end to end. Auth + real tenant
resolution land in MVP 3. Reference ontology (`targets`, `pathways`, `diseases`,
`biomarkers`) is shared; everything commercial is per-tenant.

## 5. Database driver strategy

`src/db/index.ts` picks a driver at first use:

- `DATABASE_URL` set → `postgres-js`
- empty → **PGlite** (embedded Postgres, WASM) at an absolute `PGLITE_DATA_DIR`

Both are real Postgres. `@electric-sql/pglite` and `postgres` are in
`serverExternalPackages` so they load from `node_modules` at runtime rather than
being bundled. The connection is created lazily (never at import time — that
would boot PGlite during `next build`).

## 6. MVP roadmap (spec §80)

| Milestone | Scope | Status |
| --- | --- | --- |
| **MVP 1** | Auth stub, orgs/assets/trials, watchlists, **ClinicalTrials.gov**, trial change detection, signal feed, opportunity scoring, basic contacts, outreach-draft scaffold, CRM-ready activity log | **this repo** |
| MVP 2 | Company website + press-release monitoring, PubMed / Europe PMC / Crossref, publication→asset resolution, daily intelligence brief | schema + adapter contract in place |
| MVP 3 | Salesforce OAuth, contacts/accounts sync, CRM update queue, dedupe, two-way relationship history | schema in place (`crm_id`, `crmSyncStatus`, `relationships`, `aiCorrections`) |
| MVP 4 | Email/calendar integration, campaigns, event-driven sequences, reply intelligence, auto activity logging | schema hooks (`interactions`, campaign fields) |
| MVP 5 | Conference intelligence, management-change monitoring, meeting-prep briefs, advanced account mapping | taxonomy + `accountCoverage` in place |

## 7. Key decisions

1. **PGlite default, Postgres opt-in.** Zero-setup demo; identical SQL. Trade-off:
   PGlite is single-connection and in-process — fine for MVP, not for production
   concurrency. Flip `DATABASE_URL` to graduate.
2. **Trial changes and signals are first-class rows, never overwrites.** The
   product's value is *what changed and when*, so history is the point.
3. **`recordVersionHash` over commercial fields only.** Keeps refreshes cheap and
   idempotent; avoids signal spam from contact-list reshuffles.
4. **Rule-based signal-type classification, LLM-based interpretation.** The
   taxonomy mapping (spec §14) is deterministic; prose is generated. This keeps
   scores reproducible and auditable.
5. **Interpretable additive scoring.** Seven bounded components summing to 100,
   each with a rationale string, configurable weights per tenant (spec §88).
6. **Provider abstraction + mock provider.** Core logic depends on an interface,
   not a vendor SDK. The mock keeps the whole app runnable offline without faking
   a successful *integration* (spec §115) — generated text is labelled as such.
7. **One adapter per source.** `fetch/normalize/resolveEntities/detectChanges/
   emitSignals`. No shared scraper. Adding PubMed doesn't touch ClinicalTrials.
8. **Next lint doesn't gate `next build`** (`eslint.ignoreDuringBuilds`); lint is
   a separate CI step so a style warning never blocks a deploy.

## 8. Directory map

```
src/
  app/
    (app)/            authenticated shell + pages
    api/cron/ctgov/   background ingestion endpoint
  components/
    app-shell/        sidebar, topbar, nav config
    ui/               primitives (Card, Pill, Stat, EmptyState, ModuleStub)
    domain/           SignalBadge, WhyNow, OpportunityScore, OpportunityCard
  db/
    schema/           Drizzle tables by domain + relations
    index.ts          driver selection
  integrations/
    clinicaltrials/   client, types, normalize, diff, entities, ingest
  lib/
    signals/          taxonomy, emit
    scoring/          model
    oncology/         keywords, normalize-terms
    llm/              types, anthropic, mock, index
    env.ts queries.ts tenant.ts utils.ts
scripts/              migrate, reset, seed, ingest-ctgov
drizzle/              generated SQL migrations (committed)
docs/                 this documentation + specs/
```
