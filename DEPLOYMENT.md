# newwin — deployment & verification

This document covers: the environment-variable contract, how the app and the
migration script resolve your Neon connection strings, how to apply the pending
migrations to production **without resetting or seeding**, how to deploy, and how
to verify signup persistence against the real database.

> Nothing here asks you to paste a database password or secret into a chat.
> Every step is run by you, in your terminal or the Vercel dashboard.

---

## 1. Environment variables

### Required

| Name | Purpose | Where |
|---|---|---|
| `STORAGE_DATABASE_URL` | Primary Postgres connection (Neon **pooled** endpoint). Used by the running app on every request. | Provided by your Neon integration. Applies to Production + Preview. |
| `STORAGE_DATABASE_URL_UNPOOLED` | Direct (non-pooled) Postgres connection. Used **only** by the migration script — drizzle's migrator takes a Postgres advisory lock, which Neon's pooled PgBouncer endpoint does not support. | Provided by your Neon integration. |
| `AUTH_SECRET` | HMAC key that signs the `nw_session` cookie. Must be 32+ characters and **not** the checked-in dev default. In production the auth layer *fails closed* (sign-up / sign-in return "temporarily unavailable") if this is missing or weak — it never crashes public pages. | **You added this to Production.** Also add it to **Preview** so preview deployments can sign users in (see §5). |
| `CRON_SECRET` | Authorises the scheduled ClinicalTrials.gov ingestion route. Vercel Cron sends it automatically as `Authorization: Bearer …`. | Vercel auto-creates this when a project has `crons` in `vercel.json`. Confirm it exists under Settings → Environment Variables. |

### Optional (features degrade gracefully if unset — they never block signup or CRUD)

| Name | Purpose | If unset |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` \| `openai` \| `mock` | `mock` — Ask newwin stays fully usable (deterministic, rules-based). |
| `LLM_MODEL` | Model id when a provider is set | `claude-sonnet-5` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | LLM credentials | No LLM calls; rules-based recommendations only. |
| `CLINICALTRIALS_BASE_URL` / `CLINICALTRIALS_USER_AGENT` | ClinicalTrials.gov API base / UA string | Sensible defaults. |
| `NCBI_API_KEY` / `CROSSREF_MAILTO` | Publication enrichment politeness | Lower rate limits. |
| `PGLITE_DATA_DIR` | Local-dev embedded DB path | `./.pglite` — **local dev only**, never used on Vercel. |
| `EXTRA_DATABASE_URL_ENV` | Name of a custom env var holding the DB URL | Not needed with the Neon integration. |

**Never** put any of these in a `NEXT_PUBLIC_*` variable.

---

## 2. How connection-string resolution works (confirmed)

`src/lib/env.ts` → `resolveDatabaseUrl()` walks this list and takes the first
non-empty value:

```
EXTRA_DATABASE_URL_ENV (indirect)
DATABASE_URL
POSTGRES_URL
POSTGRES_PRISMA_URL
STORAGE_DATABASE_URL          ← your Neon integration provides this
STORAGE_POSTGRES_URL
STORAGE_POSTGRES_PRISMA_URL
── then, only if none of the above ──
DATABASE_URL_UNPOOLED
POSTGRES_URL_NON_POOLING
STORAGE_DATABASE_URL_UNPOOLED
STORAGE_POSTGRES_URL_NON_POOLING
```

So the **running app** uses `STORAGE_DATABASE_URL` (pooled) — correct for
serverless.

`scripts/migrate.ts` → `unpooledUrl()` **prefers a direct connection** for DDL:

```
MIGRATE_DATABASE_URL
DATABASE_URL_UNPOOLED
POSTGRES_URL_NON_POOLING
STORAGE_DATABASE_URL_UNPOOLED   ← your Neon integration provides this
STORAGE_POSTGRES_URL_NON_POOLING
── falls back to the resolved (possibly pooled) URL if none exist ──
```

Both names you have (`STORAGE_DATABASE_URL`, `STORAGE_DATABASE_URL_UNPOOLED`) are
handled. Nothing else to configure.

---

## 3. Pending migrations

Five migrations exist on disk. `0000`–`0002` were applied to Neon in an earlier
session. **`0003` and `0004` are new and pending.** Both are strictly additive —
`ADD COLUMN`, `CREATE INDEX`, one nullable FK. No drops, no data loss, no seed.

| File | Change |
|---|---|
| `0003_mushy_sister_grimm.sql` | `user_preferences.theme` (text, default `'system'`), `users.sessions_revoked_at` (nullable timestamptz) |
| `0004_bumpy_quasimodo.sql` | `tasks.due_at`, `tasks.related_organization_id` (FK → organizations, `ON DELETE SET NULL`), `tasks.related_interaction_id`, `tasks.source`, `tasks.dedupe_key`; indexes `tasks_due_idx`, unique `tasks_dedupe_idx (tenant_id, dedupe_key)` |

### 3a. Check what's actually applied on Neon (read-only)

Pull the production env locally (this is env vars, not data) and run the
read-only status check:

```bash
vercel env pull .env.production.local --environment=production
set -a; . ./.env.production.local; set +a
npm run db:migrate:status
```

Expected output — a checklist showing `0000`–`0002` as `[x]` and `0003`–`0004`
as `[ ]`, ending with `2 migration(s) pending`.

> `migrate-status.ts` only runs `SELECT`s against `drizzle.__drizzle_migrations`.
> It writes nothing.

### 3b. Apply the pending migrations to Neon (forward-only)

```bash
npm run db:migrate
```

`scripts/migrate.ts`:
- picks `STORAGE_DATABASE_URL_UNPOOLED` (prints the host and "DIRECT (unpooled)"),
- runs drizzle's migrator, which **skips anything already recorded** and applies
  only `0003` + `0004`,
- prints `✔ migrations applied to Postgres (forward-only; nothing dropped or seeded)`.

Re-run `npm run db:migrate:status` — everything should now be `[x]` / "Up to date".

**Do NOT run** `npm run db:reset`, `npm run seed`, or `drizzle-kit push` against
production. `reset` drops schemas; `seed` inserts demo companies/people; `push`
can make destructive schema edits. None are part of the release path.

### 3c. Preview vs Production data

`STORAGE_DATABASE_URL` currently maps to the **same Neon database** for Preview
and Production. If you want the signup verification (§6) to run against an
isolated dataset, create a **Neon branch** and set a **Preview-only** override
for `STORAGE_DATABASE_URL` / `STORAGE_DATABASE_URL_UNPOOLED` pointing at that
branch (Vercel → Settings → Environment Variables → add the var, tick **Preview**
only). Then run `npm run db:migrate` once with the Preview env pulled
(`--environment=preview`). If you're comfortable verifying directly against
Production data, you can skip this — signup creates one real workspace row set,
which you then delete (§6, cleanup).

---

## 4. Deploy the latest changes

The project auto-deploys from `main`. To ship:

```bash
git add -A
git commit -m "Harden identity/session, restore intro, themes, real priorities, honest outreach/ingestion"
git push origin main
```

Watch the build in Vercel. It should succeed — `next build` and `tsc --noEmit`
both pass locally, and `env.ts` never throws at import (invalid values fall back
with a logged warning).

To deploy a **preview** without touching Production:

```bash
git push origin main:refs/heads/verify-signup   # or open a PR
```

Vercel builds a preview URL for the branch.

`vercel.json` now declares a daily cron (`0 7 * * *` UTC) that calls
`/api/cron/ctgov`. Vercel wires `CRON_SECRET` automatically; confirm the var
exists after the first deploy with a cron.

---

## 5. Deployment Protection & AUTH_SECRET on previews

- **AUTH_SECRET must exist in the environment the deployment runs in.** You added
  it to Production. Add the same (or a different 32+ char) value to **Preview**
  too, or preview signup/sign-in will return "temporarily unavailable" by design.
  Vercel → Settings → Environment Variables → your `AUTH_SECRET` row → tick
  **Preview** as well (or add a second row scoped to Preview).
- If **Deployment Protection** (Vercel Authentication) is on, you'll hit Vercel's
  SSO wall before the app. That's fine for your own testing — log in with your
  Vercel account. For a second-browser test (scenario in §6) either disable
  protection for that preview or use a shareable bypass link
  (Settings → Deployment Protection → **Protection Bypass for Automation** or a
  share link).

---

## 6. Verify signup persistence against the real database

Do this on the deployed URL (preview or production), **not** locally. Local
PGlite runs are logic checks only.

### 6a. Create an account
1. Open the deployment in a private/incognito window. You should get the animated
   pulsar intro, then the signup form (Skip button works; reduced-motion users go
   straight to the form).
2. Fill in name, a **fresh** work email, password (8+), organization name,
   optionally a domain.
3. Pick 2–3 recommended priorities **and type one custom priority** — e.g.
   `Track KRAS G12C resistance`. You can leave it in the text box without
   clicking **+**; it's still submitted.
4. Submit. You should land on **Home**, greeted, with your priorities visible and
   honest zero/low counts (no fake "150 companies").

### 6b. Confirm the rows are in the intended database
Pull the same environment's vars and query (read-only):

```bash
vercel env pull .env.production.local --environment=production   # or --environment=preview
set -a; . ./.env.production.local; set +a
psql "$STORAGE_DATABASE_URL_UNPOOLED" -c "
  select u.email, t.name as workspace, t.slug, om.role,
         jsonb_array_length(up.priorities) as priorities, up.onboarded_at is not null as onboarded
  from users u
  join organization_members om on om.user_id = u.id
  join tenants t on t.id = om.tenant_id
  join user_preferences up on up.user_id = u.id
  where u.email = 'YOUR_TEST_EMAIL'
  order by u.created_at desc;"
```

Expected: **exactly one** row — one user, one workspace, one `owner` membership,
`onboarded = t`, `priorities` = (recommended + your custom one). Also check
there is exactly one `tenants` row for your slug and no orphaned extras.

### 6c. Persistence across sessions
- **Reload** Home → priorities and counts unchanged.
- **Sign out** (avatar menu → Sign out) → you're returned to `/welcome`.
- **Sign back in** with the same credentials → same Home, same priorities.
- Open the deployment in a **different browser**, sign in → same data.
- On Home, add another priority via the "Add a priority…" box → it appears in the
  list and in **Settings → Priorities**; reload → still there.
- In Settings, **pause** a priority → it stops influencing recommendations;
  **resume** → it's back. **Delete** one → gone after reload.

### 6d. Negative checks
- Submit signup with a password < 8 chars, or a malformed domain → you stay on
  the form, and **no** partial `users`/`tenants` row is created (re-run the query
  in 6b — still just your one good account).
- Try signing up again with the **same email** → "An account with that email
  already exists", no second workspace.
- Sign in with the **wrong password** → "Email or password is incorrect."

### 6e. Session integrity
- Copy the `nw_session` cookie value, change one character (DevTools →
  Application → Cookies), reload → you're signed out (tamper rejected).
- In Settings → Password, change your password → other browser's session is
  invalidated on its next navigation (revocation); this browser stays in.

### 6f. Cleanup (if you tested against Production)
```bash
psql "$STORAGE_DATABASE_URL_UNPOOLED" -c "
  delete from tenants where slug = 'YOUR_TEST_SLUG';"   -- cascades to user, membership, prefs, profiles
```

---

## 7. Scheduled ingestion (optional, after deploy)

- `GET /api/cron/ctgov` with no / wrong secret → `401`. Confirmed locally.
- Vercel Cron calls it daily with the bearer secret. To trigger manually:
  ```bash
  curl -H "x-cron-secret: $CRON_SECRET" https://YOUR_DEPLOYMENT/api/cron/ctgov
  ```
  The response reports `watchlistsRun`, `failures`, and per-watchlist stats — it
  returns `ok:false` / HTTP 207 if any watchlist failed rather than a blanket
  success. Each run is recorded in `job_runs`; the header pill on every page then
  shows the real state (never synced / syncing / updated <when> / last sync
  failed) instead of a static "Live" badge.
- In **production**, if `CRON_SECRET` is missing or still the dev default, the
  route refuses all calls (fail closed).

---

## 8. What was verified locally vs. what needs the live site

| Verified locally (this repo) | Still needs the deployed site + real Neon DB |
|---|---|
| `next build`, `tsc --noEmit`, ESLint — all clean | Signup writes rows to **your Neon database** (§6b) |
| 16 automated tests (`npm test`): account-creation atomicity + rollback + 23505 against the real schema (PGlite); priorities store add/edit/pause/reorder/remove/max; oncology short-term matching (RAS/MET/RET/ALK/CRC) + synonyms + boundaries; session sign/verify/tamper/expiry/revocation-window | Persistence across reload / logout-login / second browser (§6c) |
| Migrations `0003`+`0004` apply forward-only to a fresh DB; `db:migrate:status` reports state read-only | Migrations applied to **Neon** specifically (§3b) |
| Routing: `/` → `/welcome` when signed out; `/welcome` renders the animated intro on an **empty** DB (no seeded tenant needed); cron route rejects unauthenticated `GET`/`POST` | Deployment Protection / preview `AUTH_SECRET` behaviour (§5) |
| Light/dark tokens compile; welcome/intro stay dark (locally scoped); toggle writes cookie + `user_preferences.theme` | Visual contrast pass on the deployed pages, both themes |
| `addQuickPriority` writes a real `user_preferences.priorities` entry; outreach logger never sends, creates one deduped due-dated follow-up task | End-to-end outreach log + follow-up task on real data |

PGlite is Postgres-in-WASM, so transaction and constraint semantics match Neon —
but only a run against the connected database proves the connection, the applied
migrations, and cross-session persistence. That is §3 and §6.
