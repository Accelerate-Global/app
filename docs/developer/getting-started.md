# Developer Getting Started

## Prerequisites

- Node.js and pnpm compatible with the repo CI setup. CI uses Node 22 and pnpm 10.
- Supabase CLI and Docker if you need the local database, auth, storage, or DB security tests.
- Vercel CLI if you need to pull provider environment variables.
- OpenSpec CLI for future behavior-change planning. This repo is initialized under `openspec/`, but local assistant prompts are developer-machine tooling rather than required app runtime state.

## Repository

The canonical public repository is `Accelerate-Global/app`. If a local checkout
still points at `Accelerate-Global/online`, update `origin` or reclone from the
canonical repository before using release tooling.

## Install

```bash
pnpm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_VERCEL_ANALYTICS_PAUSED` (optional; set to `1` to pause
  outbound Vercel Web Analytics while keeping internal analytics active)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `GOOGLE_SHEETS_OAUTH_CLIENT_ID`
- `GOOGLE_SHEETS_OAUTH_CLIENT_SECRET`
- `DATABASE_URL`

For Google Sheets dataset connections, configure a Google OAuth client with the
app origin callback path
`/api/admin/api-connections/google-sheets/oauth/callback`. The provider uses
read-only Sheets access and server-side refresh tokens.

For deployed environment values, use Vercel:

```bash
vercel env pull .env.local
```

When changing `NEXT_PUBLIC_VERCEL_ANALYTICS_PAUSED` in Vercel, redeploy the
affected environment because the browser-facing value is compiled into the app.

## Local App

Start Supabase when local auth, database, or storage is needed:

```bash
pnpm db:start
pnpm db:push
```

Start Next.js:

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Local Verification

Before editing tracked files:

```bash
pnpm run verify:change
```

For UI, admin, DB, or verification-tooling work, also run:

```bash
pnpm run task:kickoff -- --scope <owned-path-or-glob>
```

Common checks:

```bash
pnpm run typecheck
pnpm run verify:app
pnpm run smoke:check
pnpm run db:security
```

Before finalizing tracked repo changes:

```bash
pnpm run verify:change:run
```

## OpenSpec

OpenSpec is required for repo-tracked work. Every tracked change must pass:

```bash
pnpm run spec:validate
```

Use an OpenSpec change for behavior changes, API contracts,
auth/session/permission changes, data model behavior, security posture,
cross-service changes, user-facing outcomes, and repo workflow policy.

Do not backfill broad specs for untouched legacy behavior. Add or update specs
under `openspec/` as related behavior is changed.

Repo-owned OpenSpec state is the tracked `openspec/` directory. Generated Codex
skills under `.codex/` and prompts under `~/.codex/prompts/opsx-*.md` are local
developer tooling and are not required for the app to run.

Archive completed changes before ship:

```bash
pnpm run spec:archive -- <change-id>
pnpm run spec:check-archive
```
