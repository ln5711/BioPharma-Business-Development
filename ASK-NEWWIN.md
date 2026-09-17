# Ask newwin — Claude-powered assistant

Companion to `DEPLOYMENT.md`. Covers what shipped on
`harden/identity-session-themes-priorities` for the Ask newwin / search /
outreach / event-date work, how to verify it, and the exact remaining
configuration.

---

## 1. What now works end to end

### Ask newwin (`/api/ask`, `AskBar`)
- **Intent first, feed never.** A question is parsed into structured intent
  (`src/lib/ask/intent.ts`) — Claude when configured, a deterministic heuristic
  otherwise and as the fallback. An explicit company / biomarker / indication /
  phase / NCT id **always wins over** vague words like "today" or "what changed".
  Page context only fills gaps.
- **Bounded, allowlisted retrieval** (`src/lib/ask/retrieval.ts`): six named
  tools — `resolveCompanies`, `companyDevelopments`, `searchTrials`, `getTrial`,
  `overdueTasks`, `searchSignals`. Every query is tenant-scoped from the
  **verified session** (`getOptionalAuth`), zod-validated, clamped, and uses
  bound parameters only. `ilike` patterns escape `%`/`_`. There is **no**
  "run this SQL" path and the model never supplies a tenant/org/user id.
- **Grounded answer** (`src/lib/ask/pipeline.ts`): the evidence bundle + the
  question go to `generateTextRich`; the answer cites evidence `[n]`, states
  whether a date is the event/publication date or the import date, and does
  **not** introduce entities that aren't in the evidence. If nothing matches, the
  answer says so plainly — no unrelated substitution.
- **External research** only when the user explicitly asks ("search the web",
  "latest news", "beyond the database"): Anthropic hosted `web_search` with
  citations, rendered under a distinct "Current external sources" heading. Private
  notes / contact details are never put in the search query.
- **Conversational**: follow-ups ("Only Phase 2", "What about pancreatic
  cancer?", "Draft an email about the second result") get prior turns +
  `previousCards`. Conversations persist in `ask_conversations` / `ask_messages`
  scoped to `(tenantId, userId)`; `loadConversation` returns `null` for
  non-owners.
- **Reliability**: per-request timeout + bounded retry/backoff; a Postgres-backed
  shared rate limit (per user + per workspace, not an in-process Map); the client
  validates response shape and HTTP status, aborts stale requests (sequence
  guard), and on `401` routes to `/welcome` instead of showing a broken panel.
- **Honest unavailable state**: no key / bad key / provider down →
  `status: "unavailable"`, "database search still works" — never a mock success
  or an unrelated feed. Missing AI config never blocks DB search.

### Search
- **`/trials`** — search by NCT id / title / sponsor / drug, plus biomarker,
  indication, phase, status, "updated within" filters. URL-persisted, result
  count, pagination, honest empty state (no "run npm run …").
- **`/intelligence`** — company / free-text / type / score / timeframe filters
  (URL-persisted) **and `?signal=<id>`** pins + highlights the exact signal above
  the feed (previously ignored).
- **Home metric links** carry the timeframe (and type) used to compute the
  number, so the linked view matches the metric.

### Event dates (misleading "newly announced" fix)
- `trials.first_posted_date` = ClinicalTrials.gov "Study First Posted"
  (distinct from `first_seen_at` = when newwin imported it), wired through the
  ingestion normalizer.
- A `NEW_TRIAL` signal for a trial CT.gov posted **> 45 days ago** is now worded
  "added to your monitored set" (not "newly announced") and stamped with the real
  first-posted date, so "this week" queries exclude it.
- `scripts/backfill-trial-dates.ts` — **non-destructive**: fills
  `first_posted_date` from each trial's own preserved raw snapshot, and re-points
  mislabeled `NEW_TRIAL` signals. Dry-run by default (`--apply` to write). Never
  invents a date; leaves NULL when the snapshot lacks the field.

### Outreach composer
- `/outreach?person= / ?trial= / ?signal= / ?account= / ?draft=` opens a real
  composer for the selected **authorized** contact.
- Claude-generated draft grounded in the selected trial / signal / account + the
  workspace's capability profile (all tenant-scoped), or a clearly-labelled
  editable template when no model is set.
- Editable recipient / subject / body; **Save draft**, reopen, **Copy**; links
  back to the grounding evidence; optional real follow-up task (deduped, no dupes
  on retry).
- **Save draft**, **Log outreach already sent**, and provider-backed **Send** are
  separate. Saving never marks anything sent. No provider Send is implemented, so
  none is offered or tested.

---

## 2. Important files changed

| Area | Files |
|---|---|
| Ask pipeline | `src/lib/ask/{intent,retrieval,pipeline,conversations,rate-limit,types}.ts`, `src/app/api/ask/route.ts`, `src/components/ask/ask-bar.tsx` |
| LLM | `src/lib/llm/{anthropic,index,status}.ts` |
| Search | `src/app/(app)/trials/{page.tsx,search-controls.tsx}`, `src/app/(app)/intelligence/{page.tsx,filter-controls.tsx}`, `src/lib/queries.ts`, `src/app/(app)/page.tsx` |
| Event dates | `src/db/schema/trials.ts`, `src/integrations/clinicaltrials/{types,normalize,ingest}.ts`, `scripts/backfill-trial-dates.ts` |
| Outreach | `src/lib/outreach/draft.ts`, `src/app/(app)/outreach/{page.tsx,composer.tsx,draft-actions.ts}`, `src/db/schema/outreach.ts` |
| Schema | `src/db/schema/ask.ts`, `drizzle/0005_*.sql`, `drizzle/0006_*.sql` |

---

## 3. Tests performed & results

`npm test` — **39 tests, all passing** (Node test runner via tsx; PGlite =
Postgres-in-WASM for DB tests; **no real API calls** — mocked path).

| Suite | What it proves |
|---|---|
| `ask-intent` (10) | "What changed at Novartis this week?" → `company_developments` + company + 7-day window (not a generic feed); "today" with a company still targets that company; recruiting/biomarker/indication/phase extraction; "Only Phase 2" narrows; compare with 2 NCTs; overdue-tasks; "draft about the second result" → ordinal 2; page context fills but never overrides an explicit company; external research only when explicitly asked. |
| `ask-pipeline` (5) | Explicit company question answered from **that** company's recent records only (400-day-old high-score signal excluded, other tenant never leaked); unknown company → explicit no-results; nonsense keyword → explicit no-results ("did not substitute"); tenant-scoped retrieval (T2 asking about T1's company sees nothing); conversations private to owner. |
| `outreach-draft` (2) | Draft context tenant-scoped (T2 can't pull T1's person/trial); template draft grounded in the real person/NCT/capability and honestly labelled. |
| `auth-flow` (5) | (from earlier) same-domain users get separate workspaces; existing email → sign-in; incomplete onboarding completes without re-registering; identity resolves to own tenant. |
| `session` / `priorities-*` / `account-atomicity` (17) | (from earlier) session sign/verify/tamper/expiry/revocation; priorities store; atomic signup. |

**Not yet run: a real Claude API call.** `LLM_PROVIDER=anthropic` +
`ANTHROPIC_API_KEY` are set in Vercel **Production** but the code is not deployed
there yet, and no key is available in this working environment. Once deployed (or
given a key locally), verify with:

```bash
# local, key exported in your own shell — never pasted into chat
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-... npx tsx scripts/verify-anthropic.ts
```

`scripts/verify-anthropic.ts` (added) makes one real request and prints the
**model, HTTP status, request-id, and token usage** — no secrets, no private
content — so the connection can be confirmed for the record.

---

## 4. External integrations / credentials still missing

| Integration | State |
|---|---|
| **Anthropic (Claude)** | Code complete (messages + `web_search` + timeouts + retries + usage capture). `ANTHROPIC_API_KEY` present in Vercel **Production only**. Not proven with a live call yet (see §3). |
| **Anthropic web search** | Wired (`research()` + citations). Runs only on explicit "search the web" asks. Unverified live. |
| **Email / drip / "Send"** | **Not implemented.** Composer only saves drafts; the UI says so. No provider, no send path. |
| **Salesforce / CRM sync** | **Not implemented.** `SALESFORCE_*` env vars exist in Vercel but there is no CRM code. Nothing in the app claims CRM is connected. |
| **Publication / leadership / financing feeds** | Only ClinicalTrials.gov ingestion is real. The app does not claim these are connected. |
| **Preview `AUTH_SECRET`** | Missing — see §5. |

---

## 5. Exact remaining Vercel config & migration steps

### 5a. Migrations (Neon — shared by Preview + Production)

`vercel env ls` confirms `STORAGE_DATABASE_URL` / `STORAGE_DATABASE_URL_UNPOOLED`
are **one entry each, scoped to `Preview, Production`** → the **same Neon
branch**. Apply once. These are Sensitive vars, so `vercel env pull` returns a
placeholder — get the real **direct/unpooled** string from the Neon Console
(*Connection Details*) or Vercel → Storage.

```bash
export STORAGE_DATABASE_URL_UNPOOLED='postgresql://…neon.tech/neondb?sslmode=require'  # you set this
npm run db:migrate:status        # expect 0000–0002 [x]; 0003–0006 [ ]
npm run db:migrate               # applies 0003,0004,0005,0006 forward-only; no reset/seed
npm run db:migrate:status        # expect "Up to date"
```

Pending migrations, all **additive**:
- `0003` — `user_preferences.theme`, `users.sessions_revoked_at`
- `0004` — `tasks.due_at` + related/link/dedupe columns
- `0005` — `ask_conversations`, `ask_messages`, `usage_counters`,
  `trials.first_posted_date`
- `0006` — `outreach_drafts`

Then, optionally, repair historical trial dates (non-destructive, dry-run first):
```bash
npm run db:backfill:dates             # preview
npm run db:backfill:dates -- --apply  # write
```

### 5b. AUTH_SECRET on Preview (only if you test on a preview URL)

```bash
openssl rand -base64 48 | tr -d '\n' | vercel env add AUTH_SECRET preview
```
or Vercel → Settings → Environment Variables → `AUTH_SECRET` → Edit → also tick
**Preview**. Without it, preview signup/sign-in return "temporarily unavailable"
by design (fail-closed). Production already has it.

### 5c. Deploy

This branch is **not merged**. Nothing deploys automatically. To ship the auth
fix + everything above to `newwin.dev`:
1. Open a PR: `harden/identity-session-themes-priorities` → `main`
   (https://github.com/ln5711/BioPharma-Business-Development/pull/new/harden/identity-session-themes-priorities).
2. Merge it → Vercel builds `main` and promotes to `newwin.dev`.
3. `LLM_PROVIDER` must be `anthropic` in Production (it is) for Claude answers;
   otherwise Ask newwin runs the deterministic DB path.

### 5d. Production auth — current state (item 9)

`origin/main` @ `b57c9d3` (what is live on `newwin.dev`) **still has** the
first-user/first-tenant demo fallback in `getActiveTenant()` — that is why the
site showed the Predicine dashboard and a name without a login. The fix
(`getOptionalAuth`, no fallback, `layout` redirects signed-out → `/welcome`) is
on this branch, tested, **but not deployed**. Merging (5c) resolves it.

---

## 6. Verify complete workflows (after deploy or with a key)

Run against a preview or `newwin.dev`:

| Scenario | Expected |
|---|---|
| "What changed at Novartis this week?" | Only Novartis developments in the last 7 days, or an explicit "no developments recorded … not that nothing happened". No other companies. |
| "Find recruiting KRAS G12D trials in pancreatic cancer" | Trial list filtered to recruiting + KRAS G12D + pancreatic; count + pagination; URL has the filters. |
| "Compare NCT… and NCT…" | Side-by-side of the two records with citations; "couldn't find those" if not in workspace. |
| "Draft outreach about the second result" | Card → composer opens for that trial; Generate produces a grounded draft; Save persists it; reload → still there. |
| "Which follow-ups are overdue?" | The signed-in user's own tasks with a past `due_at`, nothing else. |
| Follow-up "Only Phase 2" | Narrows the previous result set to phase 2. |
| Old trial imported today | Not described as announced today; labelled "added to your monitored set", dated by first-posted. |
| Kill network / expire session mid-question | Honest error / redirect to `/welcome`; no crash, no empty card panel. |
| Two accounts | Neither can retrieve the other's signals, conversations, drafts, or tasks (Ask + direct URL). |
| Reload / logout-login | Saved conversations, drafts, tasks survive. |

Record the real Claude call's **request-id / model / status / usage** from
`scripts/verify-anthropic.ts` output (or the `meta` block in an `/api/ask`
response) for the verification log.
