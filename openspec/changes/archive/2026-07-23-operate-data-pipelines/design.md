## Context

Individual stages persist their own lifecycle and artifacts, but a complete flow spans source ingestion, forming, identity, release, merge, aggregate, and publication. Vercel requests have execution limits and browser presence cannot guarantee completion. The coordinator must remain small, idempotent, and compatible with existing Next.js/Supabase deployment.

## Goals / Non-Goals

**Goals:** durable stage state; exactly-once claims with idempotent effects; bounded chunks; retries/stale recovery; manual launch; opt-in schedules; exact backfills; unified history/diagnostics; safe legacy cutover.

**Non-Goals:** arbitrary DAG editor, external queue service, automatic publication, restored product analytics, or default schedules for unproven flows.

## Decisions

### Coordinate code-defined named flows

Definitions declare ordered stage keys/dependencies, eligibility, version/checksum, schedule eligibility, and publication target. A private run stores definition/correlation/input fingerprint/status/current stage/progress/actor and exact selected versions. Stage attempts are append-only. The database claims one runnable stage using row locks and a lease; retries reuse idempotency keys and cannot duplicate candidate/publication effects.

Normal launch resolves current inputs once in a repeatable-read snapshot and
stores the exact source-profile bindings/configuration checksums, complete
resource set/member IDs and checksums, retained publication IDs/checksums,
registry revision, Tier 1 priority payload/checksum, Tier 2 profiles/contracts,
and each stable target's expected current publication. Later stages append only
immutable upstream outputs and never re-resolve a mutable current value.

### Execute bounded work after durable claims

Manual/admin or authenticated internal requests claim one bounded unit, execute it, persist progress, and enqueue/trigger the next continuation through the existing deployment model. No transaction spans network or Storage work. A stale lease can be recovered after timeout, with prior attempt history retained.

The authenticated continuation also recovers timed-out product-publication
attempts. Recovery retains the interrupted attempt, starts a new bounded attempt
with the stage fingerprint, and never promotes partial or unverified artifacts
as complete output.

### Keep publication human-approved

Coordination may ingest and build candidates, but never auto-acknowledges warnings or publishes datasets. Manual run status becomes `awaiting_review` at decision gates. Rebuild with current resources creates new immutable descendants and never mutates history.

Approval resumes only when the deployed definition version/checksum still
matches the reviewed run. Rejection calls the domain candidate's rejection
operation before closing the coordinator stage so findings/artifacts remain,
identity reservations are cancelled without recycling values, and later stages
cannot run.

### Opt-in scheduling and exact backfills

Schedules are disabled by default and code-defined only after a manual
production canary for the exact definition version/checksum passes. Tier 2
schedules are independent per active profile and require a canary that pinned
that same profile ID; a changed definition or different profile invalidates the
evidence. Internal schedule routes require the platform schedule secret and
same deployment protections. Scheduled work still stops at review. Backfill
requires explicit historical publication/resource/revision IDs and cannot
resolve latest after start.

### Unified history replaces broad analytics

The admin view presents flow/stages, exact inputs, duration, counts, findings, actor, retries, current/out-of-date state, and actionable failures. It does not capture general page/event analytics.

## Risks / Trade-offs

- Vercel invocation may end mid-stage → lease/progress/retry makes interruption observable and recoverable.
- Duplicate continuation calls → transactional claim plus idempotency fingerprints permit one active attempt/effect.
- Schedules can amplify upstream failures → explicit per-definition enablement, bounded retries, and no automatic publish.
- Long historical backfills can consume resources → explicit range/input selection and chunk limits.

## Migration Plan

1. Add coordination schema/security and idempotent claim/complete/fail/recover functions.
2. Integrate manual one-flow execution and unified history; prove restart/chunk/retry behavior locally.
3. Run production manual canaries for each named flow and verify exact output/rollback.
4. Enable schedules only for approved definitions and monitor actionable failures.
5. Preserve checksummed legacy evidence read-only, freeze each matching writer
   immediately before authoritative online publication, and disable it only
   after the exact canary and rollback rehearsal pass. Unconfigured profiles
   remain on their prior path and are never dual-written.

Rollback disables coordinator invocation/schedules and restores prior stable dataset versions; all runs, stage attempts, and artifacts remain inspectable.

## Open Questions

None. Scheduling is opt-in after manual canaries; publication remains explicit.
