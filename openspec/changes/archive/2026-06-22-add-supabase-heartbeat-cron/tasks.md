## 1. Planning

- [x] 1.1 Research current Supabase Free-plan pause behavior and Vercel Cron
  limits/security behavior from official docs.
- [x] 1.2 Run `pnpm run task:kickoff` and `pnpm run verify:change` before
  editing tracked code.

## 2. Heartbeat Implementation

- [x] 2.1 Add the protected `GET /api/ops/supabase-heartbeat` route and its
  documented route-guard exemption.
- [x] 2.2 Configure Vercel Cron to invoke the heartbeat route daily.
- [x] 2.3 Document `CRON_SECRET`, the daily heartbeat, and the read-only
  production behavior in env/docs.

## 3. Tests

- [x] 3.1 Add focused route tests for unauthorized access, missing
  configuration, successful Supabase reads, and Supabase failures.
- [x] 3.2 Verify the route test proves the heartbeat uses a read-only
  single-row query against a stable existing table.

## 4. Verification

- [x] 4.1 Run direct heartbeat route tests.
- [x] 4.2 Run `pnpm run spec:validate`.
- [x] 4.3 Run `pnpm run typecheck`.
- [x] 4.4 Run `pnpm run verify:test-delta`.
- [x] 4.5 Run `pnpm run verify:app`.
- [x] 4.6 Run `pnpm run db:security`; when Docker was unavailable, run the
  documented `pnpm run db:security:remote` fallback.
- [x] 4.7 Run `pnpm run verify:change:run` as the terminal gate after Docker
  Desktop is reachable.
