## 1. Analytics Pause Implementation

- [x] 1.1 Add a central `NEXT_PUBLIC_VERCEL_ANALYTICS_PAUSED === "1"` helper.
- [x] 1.2 Prevent the Vercel Web Analytics component from loading the browser
  script while paused.
- [x] 1.3 Skip Vercel client `track(...)` calls while preserving internal event
  persistence.
- [x] 1.4 Skip Vercel server `track(...)` calls while preserving internal event
  persistence.

## 2. Documentation And Tests

- [x] 2.1 Document the pause flag and redeploy behavior in env and developer
  docs.
- [x] 2.2 Add tests for pause flag parsing, component rendering, client
  tracking, and server tracking.
- [x] 2.3 Run `pnpm run verify:change`, required direct tests,
  `pnpm run typecheck`, `pnpm run spec:validate`, and
  `pnpm run verify:change:run`.
