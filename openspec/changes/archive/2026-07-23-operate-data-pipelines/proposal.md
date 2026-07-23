## Why

Once all source, identity, merge, and aggregate definitions run in AX Online, administrators need one durable way to launch, resume, inspect, rebuild, backfill, and eventually schedule them. Browser requests and legacy scripts must not be the orchestration boundary.

## What Changes

- Add a code-defined run coordinator with durable stage claims, progress, correlation IDs, retries, and stale-run recovery.
- Add manual Run pipeline and Rebuild with current resources controls; support authenticated schedules only for explicitly enabled proven definitions and exact profile-matched Tier 2 canaries.
- Add unified pipeline history across ingestion, forming, identity, release, merge, aggregate, and publication.
- Add bounded historical backfill selection and actionable failure/staleness diagnostics without broad product analytics.
- Keep legacy evidence read-only and disable each matching writer only after its exact production canary, parity review, cutover approval, and rollback rehearsal.

## Capabilities

### New Capabilities

- `pipeline-operations`: Durable coordination, manual/scheduled execution, retry, stale recovery, backfill, history, and diagnostics.

### Modified Capabilities

- `api-connection-runs`: Source ingestion can be coordinated as the first durable pipeline stage.
- `dataset-forming-platform`: Candidate stages expose coordinator-safe idempotent transitions.
- `pipeline-release-sets`: Coordinated runs select and retain exact release inputs.

## Impact

- Private coordination metadata/functions, secured internal routes, optional Vercel Cron configuration, admin history UI, tests/runbook.
- No broad analytics, no arbitrary workflow editor, and no additional infrastructure or recurring service cost.
