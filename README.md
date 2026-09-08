# Oncology BD Platform

An AI-native **oncology business-development operating system**. Not a CRM, not an
AI email generator, not a news aggregator — a system that answers one question
continuously:

> Based on what changed in oncology, **who** should our BD team contact today,
> **why now**, **what** should we say, and **what** happens next?

The closed loop: external signal → scientific interpretation → commercial
interpretation → account/asset prioritization → right person → right reason →
personalized message → follow-up → response → meeting → CRM update → opportunity
→ next best action.

This repository is **MVP 1**: the architecture, the relational knowledge model,
the application shell, and a live **ClinicalTrials.gov** integration with trial
snapshotting, change detection, a deterministic signal engine, and an
interpretable opportunity-scoring model. Later milestones (company-web +
publication monitoring, Salesforce, email/campaigns, conference intelligence) are
scaffolded and documented — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

The source specifications live in [`docs/specs/`](docs/specs).

---

## Quick start

```bash
npm install
cp .env.example .env.local        # and .env for scripts (defaults work offline)
npm run db:migrate                # applies SQL migrations
npm run seed                      # RAS/KRAS demo config (spec §81/§82)
npm run ingest:ctgov              # LIVE pull from ClinicalTrials.gov API v2
npm run dev                       # http://localhost:3000
```

No external services are required. With `DATABASE_URL` empty the app runs on an
embedded **PGlite** database (real Postgres, WASM) written to `./.pglite`. Set
`DATABASE_URL` to use a real Postgres instance instead — the schema, migrations
and queries are identical.

The language model is abstracted behind a provider interface. `LLM_PROVIDER=mock`
(the default) produces deterministic, clearly-labelled text so every flow works
with **no API key**. Set `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` for
production copy.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit`, strict mode |
| `npm run lint` | ESLint |
| `npm run db:generate` | Regenerate SQL migrations from the Drizzle schema |
| `npm run db:migrate` | Apply migrations (Postgres or PGlite) |
| `npm run db:reset` | Drop everything (dev only) |
| `npm run db:studio` | Drizzle Studio (requires `DATABASE_URL`) |
| `npm run seed` | Seed tenant, capability profile, RAS/KRAS watchlist, ontology, company universe |
| `npm run ingest:ctgov` | Run the ClinicalTrials.gov ingestion for every watchlist (`-- --max=N`) |

## Background jobs

`POST /api/cron/ctgov` with header `x-cron-secret: $CRON_SECRET` runs the same
ingestion — point a scheduler at it (spec §59/§60). Jobs are idempotent: an
unchanged trial on the next refresh produces no new snapshot, change or signal.

---

## Environment variables

See [`.env.example`](.env.example) for the annotated list. Key ones:

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | *(empty)* | Empty → embedded PGlite. Set → Postgres. |
| `LLM_PROVIDER` | `mock` | `mock` \| `anthropic` \| `openai` |
| `ANTHROPIC_API_KEY` | *(empty)* | Required when `LLM_PROVIDER=anthropic` |
| `CLINICALTRIALS_BASE_URL` | `https://clinicaltrials.gov/api/v2` | No key required |
| `CRON_SECRET` | `dev-only-change-me` | Guards `/api/cron/*` |

**Never commit secrets.** `.env*` is git-ignored (`.env.example` excepted).

---

## Documentation

| Doc | Contents |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, module boundaries, MVP roadmap, key decisions |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Entity-relationship overview, first-class objects, indexes |
| [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) | Adapter contract; ClinicalTrials.gov specifics; planned adapters |
| [`docs/SCORING.md`](docs/SCORING.md) | The 7-component opportunity model, confidence, configurability |
| [`docs/SOURCE_REGISTRY.md`](docs/SOURCE_REGISTRY.md) | Source registry, health telemetry, cost control |

## Tech stack

Next.js 15 (App Router, RSC) · TypeScript strict · Tailwind v4 · Drizzle ORM ·
PostgreSQL / PGlite · Zod · Lucide. Deterministic code owns scores, dates,
dedupe and DB writes; the LLM is used only for interpretation, classification,
extraction, summarization and message generation (spec §57).
