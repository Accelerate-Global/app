## Why

Joshua Project API connection output can include referenced documents under flattened `Resource_##_*` fields, but those references are currently only available by downloading archived run artifacts or imported datasets. Admins need a scan-first Resources grid on `/dashboard/api-connections` so referenced documents captured by API runs are visible alongside available connections.

## What Changes

- Persist extracted API connection resources into a private run-history table.
- Publish resource rows from any successful test or import run before marking the run successful.
- Return the newest 500 persisted resources with the API Connections page data.
- Render a second read-only Resources grid below the existing API Connections grid with category, display text, URL, and Open action columns.
- Keep resources admin-only through the existing API Connections page authorization and private table posture.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `api-connection-runs`: API connection runs persist extracted referenced resources and the admin API Connections index shows the newest captured resources.

## Impact

- Affects API connection run persistence in `src/lib/api-connections.ts`.
- Adds a private Supabase table and Drizzle schema for API connection resources.
- Affects admin API Connections page data and UI rendering.
- Affects API connection, schema, migration, and UI tests.
- Does not change public auth roles, same-origin mutation guards, provider secrets, storage artifact formats, or non-admin access.
