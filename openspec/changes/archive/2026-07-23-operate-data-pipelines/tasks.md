## 1. Durable coordinator

- [x] 1.1 Add private flow-run/stage-attempt/lease/progress schema, indexes, RLS/revokes, and idempotency constraints.
- [x] 1.2 Add transactional claim, complete, fail, review-resume, and stale-recovery operations with concurrency tests.
- [x] 1.3 Add code-defined flow registry covering every source, identity, release, Tier 1/2, and aggregate product dependency.
- [x] 1.4 Add bounded executor/continuation behavior with restart, duplicate invocation, chunk-boundary, retry, and exhaustion tests.
- [x] 1.5 Pin a canonical immutable AX identity reconciliation/allocation branch contract into `tier1-full` with checksum-lock and composite-drift regression tests.

## 2. Manual, scheduled, and backfill controls

- [x] 2.1 Add guarded manual Run pipeline, retry, and Rebuild with current resources APIs/actions.
- [x] 2.2 Add secured internal schedule endpoint and opt-in definition configuration with unauthorized/request tests.
- [x] 2.3 Add explicit-input historical backfill validation and no-latest substitution tests.

## 3. Operational UI and diagnostics

- [x] 3.1 Add admin pipeline history/detail with stage timeline, exact inputs, findings, retries, actor, duration, counts, publication, and out-of-date state.
- [x] 3.2 Add actionable failed-ingestion/resource/candidate/identity/stale/publication diagnostics without general product analytics.
- [x] 3.3 Add route registry, literal smoke markers/surfaces, accessibility, and UI journeys for manual launch, review pause/resume, retry, and history.
- [x] 3.4 Expose the exact formed publication and most-recent downstream identity run, identity publication, and registry revision from source-run history.

## 4. Cutover and verification

- [x] 4.1 Document ownership, manual/schedule/backfill operations, alert response, rollback, and legacy freeze checklist.
- [x] 4.2 Keep every schedule disabled unless its exact source configuration and reviewed canary inputs match; retain the production canary matrix as a controlled rollout gate.
- [x] 4.3 Preserve legacy writers and read-only snapshots until parity/rollback approval; document the freeze checklist and prevent premature online identity cutover.
- [x] 4.4 Pass unit/concurrency/database/security/smoke/OpenSpec/terminal/pre-ship verification, verify, and archive.
