## Why

The app currently sends analytics events to Vercel Web Analytics while also
persisting product events in the app-owned Supabase analytics store. A
repo-level pause switch lets the team stop Vercel collection and cost exposure
without removing analytics instrumentation or losing internal admin analytics.

## What Changes

- Add a `NEXT_PUBLIC_VERCEL_ANALYTICS_PAUSED=1` environment flag that pauses
  outbound Vercel Web Analytics collection.
- When paused, do not load the Vercel Web Analytics browser script from the
  root layout.
- When paused, skip Vercel custom-event `track(...)` calls while preserving the
  existing internal `/api/analytics/events` persistence path.
- Apply the same pause behavior to the server analytics helper for future
  server-side analytics use.
- Document the flag and redeploy requirement for Vercel environments.
- Non-goals: do not remove `@vercel/analytics`, do not remove existing
  analytics call sites, do not change the Supabase analytics schema, and do not
  change Vercel dashboard settings automatically.

## Capabilities

### New Capabilities

- `vercel-analytics-pause`: Controls whether the app sends page views and
  custom product events to Vercel Web Analytics while preserving app-owned
  analytics persistence.

### Modified Capabilities

- None.

## Impact

- Affects Vercel Web Analytics behavior, deployment environment configuration,
  and analytics code under `src/components/analytics` and `src/lib/analytics*`.
- Preserves the existing internal analytics dashboard backed by
  `private.analytics_events`.
- Does not affect auth, admin permissions, data integrity, Supabase migrations,
  public API contracts, or UI smoke route coverage.
