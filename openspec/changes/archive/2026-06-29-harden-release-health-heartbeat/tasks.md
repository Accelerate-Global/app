## 1. Release Health

- [x] 1.1 Add a Release Health heartbeat endpoint assertion that expects HTTP
  401 without credentials.
- [x] 1.2 Return actionable failures for HTTP 404, 500, 503, and unexpected
  statuses.

## 2. Tests

- [x] 2.1 Cover successful production smoke when the heartbeat route returns
  HTTP 401.
- [x] 2.2 Cover heartbeat route missing, missing `CRON_SECRET`, Supabase
  unavailable, and unexpected status failures.

## 3. Verification

- [x] 3.1 Run focused release-health tests.
- [x] 3.2 Run `pnpm run spec:validate`.
- [x] 3.3 Run `pnpm run verify:change:run`.
- [x] 3.4 Archive the completed OpenSpec change.
- [x] 3.5 Run `pnpm run verify:change:run` after archive.
