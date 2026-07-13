## 1. Heartbeat Activity

- [x] 1.1 Change the authorized heartbeat to issue three sequential bounded,
  read-only Supabase requests and fail on the first provider error.
- [x] 1.2 Extend the route tests for three successful reads, early failure, and
  unchanged authorization behavior.

## 2. Operations Contract

- [x] 2.1 Update the Supabase heartbeat operations documentation and durable
  specification with the provider's few-requests-per-day guidance.

## 3. Verification and Release

- [x] 3.1 Run the focused route tests and `pnpm run spec:validate`.
- [x] 3.2 Run `pnpm run verify:change`, complete its required commands, and run
  `pnpm run verify:change:run`.
- [x] 3.3 Verify the completed OpenSpec change, archive it, and run
  `pnpm run verify:ship:local` before shipping the production change.
