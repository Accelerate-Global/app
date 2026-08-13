## Why

The administrator pipeline page is the only peer admin surface that omits the shared authenticated site header, leaving its account/navigation menu unavailable. Its page heading also says `Pipeline Operations` while the account menu calls the same destination `Pipelines`, creating an avoidable naming mismatch.

## What Changes

- Render the shared authenticated `SiteHeader` on `/admin/pipeline-operations`, aligned with the other admin pages.
- Change the page's user-facing heading from `Pipeline Operations` to `Pipelines` so the destination and menu use one name.
- Extend the direct page test to cover the shared header/account control and canonical heading while preserving the existing route smoke marker.
- Preserve the existing pipeline controls, admin-only authorization, redirects, route path, APIs, and operational behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pipeline-operations`: Define the canonical Pipelines page name and require the shared authenticated site header on its administrator UI.

## Impact

- UI: `src/app/admin/pipeline-operations/page.tsx` gains the same `SiteHeader` used by `src/app/admin/pipeline-products/page.tsx`, `src/app/admin/identity-registry/page.tsx`, and `src/app/admin/tier2-products/page.tsx`.
- Tests: `src/app/admin/pipeline-operations/page.test.tsx` verifies the visible title and authenticated header/account menu trigger; existing `tests/ui/route-registry.ts` coverage remains applicable.
- Auth and admin permissions: unchanged; the route remains restricted by `getCurrentIdentity()` and `isDatasetAdmin`.
- Data integrity, Supabase, Vercel deployment, and API contracts: unaffected.
- UI smoke coverage: the existing `pipeline-operations` route registry entry and literal smoke markers are preserved.

### Non-goals

- Renaming the route, internal pipeline types, API endpoints, smoke IDs, or code-defined workflow identifiers.
- Changing pipeline launch, scheduling, history, recovery, or backfill behavior.
