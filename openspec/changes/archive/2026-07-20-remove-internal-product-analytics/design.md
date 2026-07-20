## Context

The current candidate already retires the Analytics dashboard and its failure
triage API, but the runtime still defines 52 product events, sends authenticated
browser beacons to `/api/analytics/events`, persists rows in
`private.analytics_events`, and retains failure-triage aggregation and storage.
Instrumentation is cross-cutting: analytics-only identity/context props travel
from server pages into 17 client modules and roughly 20 test files assert event
payloads.

This telemetry is not used for the remaining product decision. User Management
already reads Supabase Auth's `last_sign_in_at`, while connection runs, dataset
versions, import statuses, and normalized runtime error logs own the operational
history needed to run the application.

## Goals / Non-Goals

**Goals:**

- Eliminate custom product-event collection, transport, aggregation, and storage.
- Simplify component and page interfaces by removing analytics-only props.
- Remove historical analytics rows through a forward, reproducible migration.
- Preserve Last sign-in, domain state/history, and deployment/runtime diagnostics.
- Keep the retired Analytics URL compatible through its existing redirect.

**Non-Goals:**

- Removing Supabase Auth metadata, account recency, error logging, connection run
  logs, dataset versions, or import state.
- Adding another analytics, RUM, session replay, or error-monitoring dependency.
- Rewriting historical migrations, OpenSpec archives, or dated security reports.
- Changing role permissions, dataset behavior, or user-visible workflow outcomes.

## Decisions

### Remove instrumentation rather than replace it with a no-op

All `trackAppEvent` calls, event payload calculations, analytics contexts, and
analytics-only props are deleted. A no-op facade would preserve misleading APIs
and test burden. Values used only to build telemetry payloads are removed; values
that also drive domain behavior remain.

### Preserve domain diagnostics at their owning boundary

Authentication recency continues to come from Supabase Auth. Connection runs,
dataset versions, import state, and normalized errors stay in their existing
systems. These are operational records, not product analytics, and removing them
would reduce reliability or administrator visibility.

### Remove the full analytics domain and API atomically

The ingestion route, event catalog, sanitizer, browser/server clients, dashboard
store, failure-triage types, and analytics validation are removed together so no
dead transport or schema abstraction remains. The retired dashboard redirect is
not part of this domain and remains.

### Use one forward destructive migration

A new Supabase migration drops `private.analytics_failure_triage` before
`private.analytics_events` with `IF EXISTS`. Previously applied migrations remain
unchanged. Immediate cleanup matches the user's explicit request to remove and
deploy everything; local reset and database security tests prove the resulting
schema. Historical analytics rows are intentionally deleted.

### Keep Vercel runtime logs while removing the dormant analytics resource

The source already omits Vercel's analytics package, component, and CSP origins.
Release follow-through removes the dormant project-level Web Analytics resource
when the provider API supports it. Runtime logs remain because they diagnose
application failures and are not product behavior analytics.

## Risks / Trade-offs

- **Historical analytics rows become unrecoverable from the live database** →
  the request explicitly authorizes removal; provider backups remain the only
  recovery path after migration.
- **Analytics calculations may be interleaved with functional handlers** → remove
  event construction in small slices and retain all API calls, state changes,
  success paths, and user-facing errors; focused behavior tests run before the
  full gate.
- **A stale browser bundle may call the removed endpoint briefly** → it receives
  a harmless 404; event persistence was already fire-and-forget and never owned
  workflow success.
- **Rolling application code back after the migration restores analytics callers
  without tables** → old callers already catch/log persistence errors, so core
  workflows continue; restoring analytics itself would require a new forward
  table-creation migration.
- **Removing analytics mocks changes many same-stem tests** → update tests only
  to remove telemetry assertions, retaining functional assertions for each
  affected workflow.

## Migration Plan

1. Remove runtime event calls, analytics-only props, route, libraries, schema
   definitions, validation, and test expectations.
2. Generate a new migration with the Supabase CLI and add the ordered table drops.
3. Update pgTAP/schema tests, current docs, impact mapping, and OpenSpec contracts.
4. Reset and verify the local database; run the complete application and browser
   verification gates.
5. Archive the OpenSpec change, run ship-local, publish a release PR, merge through
   the repo release controller, and wait for production deployment readiness.
6. Verify the production URL, Last sign-in surface, retired redirect, runtime
   errors, and absence of analytics requests; remove the dormant Vercel resource.

## Open Questions

None. The user approved immediate implementation, merge, and production release.
