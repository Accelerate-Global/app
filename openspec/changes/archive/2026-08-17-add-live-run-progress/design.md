## Context

API connection tests and imports are durable background runs. `src/components/dashboard/api-connection-detail-client.tsx` polls their persisted status every 1.5 seconds, but while a run remains queued or running the visible page changes only when the lifecycle status changes. Google Sheets onboarding in `src/components/dashboard/dataset-onboarding/dataset-onboarding-client.tsx` also polls background imports, but maps lifecycle states to static percentages that are not measurements of completed work. Direct CSV creation and replacement in `src/components/dashboard/dataset-upload-client.tsx` and the onboarding CSV operation already report actual client-known stages, row counts, and bounded progress.

The UX must make continued activity and loss of freshness observable without changing the server-side run lifecycle, inventing an ETA, or causing screen readers to announce an elapsed timer every second. The change affects administrator UI and smoke coverage only; it does not alter auth, RLS, data mutation, Supabase schema, or Vercel execution.

## Goals / Non-Goals

**Goals:**

- Keep every user-triggered connection test and source-to-dataset ingestion visibly active from acceptance through a terminal outcome.
- Distinguish queued work, running work, and temporarily unconfirmed status.
- Show live elapsed time and successful refresh freshness for lifecycle-only background runs.
- Preserve determinate progress for CSV upload, parsing, and row persistence where the client has real measurements.
- Provide one accessible presentation contract that can be reused by connection detail, dataset onboarding, and dataset replacement.
- Cover active, stale, success, and failure transitions with direct component tests and targeted UI smoke coverage.

**Non-Goals:**

- Derive a completion percentage or ETA from time elapsed, row counts discovered after completion, or historical averages.
- Add server-side progress fields, database migrations, cancellation, or changes to provider execution.
- Redesign pipeline operations, forming candidates, identity candidates, pipeline products, or reference-resource refreshes.
- Replace durable run history or terminal result alerts.

## Decisions

### Use a shared dashboard operation-progress presentation

Implement a small dashboard-level presentation component rather than a new application-wide UI primitive. It will accept a semantic phase, label, detail, elapsed text, freshness text, and either determinate numeric progress or indeterminate activity. Keeping it under the dashboard domain avoids widening the base primitive API and avoids a shared-primitive smoke fixture unless implementation discovery demonstrates broader reuse.

Alternative considered: duplicate markup in each screen. Rejected because the accessibility and truthfulness rules would drift across connection tests, onboarding imports, and replacements.

### Model determinate and indeterminate work explicitly

CSV upload and persistence will pass their existing measured percentage and row count. API connection tests and Google Sheets/API ingestions will pass no numeric value and render an animated indeterminate track plus spinner. Lifecycle-only work will never render a percentage or ETA.

Alternative considered: advance an estimated percentage on a timer, following the current reference-resource refresh pattern. Rejected because API providers and dataset sizes vary substantially and a timer would misrepresent actual work.

### Derive elapsed time and poll freshness on the client

The client will derive elapsed time from the persisted run `createdAt` or `startedAt` timestamp and update the visual timer on a lightweight one-second clock. A successful polling response records a client-local `lastCheckedAt`. Repeated poll failures transition the presentation to a non-terminal freshness warning while polling continues. Successful polling clears the warning. The elapsed timer will be visually updated but excluded from the frequently announcing live-region text.

This avoids database and API changes. It also separates two facts that users need: the operation is still marked active by the durable record, and the browser is or is not receiving current status.

### Keep domain-specific phase language

The shared presentation will not decide domain copy. Connection test runs use language such as `Waiting to test` and `Testing source`; import runs use `Waiting to ingest` and `Ingesting source data`; CSV operations retain messages such as `Uploading CSV`, `Saving rows`, and `Dataset ready`. This prevents a generic progress widget from claiming that a staged source artifact has already become a published dataset.

### Apply progress per ingestion item

Google Sheets onboarding can create multiple independent connection imports. Each result card will own its queued/running phase, elapsed time, freshness, failure, retry, and completion state. One failed tab will not stop movement or terminal actions for successful tabs. A retry starts a fresh elapsed interval for that item.

### Preserve existing execution and security boundaries

Existing POST routes continue to start tests/imports, and existing GET routes continue to provide run status. No provider secrets, raw errors, or additional artifact content enter client state. The current administrator authorization and centralized same-origin mutation guard remain unchanged. No local Supabase service or migration is required for implementation unless terminal UI smoke verification starts the repo-local stack.

### Verify the user-visible transition, not incidental animation frames

Direct tests will use controlled timers and mocked polling responses to assert queued/running copy, elapsed/freshness behavior, indeterminate versus determinate semantics, poll-recovery behavior, and terminal transitions. UI smoke will use stable literal selectors on the existing API connection and dataset onboarding routes; it will assert that an active surface is present and ready rather than pixel-testing animation.

## Risks / Trade-offs

- [Risk] A one-second elapsed clock causes unnecessary broad rerenders. → Isolate the clock in the progress presentation or a focused hook so data grids and unrelated form state do not rerender each second.
- [Risk] Frequent live-region announcements become distracting. → Keep only phase and meaningful freshness/terminal changes in the polite live region; render elapsed seconds outside the announcement stream.
- [Risk] A transient network error appears as a failed ingestion. → Treat poll freshness separately from durable run status, require repeated failures before showing a warning, continue retries, and never convert the run itself to failed client-side.
- [Risk] Existing static percentages for Google Sheets onboarding imply accuracy. → Replace lifecycle-derived percentages with indeterminate semantics while retaining real numeric progress for CSV work.
- [Risk] Motion can be uncomfortable or invisible to some users. → Respect reduced-motion preferences and retain explicit visible phase/freshness text independent of animation.

## Migration Plan

1. Add the reusable dashboard progress presentation and direct tests.
2. Integrate it into API connection test/import active states without changing API responses.
3. Integrate per-item indeterminate progress into Google Sheets onboarding and align CSV onboarding/upload accessibility while retaining measured progress.
4. Add or update stable smoke selectors and targeted journeys.
5. Run the repo-required change verification and UI smoke gates.

Rollback is limited to reverting the presentation and client-state changes; persisted runs, datasets, and APIs remain compatible throughout.

## Open Questions

- None required for implementation. Exact copy can be refined during component work while preserving the normative distinction between lifecycle-only and measured progress.
