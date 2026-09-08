# Integrations

Each external source is an independent adapter under
`src/integrations/<source>/`. Never one monolithic scraper (spec §58). An
adapter implements, roughly:

```ts
fetch()            // pull raw records from the source (HTTP first, browser only if required)
normalize()        // raw → our canonical shape + derived fields + a version hash
resolveEntities()  // map names → Organization / Asset / Disease / Person (alias-aware)
detectChanges()    // diff against the previous snapshot → typed change list
emitSignals()      // cluster + dedupe → CommercialSignal rows with provenance
```

Shared rules: respect `robots.txt`, rate limits and terms of service; never
bypass paywalls or access controls; prefer primary sources; HTTP + parser before
browser automation; hash/etag before full parse to keep cost down (spec §7/§85).

---

## ClinicalTrials.gov — API v2 *(implemented)*

`src/integrations/clinicaltrials/` · Base `https://clinicaltrials.gov/api/v2` ·
**no API key**.

| File | Responsibility |
| --- | --- |
| `client.ts` | Paginated `GET /studies` (`query.term`, `query.cond`, `filter.overallStatus`), polite `User-Agent`, 3-try exponential backoff on 429/5xx, hard page cap. `fetchOne(nctId)` for single lookups. |
| `types.ts` | Minimal typing of the v2 module structure we consume (`protocolSection.*`). Everything else is preserved in `trial_snapshots.raw_payload`. |
| `normalize.ts` | Nested modules → flat `NormalizedTrial`. Maps phase/status enums, parses `YYYY-MM` / `YYYY-MM-DD` dates, extracts endpoints, derives commercial flags, builds `commercialSummary`, computes `recordVersionHash`. |
| `diff.ts` | `diffTrials(prev, next)` → `DetectedChange[]`. Deterministic branches for status, phase, enrollment, arms/cohorts, interventions, conditions, countries/sites, molecular-eligibility onset, ctDNA/MRD/resistance endpoint onset, exploratory endpoints, sponsor/collaborator, primary-completion date. Each branch sets `severity`, `commercialRelevance` and a signal-taxonomy `signalType`. |
| `entities.ts` | `resolveOrganization()` — normalized-alias lookup → canonical-name match → autocreate a `watch`-tier org + alias row so trials always link somewhere. |
| `ingest.ts` | Orchestrator. Per watchlist: fetch → per study `ingestStudy()` → snapshot/diff/changes/signals → update `source_registry` health + `job_runs`. |

### Derived commercial-intelligence flags (spec §6/§141)

`normalize.ts` runs the ontology keyword detectors in
`src/lib/oncology/keywords.ts` over eligibility text, descriptions, endpoints,
biospec description and intervention text:

`molecularEligibility` · `ctdnaMentions` · `mrdMentions` · `ngsMentions` ·
`resistanceMonitoringMentions` · `serialSamplingMentions` · `centralLabMentions`
· `biomarkerRequirements[]` (extracted inclusion phrases).

These distinguish ctDNA / cfDNA / germline / tissue and mutation / amplification
/ fusion / expression language (spec §67) — a sequencing mention alone does not
imply a diagnostic strategy.

### `recordVersionHash`

SHA-256 over a canonical (sorted-key) projection of **commercially meaningful**
fields only — status, phase, enrollment, conditions, interventions, arms,
countries, endpoints, completion dates, sponsor, collaborators, biomarker flags.
Contact-list churn and formatting do not change it, so refreshes are idempotent.

### Watchlist query

`watchlists.ctgov_query` = `{ terms[], conditions[], statuses[], phases[] }`.
The seeded **RAS / KRAS** watchlist (spec §81/§116): terms KRAS / KRAS G12C/D/V /
pan-KRAS / pan-RAS / NRAS / HRAS / SOS1 / SHP2; conditions NSCLC, CRC, PDAC,
solid tumor; statuses RECRUITING, ACTIVE_NOT_RECRUITING, NOT_YET_RECRUITING.

### Running it

```bash
npm run ingest:ctgov -- --max=200          # CLI, all watchlists
curl -X POST -H "x-cron-secret: $CRON_SECRET" localhost:3000/api/cron/ctgov
```

Acceptance test §105: an enrollment change 60→180 produces one `trial_change`
(old/new stored), a recomputed score, one signal, a source link — and no
duplicate on the next refresh. Verified by re-running the ingestion: second pass
reports `unchangedTrials = N`, `signalsCreated = 0`.

---

## Planned adapters

| Adapter | Milestone | Source | Notes |
| --- | --- | --- | --- |
| `company-web/` | MVP 2 | company newsroom / IR / pipeline / leadership pages | RSS + `sitemap.xml` where available; content hashing before parse; classify change type (spec §7). Registered per org in `organization_sources`. |
| `pubmed/` | MVP 2 | NCBI E-utilities | monitor by company alias, drug code, target, NCT, author, biomarker. Resolve to org/author/asset/trial. `NCBI_API_KEY` optional. |
| `europepmc/` | MVP 2 | Europe PMC | preprints + full-text mentions. |
| `crossref/` | MVP 2 | Crossref | DOI metadata, `CROSSREF_MAILTO` polite pool. |
| `fda/` | MVP 2 | Drugs@FDA, openFDA, FDA press | approvals, CDx language, holds → map to commercial relevance (spec §9). |
| `sec/` | MVP 2 | SEC EDGAR | 8-K/10-Q/10-K/20-F/6-K/S-1 for public orgs; extract BD signals, commercial-relevance first (spec §10). |
| `conference/` | MVP 5 | ASCO/AACR/ESMO/… programs | abstract titles, Trials-in-Progress, presentation times; Conference Mode (spec §11). |
| `salesforce/` | MVP 3 | Salesforce REST | OAuth, field-mapping UI, read/create/update/upsert, dedupe, conflict handling, CRM update queue (spec §34–§37). CSV import/export fallback. |
| `email/` `calendar/` | MVP 4 | Gmail / Microsoft Graph | capture threads + meetings so interactions aren't logged by hand (spec §40); reply classification (spec §33). |

Missing credentials → the adapter interface still ships, the feature degrades
gracefully with setup instructions, and the rest of the system keeps working
(spec §115). Integrations are never faked as successful.
