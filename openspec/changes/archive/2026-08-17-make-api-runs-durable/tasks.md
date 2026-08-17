## 1. Planning and Workflow Setup

- [x] 1.1 Run `pnpm run verify:change` and the required scoped `pnpm run task:kickoff` commands; record the verification lane, targeted smoke subset, and local Supabase requirement.
- [x] 1.2 Validate the OpenSpec change and pin the stable Workflow package with the minimum supported Next.js integration.

## 2. Durable Run State

- [x] 2.1 Add a Supabase migration and Drizzle model fields for workflow identity, progress, heartbeat, deadline, cancellation, and the terminal `cancelled` status.
- [x] 2.2 Add conditional claim, checkpoint, cancellation, finalization, and stale-reconciliation repository operations with direct tests and database contract coverage.

## 3. Chunked Joshua Execution

- [x] 3.1 Refactor the Joshua provider into one-page fetch/validate/normalize operations that retain current safety bounds and secret redaction.
- [x] 3.2 Add deterministic private raw/rows chunk storage, checksum verification, and versioned manifests without passing records or secrets through Workflow state.
- [x] 3.3 Implement and dispatch the Joshua durable workflow while retaining the current executor for every other provider.
- [x] 3.4 Update JSON/CSV downloads to stream chunk manifests in order while preserving legacy artifact compatibility and download safety.

## 4. Cancellation and Liveness

- [x] 4.1 Add the admin-only cancel endpoint and cooperative workflow cancellation/finalization behavior.
- [x] 4.2 Add Stop, Stopping, Cancelled, progress, and stalled states to the existing connection detail surface with component and smoke coverage.
- [x] 4.3 Add a narrowly scoped authenticated watchdog and schedule that reconciles stale/deadline-exceeded API runs without taking over normal execution.

## 5. Verification and Closure

- [x] 5.1 Run provider, storage/download, route, component, migration, cancellation, retry, and stale-reconciliation tests directly.
- [x] 5.2 Run every required command reported by `pnpm run verify:change`, including `pnpm run smoke:check`, targeted UI smoke, and database security when listed.
- [x] 5.3 Run `pnpm run verify:change:run`, rerun `pnpm run verify:change`, verify the OpenSpec implementation, sync/archive the change, and leave repo-local Docker/Supabase stopped with persistent data preserved.
