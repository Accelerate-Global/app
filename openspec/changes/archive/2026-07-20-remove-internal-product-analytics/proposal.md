## Why

The retired Analytics dashboard no longer has a product purpose, but the app
still carries a custom 52-event telemetry pipeline across authentication and
dataset workflows, an ingestion API, failure aggregation, and two private
Supabase tables. Removing that unused pipeline reduces browser requests,
database writes, privacy surface, tests, and maintenance without losing the
operational records administrators actually use.

## What Changes

- **BREAKING**: Remove all custom client and server product-event collection,
  including `/api/analytics/events`, analytics context props, and event-specific
  test assertions.
- **BREAKING**: Remove the analytics event catalog, persistence/dashboard store,
  failure-triage model, and analytics-specific validation.
- **BREAKING**: Add a forward Supabase migration that drops
  `private.analytics_failure_triage` and `private.analytics_events`; preserve
  historical migration files for reproducible database history.
- Keep `/dashboard/analytics` as a compatibility redirect to User Management,
  but do not expose an Analytics destination in navigation.
- Keep Supabase Auth `last_sign_in_at` as User Management's `Last sign-in`
  signal; do not replace removed events with login-frequency or activity
  tracking.
- Keep application error logging, API connection run history, dataset versions,
  import state, and other domain-owned operational records.
- Keep the Vercel Web Analytics collector absent from the app and remove the
  dormant project resource during release follow-through when provider access
  permits.

## Capabilities

### New Capabilities

- `product-analytics-boundary`: Define that the application does not collect or
  persist custom product analytics while retaining explicit operational and
  authentication records.

### Modified Capabilities

- `vercel-analytics-pause`: Retire the remaining internal analytics persistence
  requirements while retaining the prohibition on the Vercel collector.
- `api-route-security`: Remove the now-obsolete analytics ingestion route from
  route-guard coverage requirements.
- `dataset-onboarding`: Remove analytics-specific content restrictions because
  onboarding no longer produces product analytics.

## Impact

- Runtime/UI: analytics calls and analytics-only props are removed from auth,
  profile, dashboard, dataset, onboarding, field-definition, and user-management
  components; user-visible workflows otherwise remain unchanged.
- APIs: `/api/analytics/events` is removed. The retired dashboard redirect and
  all functional dataset/admin APIs remain.
- Supabase/data integrity: a forward migration deletes two private analytics
  tables and their historical rows. Auth users, datasets, reference resources,
  run artifacts, versions, and Storage objects are unaffected. No RLS or role
  permission expansion is introduced.
- Vercel: no application collector, analytics package, or CSP allowance is
  added. Runtime logs remain the deployment diagnostic source.
- UI smoke: no new rendered page or smoke surface is added; broad component
  prop cleanup and retired-route coverage require the existing full smoke gate.
- Documentation/specs: current-state, repository map, security boundary, and
  durable OpenSpec contracts are updated. Historical archives and dated
  assessments remain unchanged.

### Non-goals

- Do not remove Supabase Auth sign-in timestamps or User Management recency.
- Do not remove structured error logging or domain-owned histories.
- Do not add a replacement analytics, session-replay, RUM, or monitoring vendor.
- Do not delete or rewrite previously applied migration files.
