## Why

Five active pipeline reference resources currently route back to the generic Resources index, leaving their cards and Connections rows visibly interactive but unable to open or inspect the selected resource. Operators need direct, consistent access to every healthy resource while completing production-readiness checks.

## What Changes

- Give every catalog resource one canonical detail route and make both the Connections resource table and Resources index link directly to it.
- Add searchable, paginated, downloadable detail views for source aliases, PeopleID3, PEID, Tier 1 priorities, and engagement mappings.
- Preserve the specialized Country and ROP resource experiences.
- Give the Connections page’s Datasets and Resources section titles distinct, semantically appropriate icons instead of reusing the page-level Connections icon.
- Add route, component, migration, and UI-smoke coverage for the new behavior.
- Keep resource payloads, forming rules, refresh/import behavior, lifecycle permissions, and active versions unchanged.

## Capabilities

### New Capabilities

- `resource-catalog-navigation`: Authenticated users can navigate from resource summaries to the exact selected resource and inspect its active entries through a consistent detail experience.

### Modified Capabilities

- `pipeline-resource-bindings`: Resource detail views expose the active resource’s downstream pipeline impact while retaining immutable version and binding behavior.

## Impact

- UI: `src/app/dashboard/resources`, `src/components/dashboard/api-connections-client.tsx`, and a new shared pipeline-resource detail client.
- Routing and catalog data: canonical resource-route mapping plus a Supabase migration correcting the five generic `route_path` values.
- APIs: existing authenticated reference-resource entry and download APIs are reused without contract changes.
- Auth/admin: no permission changes; authenticated users can inspect active versions, while lifecycle administration remains dataset-admin-only.
- Data integrity: no resource content or active-version mutation.
- Vercel: normal Next.js deployment after the required release gates.
- UI smoke: the new dynamic page is registered and exposes a literal page marker.
- Brownfield evidence: the generic routes originate in `supabase/migrations/20260723004707_add_pipeline_reference_resources.sql`; the current summaries consume `ReferenceResourceCatalogItem.routePath` in `src/app/dashboard/resources/page.tsx` and `src/components/dashboard/api-connections-client.tsx`.
