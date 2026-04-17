# CSV Dataset Viewer

A Vercel-hosted Next.js app for authenticated CSV uploads, Supabase-backed CSV storage, persisted parsed rows, and shared table exploration.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Supabase email/password authentication
- shadcn/ui with Base UI primitives
- Supabase Storage for raw CSV files
- Supabase Postgres with Drizzle for dataset metadata and JSONB row storage
- Papa Parse and TanStack Table for client-side ingestion and table controls

## Local Setup

Install dependencies:

```bash
pnpm install
```

Create local environment variables:

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (defaults to `datasets`)
- `DATASET_ADMIN_EMAIL` (defaults to `admin@example.com`)
- `DATABASE_URL`

Raw CSV files are stored in Supabase Storage. Uploads require a server-side
`SUPABASE_SERVICE_ROLE_KEY`, and only the configured dataset admin account can
create, update, or delete datasets. All signed-in users can browse shared
datasets and rows.

Start the local Supabase stack:

```bash
pnpm db:start
```

Apply the tracked Supabase migrations to the local database:

```bash
pnpm db:push
```

That command now also seeds the local field-source registry from the checked-in
Aggregate 1 mapping CSV, so `/dashboard/field-sources` and field source tags are
ready without any first-request bootstrap writes.

Start the app:

```bash
pnpm dev
```

Open `http://localhost:3000`.

Do not use `drizzle-kit push` against this project database. It creates tables
and columns, but it does not create the Supabase RLS policies required for
tables in `public`. Schema changes must be committed as SQL migrations under
`supabase/migrations`.

## Vercel Setup

Use Supabase for Auth, Postgres, and Storage. After configuring project
environment variables in Vercel, pull them locally:

```bash
vercel env pull .env.local
```

The app starts unauthenticated users at `/` and sends authenticated users to `/dashboard`.

For branded Supabase auth emails and password reset links, use the runbook in
`docs/auth-email-branding.md`.

## Signup Allowlist

Only emails present in `public.signup_email_allowlist` can create accounts.
Add rows in Supabase before a user signs up:

```sql
insert into public.signup_email_allowlist (email, note)
values ('person@example.com', 'Initial access');
```

Check the current allowlist:

```sql
select email, note, created_at
from public.signup_email_allowlist
order by email;
```

## Verification

```bash
pnpm verify:app
pnpm db:security
pnpm typecheck
```

For the full local release gate:

```bash
pnpm run verify:ship:local
```

`pnpm verify:release` remains available as a temporary deprecated alias to the
new ship-local gate.

## UI Smoke Verification

The browser smoke gate uses the real local Supabase stack, deterministic smoke
seed data, a production build, and Playwright in Chromium.

```bash
pnpm exec playwright install chromium
pnpm run smoke:check
pnpm run test:ui:smoke
```

Use `pnpm run test:ui:smoke:headed` for a local visual pass. The canonical
contract for new routes, surfaces, and shared UI fixtures lives in
`docs/testing/ui-smoke.md`. For the normal ship path, prefer
`pnpm run verify:ship:local`; it reuses prior local verification receipts and
runs any remaining release-only smoke work in one pass.

## Database Security Tests

Database security tests live under `supabase/tests/database` and run with
`supabase test db` using pgTAP. The full local security gate is:

```bash
pnpm db:security
```

`pnpm db:security` is now self-contained. It resets the local database to the
tracked migrations before running the security suite, so it does not require a
separate manual `supabase start`.

The lower-level command that assumes a running local stack is:

```bash
pnpm db:security:started
```

The full self-contained gate checks three things:

- all `public` tables have RLS enabled
- the local database passes `supabase db lint`
- pgTAP security tests pass against the real local Postgres policies

If Docker is unavailable but you still have direct database access, run the
remote gate instead:

```bash
pnpm db:security:remote
```

## Release

Use the runbook in `docs/release.md` for the standard merge-and-ship flow.
