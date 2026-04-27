# Repository Map

This repo is a single Next.js application for authenticated CSV dataset upload,
storage, exploration, and admin management.

## Top-Level Structure

- `src/app`: Next.js App Router pages, auth routes, dashboard routes, and API route handlers.
- `src/components`: auth, dashboard, layout, theme, shared UI, and reusable data-grid components.
- `src/lib`: auth/session helpers, Supabase clients, dataset logic, security controls, analytics, CSV utilities, validation, and display helpers.
- `src/db`: Drizzle database entrypoint and schema.
- `supabase`: Supabase local config, SQL migrations, seed file, auth email templates, and pgTAP database security tests.
- `tests/ui`: Playwright smoke route registry, route sweep, journey tests, and global setup.
- `scripts`: local verification, release, smoke, migration, seeding, and CI selection tooling.
- `config`: change-impact rules used by local verification and CI planning.
- `.github`: pinned GitHub Actions workflows and shared setup action.
- `docs`: release, testing, architecture, developer, user, audit, and feature notes.
- `openspec`: OpenSpec project config, active changes, archived changes, and future behavioral specs.

## Runtime Entry Points

- Public auth entry pages: `src/app/page.tsx`, `src/app/sign-up/page.tsx`, `src/app/forgot-password/page.tsx`, and `src/app/reset-password/page.tsx`.
- Auth callbacks and mutations: `src/app/auth/**/route.ts`.
- Dashboard pages: `src/app/dashboard/**/page.tsx`.
- JSON API routes: `src/app/api/**/route.ts`.
- Request proxy/session boundary: `src/proxy.ts`.
- Root layout, metadata, fonts, theme bootstrap, and analytics provider: `src/app/layout.tsx`.

## Data And Services

- Supabase Auth resolves identity in `src/lib/auth.ts`.
- Supabase client setup lives under `src/lib/supabase`.
- Supabase Storage upload authorization is handled by `src/app/api/blob/upload-token/route.ts`.
- Drizzle uses `DATABASE_URL` through `src/db/index.ts`.
- Database schema is defined in `src/db/schema.ts`.
- Committed database changes live in `supabase/migrations`.
- Local Supabase ports are defined in `supabase/config.toml`.

## Verification And Release

- Planning gate: `pnpm run verify:change`.
- Terminal local gate: `pnpm run verify:change:run`.
- App quality bundle: `pnpm run verify:app`.
- UI smoke contract check: `pnpm run smoke:check`.
- Full UI smoke runner: `pnpm run test:ui:smoke`.
- Database security gate: `pnpm run db:security`.
- Local pre-ship gate: `pnpm run verify:ship:local`.
- Release flow: `docs/release.md` and `pnpm ship --pr <number>`.

## OpenSpec

OpenSpec is initialized for future behavior changes. Current-state orientation
stays in `docs/`; durable behavior specs should be added under `openspec/specs`
only as related behavior is changed.
