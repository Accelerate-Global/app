## Why

The analytics page currently shows raw failed event counts separately from a small computed “known failures” list, which makes it unclear which failures are expected, actively being debugged, or already handled. Admins need durable triage state for grouped failure fingerprints so raw event history remains intact while actionable work is visible.

## What Changes

- Add admin failure triage for grouped analytics failure fingerprints with `needs_review`, `debugging`, `expected`, and `resolved` states.
- Store a short triage note and audit fields for the last admin triage action.
- Replace the resolution-only private table with a private triage table, migrating existing resolutions as `resolved`.
- Keep built-in expected user-input outcomes out of open known failures while preserving them in raw event history.
- Reopen a resolved failure group as `needs_review` when a newer matching failure occurs after the last triage action.
- Add an admin-only API for updating failure triage and update the analytics page to show open, expected, resolved, and raw recent failures clearly.

Non-goals:
- Do not rewrite historical analytics events.
- Do not expose analytics failure triage to non-admin users.
- Do not add external issue tracker integration, notifications, assignment, or retention cleanup in this slice.
- Do not change Vercel Analytics event emission semantics.

## Capabilities

### New Capabilities
- `analytics-failure-triage`: Admins can classify grouped analytics failures, preserve notes and audit fields, and distinguish open actionable failures from expected or resolved raw failure history.

### Modified Capabilities
- None.

## Impact

- Affects admin UI and smoke-tracked route `src/app/dashboard/analytics/page.tsx`.
- Affects admin API contracts under `src/app/api/admin/analytics/**`, guarded by existing admin identity and same-origin mutation protections.
- Affects analytics data shaping in `src/lib/analytics-store.ts` and validation in `src/lib/validation.ts`.
- Affects Supabase private schema, Drizzle schema in `src/db/schema.ts`, and a new migration under `supabase/migrations`.
- Affects tests for analytics store, analytics page rendering, admin API authorization/mutation, validation, and schema/migration coverage.
- Affects Supabase/database verification; private tables remain RLS-enabled with public, anon, and authenticated privileges revoked, matching the current analytics storage posture.
