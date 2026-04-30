## Context

API connection runs already archive normalized rows and raw output artifacts. Joshua Project output normalization flattens `Resources` into indexed columns (`Resource_##_Category`, `Resource_##_WebText`, `Resource_##_URL`). The index page already lists available API connections for dataset admins and can carry additional server-fetched data without exposing it to non-admin users.

## Decisions

1. **Persist run-history resources.** Store extracted resources in `private.api_connection_resources` with foreign keys to `private.api_connections` and `private.api_connection_runs`. This preserves historical run context instead of maintaining a current-only catalog.

2. **Dedupe URLs within each run.** Enforce a unique index on `(connection_id, run_id, normalized_url)`. URL normalization uses the parsed HTTP(S) URL with the hash removed; the original URL is preserved for the Open action.

3. **Publish from successful test and import runs.** Test runs can validate resources without importing a dataset, so both successful modes publish resources before the run is marked `success`.

4. **Keep the index page bounded.** The page loads the newest 500 resource rows server-side for v1. Larger history browsing can be added later with pagination if needed.

5. **Keep the Resources grid minimal.** The visible columns are category, display text, URL, and Open. Run and connection IDs remain in the data model but are not displayed in v1.

## Risks / Trade-offs

- Historical rows can grow over time -> The index page uses a fixed newest-500 limit and indexes `created_at` plus `(connection_id, created_at)`.
- Resource extraction is field-shape dependent -> Only `Resource_##_URL` groups are extracted, so non-resource API outputs remain unaffected.
- Private table access relies on service-side code -> RLS is enabled and public-facing role grants are revoked, matching existing private API connection tables.
