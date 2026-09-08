# Data model

A structured relational knowledge model (spec §4/§5/§62) — **not** document-centric.
Defined with Drizzle in `src/db/schema/`, one file per domain, re-exported from
`src/db/schema/index.ts`. Primary keys are UUID (`gen_random_uuid()`); timestamps
are `timestamptz`; enums are Postgres enums; many-to-many uses join tables, not
JSON blobs. JSON (`jsonb`) is used only where flexibility genuinely helps
(alias arrays, raw endpoint lists, upstream payloads, capability inventory).

## Entity map

```
tenants ─┬─ users
         ├─ capability_profiles        (what the customer sells — drives scoring)
         ├─ scoring_profiles           (configurable component weights)
         └─ ai_corrections             (persisted user overrides, spec §87)

organizations ─┬─ organization_aliases         (JNJ / Janssen / Janssen Biotech)
               ├─ organization_sources         (pages/feeds to monitor + hashes)
               ├─ organization_partners        (announced Dx/CRO relationships, evidence required)
               └─ account_coverage             (per-function relationship strength)

assets ─┬─ asset_aliases                (dev code / generic / brand)
        ├─ asset_targets ── targets
        ├─ asset_pathways ── pathways
        └─ asset_indications ── diseases

trials ─┬─ trial_snapshots             ★ immutable version history
        ├─ trial_changes               ★ first-class field-level deltas
        ├─ trial_assets ── assets
        ├─ trial_conditions ── diseases
        └─ trial_biomarkers ── biomarkers

people ─┬─ person_asset_evidence       ★ every asset link carries a source + confidence
        ├─ relationships               (tenant + owner scoped state)
        └─ interactions                (CRM-ready activity log)

commercial_signals ─┬─ signal_sources  ★ provenance, FACT/INFERENCE/RECOMMENDATION
                    └─ signal_feedback (preference-training verdicts)

opportunities ── opportunity_score_components   (7 sub-scores + rationale)

watchlists ── watchlist_items
source_registry            (ingestion catalog + health + value attribution)
job_runs                   (idempotent, observable background runs)
```

★ = **first-class objects** the product is built around.

## Reference ontology (shared, not tenant-scoped)

`targets` (KRAS, NRAS, HRAS, SOS1, PTPN11/SHP2, BRAF, MEK …), `pathways`
(RAS/MAPK, PI3K/AKT/mTOR, DDR, FGFR, HER2, EGFR, IO …), `diseases` (with
`disease_aliases` — "NSCLC" ↔ "non-small cell lung cancer"), `biomarkers`
(type / target / alteration / assay / specimen / clinical role). Seeded for the
RAS demo vertical; extensible — never hard-coded to a fixed list (spec §68).

## First-class objects — why

### `trial_snapshots`
Immutable normalized record per `record_version_hash`. Keeps `payload` (our
`NormalizedTrial`) and `raw_payload` (the upstream v2 study) for audit. "Store
previous snapshots. Diff them. Do not merely ingest current values." (spec §6)

### `trial_changes`
One row per field-level delta: `field_changed`, `old_value`, `new_value`,
`severity` (`cosmetic|minor|meaningful|high`), `commercial_relevance` (0–100),
`summary`, snapshot pointers. Unique on `(trial_id, field_changed, to_snapshot_id)`
so a re-run never duplicates. Drives the signal engine (spec §14).

### `commercial_signals`
`signal_type` (44-value taxonomy), `category`, entity FKs, and — kept separate
per spec §56 — `fact_summary`, `scientific_interpretation`,
`commercial_interpretation`, `why_it_matters`, `why_now`, `recommended_action`.
`opportunity_score` and `confidence_score` are distinct columns (spec §16).
`dedupe_key` + unique `(tenant_id, dedupe_key)` implement clustering: five
sources describing one event → one signal with five `signal_sources`.

### `person_asset_evidence`
A person is never linked to an asset by company employment alone. Each row is
`evidence_kind` (`publication_coauthor | trial_contact | speaker | job_title`) +
`confidence` + `url` + `excerpt` (spec §19).

## Notable indexes (spec §62)

`organizations(tenant_id, canonical_name)` unique · `organization_aliases(normalized)` ·
`assets(development_code)` · `trials(tenant_id, nct_id)` unique · `trials(nct_id)` ·
`trials(record_version_hash)` · `trial_snapshots(trial_id, record_version_hash)` unique ·
`trial_changes(trial_id, field_changed, to_snapshot_id)` unique ·
`commercial_signals(tenant_id, dedupe_key)` unique ·
`commercial_signals(opportunity_score)` · `commercial_signals(detected_at)` ·
`people(public_email)` · `relationships(tenant_id, person_id)` unique.

## Tenancy & safety

Every commercial table carries `tenant_id` with `ON DELETE CASCADE` from
`tenants`. All application queries filter by it. Internal notes / CRM data are
modelled distinctly from web-sourced intelligence and are never mixed into
outbound copy automatically (spec §90).
