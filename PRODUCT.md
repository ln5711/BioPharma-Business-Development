# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: biopharma **business-development professionals selling into oncology
drug developers** — BD Managers and Directors, Account Directors, Strategic
Account Managers, Commercial Strategy, and Translational / Diagnostic
Partnerships teams. Their employers are typically liquid-biopsy, molecular
diagnostics, central-lab, specialty-CRO, biomarker, CDx, sequencing, or oncology
data companies.

Situation: they already have too much fragmented scientific and corporate
information. The job is turning it into prioritized commercial action —
deciding *who to contact today, why now, what to say, and what happens next*.

A secondary audience (later milestones) is the BD **manager** reviewing pipeline,
coverage, and signal-to-meeting conversion.

## Product Purpose

An AI-native oncology **business-development operating system**. It continuously
watches the oncology landscape, identifies commercially relevant developments,
decides which companies / assets / trials deserve attention, finds the right
people inside those organizations, recommends why and when to contact them,
drafts personalized outreach, manages follow-up, captures relationship history,
and synchronizes the resulting activity with the CRM.

It is explicitly **not** a generic CRM, not an AI sales-email generator, not a
news aggregator, and not a ClinicalTrials.gov search interface.

Success = materially less time spent on manual company research, trial and
pipeline monitoring, paper tracking, contact mapping, spreadsheet upkeep, CRM
updates, outreach drafting, and meeting prep — while improving timing,
personalization, account coverage, scientific credibility, CRM hygiene, and
qualified commercial pipeline.

## Positioning

Generic sales AI understands *company, contact, email*. This system models the
oncology knowledge graph — company → asset → molecular target → pathway →
indication → trial → cohort → endpoint → biomarker → specimen → diagnostic need
→ scientific stakeholder → relationship → commercial timing — and converts a
**scientific event into a scored commercial action** with source provenance and
an explicit separation of fact, inference, and recommendation. The opportunity
score is deterministic and interpretable, never an LLM-generated number.

## Operating Context

The BD daily workflow the product is built around: review overnight signals →
dedup and relevance-score → open a signal → map the right stakeholders → check
for account collision (a colleague already engaging) → generate evidence-based
outreach → human approval → send → log the interaction → sync CRM → schedule
follow-up. A reply stops the sequence; a booked meeting generates a prep brief;
post-meeting notes and CRM updates are drafted for approval. Near major congresses
(ASCO, AACR, ESMO, …) a Conference Mode surfaces which priority accounts are
presenting and who to meet.

Salesforce (or another CRM) remains the external **system of record**; this app
is the working interface that reads from and writes back to it, with every
meaningful action carrying a CRM sync state.

External sources: **ClinicalTrials.gov API v2 is live**. Planned adapters:
PubMed / Europe PMC / Crossref, FDA (Drugs@FDA / openFDA), SEC EDGAR, company
newsroom / IR / pipeline / leadership pages, and conference programs.

## Capabilities and Constraints

**Live today (MVP 1):** ClinicalTrials.gov v2 ingestion; immutable trial
snapshots and first-class field-level change detection; a 44-value commercial
signal taxonomy; a deterministic 7-component opportunity score (0–100) with a
**separate** confidence score; a seeded RAS/KRAS watchlist; dashboard, intelligence
feed, trials list + commercially-framed trial view, and account pages.

**Scaffolded for later milestones:** company-web + publication monitoring
(MVP 2); Salesforce OAuth, contacts/accounts sync, and a CRM update-approval
queue (MVP 3); email/calendar capture, multi-touch and event-driven campaigns,
reply intelligence (MVP 4); conference intelligence, management-change tracking,
one-click meeting-prep briefs (MVP 5).

**Durable constraints:**

- Must run with **zero external services** — embedded PGlite database and a
  deterministic mock LLM provider when nothing is configured. Managed-host
  deploys (Vercel/serverless) require a real Postgres URL and refuse the PGlite
  fallback with an actionable message.
- The LLM sits behind a provider abstraction. Deterministic code owns scores,
  dates, dedupe, entity resolution, and every database / CRM write; the model is
  used only for interpretation, classification, extraction, summarization, and
  message generation.
- Multi-tenant data model (single-tenant UI in MVP 1); one customer's CRM data
  is never exposed to another.
- Professional-data guardrails: no sensitive personal attributes are gathered or
  inferred; no unauthorized scraping of restricted professional networks.
- Human approval is required before any first-touch outbound message.
- Scientific precision is mandatory: preserve ctDNA / cfDNA / germline / tissue
  DNA / RNA distinctions and mutation / amplification / fusion / expression /
  methylation distinctions; never assert a diagnostic partner that public
  sources do not disclose ("no publicly disclosed partner identified").

**Terminology this product owns:** *signal*, *opportunity score* vs *confidence*,
*why now*, *account coverage* / *relationship gap*, *commercial timing*
(too early · early · ideal · late · maintenance · closed), *prospective* vs
*retrospective* opportunity, *personalization levels 0–5*, *next best action*
(including "do nothing").

**Demo vertical:** RAS/KRAS oncology (KRAS/NRAS/HRAS/SOS1/SHP2 + RAF/MEK across
NSCLC, CRC, PDAC) is the canonical seeded configuration for demos; the
architecture supports any pathway or indication.

## Brand Commitments

- **Name:** *newwin* — always lowercase, set in the serif wordmark. Not yet a
  registered brand.
- **Deep-cobalt brand system is binding.** A deep, lightly desaturated
  cobalt / navy used *selectively*: neutral working surfaces with deep-blue
  navigation, accents, selected states, data-visualization highlights, and
  subtle gradients — not every surface blue, no rainbow coloring, and a clean
  editorial blue rather than a bright generic one. One muted clinical teal is
  reserved for data and informational cues. Color communicates meaning
  (priority and status). Primary theme is a light warm-paper canvas with
  dark-navy navigation; a dark mode is also supported (navy-ink canvas, no pure
  black).
- **Personality:** intelligent, calm, precise, premium, scientific, fast,
  trustworthy, minimal, sophisticated, modern. Never cartoonish, neon,
  cyberpunk, crypto-like, consumer-focused, chatbot-forward, Salesforce-like, or
  spreadsheet-like.
- **"Why now" is a recognizable, recurring UX element** — treated as part of the
  product's identity; every commercial opportunity makes its trigger obvious.
- AI should manifest as better prioritization, intelligence, recommendations,
  outreach, and less manual work — not as chat bubbles throughout the UI.
- **Inspiration only (do not copy layouts, identity, or assets):** Eli Lilly's
  editorial typography and generous whitespace; Viedoc's restrained clinical-
  software information architecture; high-end B2B SaaS composition. A subtle
  connections / signals / nodes motif is allowed; DNA-helix, molecule, pill, and
  generic biotech stock imagery are not.

## Evidence on Hand

- Source specifications: `docs/specs/01-master-build-prompt.md` and
  `docs/specs/02-design-system-add-on.md`.
- **Real data:** live ClinicalTrials.gov v2 records are the only real external
  data in the system.
- **Demo data is labelled `DEMO DATA`.** The seeded capability profile is
  modeled on a liquid-biopsy company; there are **no real customers, no
  connected CRM, and no revenue, pricing, testimonials, or benchmarks** — future
  work must not fabricate any of these.
- Deployed at `https://newwin.dev` (Vercel + Neon Postgres); source at
  `github.com/ln5711/BioPharma-Business-Development`.

## Product Principles

1. **Precision over volume.** Surface only commercially meaningful change;
   minimize noise; "do nothing" is a valid, first-class recommendation.
2. **Every claim is traceable.** Keep fact, inference, and recommendation
   visibly separate; always show sources; never present AI synthesis as a
   sourced fact.
3. **Deterministic where it counts.** Scores, dedupe, dates, and CRM writes are
   code, not model output — and the score's components are always exposed.
4. **Scientific credibility is non-negotiable.** Preserve molecular and assay
   distinctions; never imply an opportunity that public evidence contradicts.
5. **Information → action.** Every surface answers: what changed → why it
   matters → who to contact → what to say → what happens next.

## Accessibility & Inclusion

Maintain accessible contrast ratios in both light and dark themes. Desktop-first
(optimize for 1440px and laptop screens); tablet supported; mobile scoped to
signal review, notifications, account/contact lookup, and outreach approval. No
further product-specific accessibility standard has been established.
