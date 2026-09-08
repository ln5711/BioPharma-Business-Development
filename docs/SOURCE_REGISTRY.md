# Source registry & change detection

## `source_registry` (spec §6 / §78)

The admin-managed catalog of every ingestion source, one row per tenant per
source (ClinicalTrials.gov registers one row per tenant). Fields:

| Field | Purpose |
| --- | --- |
| `name`, `source_type`, `access_method` (`api\|rss\|sitemap\|http\|manual`) | identity |
| `authority_level` (`primary\|secondary\|tertiary`) | prefer primary sources |
| `url`, `config` (jsonb) | endpoint + adapter-specific settings |
| `update_frequency_minutes`, `reliability_score`, `robots_allowed` | crawl policy |
| `last_checked_at`, `last_success_at`, `last_failure_at`, `last_change_at`, `failure_count`, `last_error` | **health telemetry** |
| `health` (`healthy\|degraded\|failing\|disabled`) | rollup shown in Settings |
| `signals_produced`, `opportunities_produced`, `meetings_produced` | **value attribution** (spec §76) |

`organization_sources` is the per-company equivalent for MVP 2 web monitoring —
same hash/etag/health columns, plus `page_category` (`newsroom`, `pipeline`,
`investor_relations`, `leadership`, …), `crawl_frequency_minutes`, `parser`.

## Source health dashboard (spec §79)

`Settings → Source registry` lists each source with its health pill, signals
produced and failure count. Do not fail silently: on an ingestion exception the
adapter sets `health = 'failing'`, increments `failure_count`, records
`last_error`, and marks the `job_runs` row `error`. Successful runs reset the
counter and stamp `last_success_at` / `last_change_at`.

## Change-detection pipeline (spec §53 / §85)

Cost control — do **not** send every payload through an expensive LLM:

```
fetch (HTTP; etag / If-None-Match where supported)
  → content hash            unchanged? STOP
  → normalize / DOM cleanup
  → deterministic diff       field-level; classify severity
        cosmetic  → ignore
        minor     → record, low relevance
        meaningful→ record + signal
        high      → record + signal + higher urgency
  → ontology keyword filter  is any commercial concept present?
  → cheap rule classifier    map to signal taxonomy (spec §14)
  → LLM interpretation       ONLY for meaningful+ changes, with the diff + minimal context
  → cache
```

For ClinicalTrials.gov the "content hash" is `recordVersionHash` (commercial
fields only) and the deterministic diff is `diffTrials()`. The LLM step is
optional — with `LLM_PROVIDER=mock` the interpretation text is templated from
the deterministic change and the trial's derived flags.

## `job_runs` (spec §60)

Every ingestion pass writes a `job_runs` row: `job_name`, `status`
(`running\|success\|error`), `started_at`/`finished_at`, `stats` jsonb
(fetched / newTrials / updatedTrials / unchangedTrials / trialChanges /
signalsCreated / errors), `error`. Jobs are idempotent, retryable and logged.

## Scheduling (spec §59)

| Source | Cadence |
| --- | --- |
| ClinicalTrials.gov | daily, after the upstream refresh |
| Company high-value pages | every few hours – daily |
| SEC EDGAR | frequent polling / feed cadence |
| PubMed / Europe PMC / Crossref | daily |
| Company leadership pages | daily – a few times weekly |
| Conference programs | ramp up near the meeting |

Point any scheduler (cron, a queue worker, a platform cron) at
`POST /api/cron/ctgov` with the `x-cron-secret` header.
