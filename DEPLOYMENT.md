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
| `STORAGE_DATABASE_URL` | Primary Postgres connection (Neon **pooled** endpoint). Used by the running app on every request. | Neon integration. **One entry scoped to `Preview, Production`** → same DB for both (verified). Sensitive type — `vercel env pull` returns a placeholder; get the real value from the Neon/Vercel dashboard. |
| `STORAGE_DATABASE_URL_UNPOOLED` | Direct (non-pooled) Postgres connection. Used **only** by the migration script — drizzle's migrator takes a Postgres advisory lock, which Neon's pooled PgBouncer endpoint does not support. | Same as above. |
| `AUTH_SECRET` | HMAC key that signs the `nw_session` cookie. Must be 32+ characters and **not** the checked-in dev default. In production the auth layer *fails closed* (sign-up / sign-in return "temporarily unavailable") if this is missing or weak — it never crashes public pages. | **Present in Production only** (verified via `vercel env ls`). Add it to **Preview** only if you want to test on a preview URL — see §5. |
| `CRON_SECRET` | Authorises the scheduled ClinicalTrials.gov ingestion route. Vercel Cron sends it automatically as `Authorization: Bearer …`. | Present in Production + Preview (verified). |

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

### 3a. Get the real connection string

The Neon integration created `STORAGE_DATABASE_URL` /
`STORAGE_DATABASE_URL_UNPOOLED` as **Sensitive** env vars. `vercel env pull`
returns an 11-char placeholder for those, **not** the real value — verified.
Get the real strings from one of:

- **Neon Console** → your project → *Connection Details* → copy both the
  **Pooled** and **Direct** connection strings, or
- **Vercel Dashboard** → *Storage* → your Neon store → the `.env.local` /
  "Show secret" panel.

You already have these from setup. Export the **direct/unpooled** one for the
migration commands (it never goes into chat — you set it in your own shell):

```bash
export STORAGE_DATABASE_URL_UNPOOLED='postgresql://…-pooler…?…'   # the DIRECT string
```

### 3b. Check what's actually applied (read-only)

```bash
npm run db:migrate:status
```

`migrate-status.ts` only runs `SELECT`s against `drizzle.__drizzle_migrations` —
it writes nothing. Expected: `0000`–`0002` as `[x]`, `0003`–`0004` as `[ ]`,
ending with `2 migration(s) pending`.

### 3c. Apply the pending migrations (forward-only)

```bash
npm run db:migrate
```

`scripts/migrate.ts`:
- picks `STORAGE_DATABASE_URL_UNPOOLED` (prints the host + "DIRECT (unpooled)"),
- runs drizzle's migrator, which **skips anything already recorded** and applies
  only `0003` + `0004`,
- prints `✔ migrations applied to Postgres (forward-only; nothing dropped or seeded)`.

Re-run `npm run db:migrate:status` — everything should be `[x]` / "Up to date".

**Do NOT run** `npm run db:reset`, `npm run seed`, or `drizzle-kit push` against
production. `reset` drops schemas; `seed` inserts demo companies/people; `push`
can make destructive schema edits. None are part of the release path.

### 3d. Preview and Production use the SAME Neon database (verified)

`vercel env ls` shows `STORAGE_DATABASE_URL` and `STORAGE_DATABASE_URL_UNPOOLED`
as **one entry each, scoped to `Preview, Production`** — i.e. the same value, the
same Neon branch, for both. **This is not an assumption; it was checked.**

Consequences:
- You only need to apply the migrations **once** (§3c). It targets the DB that
  both Preview and Production read.
- A signup test on a **Preview** deployment writes to the **same database
  Production uses**. Test accounts will be visible to production until you delete
  them (§6f).
- If you want Preview fully isolated: create a **Neon branch**, then in
  Vercel → Settings → Environment Variables add **Preview-scoped** overrides for
  `STORAGE_DATABASE_URL` + `STORAGE_DATABASE_URL_UNPOOLED` pointing at the branch,
  and run `npm run db:migrate` once more with the branch's direct URL exported.
  Optional — the cleanup in §6f is enough if you're fine testing against the
  shared DB.

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

## 5. AUTH_SECRET scope & Deployment Protection

### AUTH_SECRET is currently Production-only — verified

`vercel env ls` shows `AUTH_SECRET` scoped to **Production only**. A **Preview**
deployment of this branch therefore has no `AUTH_SECRET`, and by design
`authConfigured()` returns false → signup / sign-in return **"temporarily
unavailable"** (they fail closed; public pages still render).

**If you want to test on Preview**, add it there first (value typed by you, not
pasted into chat):

```bash
# generates a strong secret and adds it to Preview without printing it
openssl rand -base64 48 | tr -d '\n' | vercel env add AUTH_SECRET preview
```

or Vercel → Settings → Environment Variables → `AUTH_SECRET` row → **Edit** →
also tick **Preview** (re-uses the Production value), or add a separate
Preview-scoped entry.

**If you only test on Production** (newwin.dev, after merging), nothing to do —
`AUTH_SECRET` is already there.

### Deployment Protection

If **Vercel Authentication** is on, you hit Vercel's SSO wall before the app —
fine for your own testing (log in with your Vercel account). For the
second-browser isolation test in §6, either disable protection for that
deployment or use a share/bypass link
(Settings → Deployment Protection → **Protection Bypass for Automation** / share
link). This does not apply to the production domain unless you've protected it.

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

Preview and Production read the **same** Neon DB (§3d), so this query is the same
either way. Use the direct URL you exported in §3a:

```bash
psql "$STORAGE_DATABASE_URL_UNPOOLED" -c "
  select u.id, u.email, t.name as workspace, t.slug, om.role,
         jsonb_array_length(up.priorities) as priorities, up.onboarded_at is not null as onboarded
  from users u
  join organization_members om on om.user_id = u.id
  join tenants t on t.id = om.tenant_id
  join user_preferences up on up.user_id = u.id
  where u.email in ('TEST_EMAIL_1','TEST_EMAIL_2')
  order by u.created_at desc;"
```

Expected: **one row per test account** — distinct `u.id`, distinct `t.slug`,
each `role = owner`, `onboarded = t`, `priorities` = (recommended + custom).
Then confirm no cross-join and no orphans:

```bash
psql "$STORAGE_DATABASE_URL_UNPOOLED" -c "
  -- every membership points at that user's own home tenant (no domain auto-join)
  select u.email, (u.tenant_id = om.tenant_id) as member_of_own_tenant
  from users u join organization_members om on om.user_id = u.id
  where u.email in ('TEST_EMAIL_1','TEST_EMAIL_2');
  -- no tenant without an owner, no user without a membership
  select 'orphan tenants' k, count(*) from tenants t
    where not exists (select 1 from organization_members m where m.tenant_id = t.id)
  union all
  select 'orphan users', count(*) from users u
    where not exists (select 1 from organization_members m where m.user_id = u.id);"
```

`member_of_own_tenant` must be `t` for both; both orphan counts must be `0`.

### 6c. Two-user isolation (the core check)
Use **two** fresh emails — deliberately on the **same domain** (e.g.
`ada@acme-bio.test` and `grace@acme-bio.test`) with the **same** organization
name, to prove no domain auto-join.

1. **User A** — sign up in browser 1 (incognito). Pick priorities incl. a custom
   one like `Track KRAS G12C resistance`. On Home add a task/priority unique to A.
2. **User B** — sign up in browser 2 (a different browser or a separate incognito
   profile). Different priorities, e.g. custom `MET exon 14 skipping partners`.
3. Each sees **only their own** priorities, tasks and counts. Neither sees the
   other's data anywhere (Home, Settings, Tasks, Outreach).
4. **Sign out** both (avatar → Sign out) → each returns to `/welcome` (sign-in
   form is now the default).
5. **Sign back in** as A, then as B → each lands straight on **their own** Home
   with **their own** saved priorities/tasks intact. Signing in did **not**
   create a new account (re-run §6b — still exactly two users).
6. Run §6b's queries → two distinct `u.id`, two distinct `t.slug`,
   `member_of_own_tenant = t` for both, orphan counts `0`.

### 6d. Returning-user / session states
- Valid session → opening the deployment root goes straight to that user's Home.
- **Sign out** → root redirects to `/welcome`.
- **Tampered cookie**: DevTools → Application → Cookies → change one char of
  `nw_session` → reload → back to `/welcome` (rejected).
- **Expired**: a session older than 30 days is rejected server-side (can't wait
  that out live; covered by the automated test).
- **Incomplete onboarding**: if a user row ever exists without `onboarded_at`,
  signing in shows the short **"Finish setting up"** priorities form (no
  name/email/password) and completing it stamps `onboarded_at` — it never
  re-registers. (Automated test: *"incomplete onboarding is finished without
  re-registering"*.)

### 6e. Negative checks
- Signup with password < 8 chars or a malformed domain → stay on the form, **no**
  partial `users`/`tenants` row (re-run §6b).
- Signup with an **existing** email (any case) → "An account with that email
  already exists. Sign in instead." — no second workspace.
- Sign in with the **wrong password** → "Email or password is incorrect."
- In Settings → Password, change A's password → B is unaffected; A's **other**
  browser is signed out on its next navigation (revocation), the browser that
  changed it stays in.

### 6f. Cleanup (Preview and Production share the DB, so always clean up)
Deleting the workspace row cascades to its user, membership, preferences,
profiles and tasks (`ON DELETE CASCADE`):
```bash
psql "$STORAGE_DATABASE_URL_UNPOOLED" -c "
  delete from tenants where slug in ('TEST_SLUG_1','TEST_SLUG_2');"
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
| **21 automated tests** (`npm test`) — see below | Persistence across reload / logout-login / **second browser** (§6c) |
| Migrations `0003`+`0004` apply forward-only to a fresh DB; `db:migrate:status` reports state read-only | Those migrations applied to **Neon** specifically (§3b–c) |
| `vercel env ls`: `AUTH_SECRET` is **Production-only**; `STORAGE_DATABASE_URL(_UNPOOLED)` is **one entry for `Preview, Production`** (same DB) | Adding `AUTH_SECRET` to Preview *if* you test there (§5) |
| Routing: `/`, `/settings`, `/trials` → `/welcome` when signed out; intro renders on an **empty** DB; cron rejects unauthenticated `GET`/`POST` | Deployment Protection wall on previews (§5) |
| Sign-in is the default form; switching to Create does not replay the intro; both form variants present in the shipped client bundle | Visual pass on the deployed pages, both themes |
| `addQuickPriority` writes a real `user_preferences.priorities` entry; outreach logger never sends, creates one deduped due-dated follow-up task | End-to-end outreach log + follow-up task on real data |

**Automated tests (`npm test`, 21 passing):**
- **auth-flow** (calls the *real* `createAccount` / `signIn` / `completeOnboarding`
  against the real schema): two people on the **same email domain** get separate
  user ids + separate workspaces (no domain auto-join); priorities private per
  user, no cross-bleed; existing email → pushed to sign-in, **no** second
  account; sign-in retrieves the existing account (no new rows) and resolves to
  that user's **own** tenant; incomplete onboarding finished without
  re-registering.
- **account-atomicity**: one coherent row set on success; full rollback on a
  mid-transaction failure (no orphan workspace); duplicate email → `23505`,
  nothing left behind.
- **priorities-store**: add / edit / reorder / pause / remove, dedupe, max-20.
- **priority-matching**: RAS / MET / RET / ALK / CRC not length-filtered; word
  boundaries; synonym expansion.
- **session**: sign / verify / tamper-reject / >30d expiry / revocation window.

PGlite is Postgres-in-WASM — transaction and constraint semantics match Neon —
but only a run against the connected database proves the connection, the applied
migrations, and cross-session persistence. That is §3 and §6.

---

## 9. Preview vs. Production (newwin.dev) — what's where

| | **Preview** (branch deploy / PR URL) | **Production** (`newwin.dev`) |
|---|---|---|
| Trigger | push to `harden/identity-session-themes-priorities`, or open a PR | merge that branch to `main` |
| `AUTH_SECRET` | **absent today** → signup/sign-in say "temporarily unavailable" until you add it (§5) | present → signup/sign-in work |
| Database | **same Neon branch as Production** (§3d) | same Neon branch |
| Migrations | reads whatever you applied in §3c (shared DB) | same |
| Deployment Protection | usually the Vercel SSO wall | only if you enabled it for the domain |
| Cron (`/api/cron/ctgov`) | defined but Vercel runs crons on **Production only** | runs daily 07:00 UTC once deployed with `vercel.json` |

**Recommended path to get newwin.dev working:**
1. Apply migrations to Neon — §3 (once; covers both).
2. *(optional)* Add `AUTH_SECRET` to Preview — §5 — and smoke-test the branch's
   preview URL.
3. Merge the branch to `main` → Vercel builds & promotes to `newwin.dev`.
4. Run the §6 two-user verification against `https://newwin.dev`.
5. Clean up the test accounts — §6f.

If you skip step 2, go straight from step 1 → 3 → 4; the first real verification
then happens on `newwin.dev` itself.
