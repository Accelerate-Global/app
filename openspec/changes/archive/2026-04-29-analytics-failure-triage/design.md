## Context

`src/lib/analytics-store.ts` already groups failed analytics events by fingerprint and filters built-in expected outcomes away from `Known failures`. It also has a resolution-only helper backed by `private.analytics_failure_resolutions`, but no admin-facing mutation path or durable state for “debugging” or “expected.” The admin analytics page is a Server Component, so mutations should stay behind admin API routes and the page should refresh through normal server rendering.

## Goals / Non-Goals

**Goals:**

- Give admins durable triage state for each grouped analytics failure fingerprint.
- Preserve raw event history and raw failed-event counts.
- Keep open known failures limited to actionable groups that need review or are being debugged.
- Keep expected outcomes and resolved groups visible enough to explain count differences.
- Maintain the private schema/RLS posture and existing admin-only analytics route access.

**Non-Goals:**

- No historical event rewrites or backfills beyond migrating existing resolution rows.
- No non-admin access to analytics triage.
- No assignment, notifications, external issue tracker links, or retention cleanup.
- No change to Vercel Analytics emission or client event payload semantics.

## Decisions

1. **Replace resolution rows with triage rows.** The new private table stores one row per fingerprint with status, note, `triaged_by_owner_id`, `triaged_at`, `created_at`, and `updated_at`. Existing resolution rows migrate as `resolved` so current “already addressed” behavior is preserved. Alternative considered: extend the old resolution table, but the name and shape would be misleading once it stores expected/debugging states.

2. **Compute display state from events plus triage.** A group without a row is `needs_review`; `debugging` remains open; `expected` is not open; `resolved` is not open unless the latest event is newer than `triaged_at`, in which case the group reopens as `needs_review`. Alternative considered: update triage rows during event ingest, but read-time computation avoids extra writes on every analytics event and keeps history immutable.

3. **Keep built-in expected failures as computed expected groups.** Invalid credentials and invalid recovery links remain expected even without stored rows, while admins can classify other fingerprints as expected. Alternative considered: seeding those fingerprints into the table, but computed defaults avoid seed drift and work across route/source variants.

4. **Use an admin-only API route for mutations.** The analytics page remains a Server Component and posts triage changes through `/api/admin/analytics/failure-triage`; `src/proxy.ts` already same-origin guards mutating `/api/**` requests. Alternative considered: Server Actions, but existing admin mutation patterns use API routes and client fetches.

5. **Use a small client component for triage controls.** The server page owns data fetching and rendering; a focused client component handles status/note updates and refreshes the route. This keeps client JavaScript scoped to the interactive controls.

## Risks / Trade-offs

- **Resolved groups can reappear unexpectedly after a new occurrence** -> Show copy and status behavior that makes reopening explicit.
- **Notes could store sensitive provider details** -> Limit note length and use admin-only private storage; keep provider raw error objects out of analytics payloads per existing logging policy.
- **Broad verification is affected by unrelated dirty files** -> Keep this change scoped and run focused tests first, then terminal verification on the candidate tree.
- **Migration rollback would lose newer triage statuses if reverting to resolution-only** -> The migration is additive/migratory for data; rollback would require preserving only `resolved` rows back into the old table if needed.

## Migration Plan

- Create `private.analytics_failure_triage` with constrained status values, note length check, indexes, RLS enabled, and public/anon/authenticated privileges revoked.
- Copy rows from `private.analytics_failure_resolutions` into the new table as `resolved`.
- Drop the old resolution table after migration.
- Update Drizzle schema and tests to reference the new table.
- Verify with local database security and migration drift checks selected by `pnpm run verify:change`.

## Open Questions

- None for this slice.
