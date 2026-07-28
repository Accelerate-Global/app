## Context

The catalog already stores seven immutable resource families and exposes authenticated entry, download, version, and impact APIs. Country and ROP have specialized pages, but the five pipeline resources were seeded with `/dashboard/resources`; both current UI entry points trust that generic route and therefore return users to the index. The change crosses the Next.js resource index, the Connections client, catalog routing data, a new dynamic detail route, and UI smoke coverage.

## Goals / Non-Goals

**Goals:**

- Make every resource summary navigate directly to the selected resource.
- Reuse the existing paginated entry and CSV download APIs for a consistent searchable detail experience.
- Keep specialized Country and ROP pages intact.
- Align stored catalog routes with canonical application routes and defend the UI from stale generic route data.
- Preserve existing authentication and administrator-only lifecycle boundaries.

**Non-Goals:**

- Editing resource entries inline.
- Changing resource validation, imports, active versions, pipeline bindings, or refresh behavior.
- Combining the specialized Country and ROP interfaces into the generic pipeline-resource view.
- Making captured ingestion evidence rows navigable.

## Decisions

1. **Use one dynamic route for the five pipeline resources.**
   `/dashboard/resources/[resourceKey]` validates that the key belongs to the pipeline-resource family, loads the active catalog item and first page server-side, and returns not-found for unsupported keys. This avoids five nearly identical pages while giving each resource a durable URL.

2. **Keep canonical route resolution in application code and catalog data.**
   A typed route helper maps all seven resource keys to their exact routes. The catalog service returns this canonical value even if an older database value survives temporarily. A migration updates the five stored paths so database state, application state, and external diagnostics agree.

3. **Render typed, resource-specific columns through one client.**
   The shared client uses a fixed column definition per pipeline resource key, submits search to the existing authenticated entries endpoint, appends cursor pages, and links CSV downloads to the existing streaming endpoint. Unknown object dumping is avoided so the operator sees stable, meaningful columns.

4. **Expose lifecycle history only to dataset administrators.**
   All authenticated users may inspect active entries. Existing administrator APIs and `ReferenceResourceLifecycle` remain the only path to version history and rollback controls; no permission or RLS change is introduced.

5. **Use distinct section icons on Connections.**
   The page-level cable icon remains Connections. Datasets uses a database icon, and Resources uses a library/reference icon, making the visual hierarchy semantic rather than repetitive.

## Risks / Trade-offs

- **Large pipeline resources could over-render.** → Load 100 rows initially, preserve server pagination, and append only on explicit “Load more.”
- **Catalog route data could drift again.** → Resolve canonical routes from the typed resource key in the service and test every mapping.
- **Wide typed tables can overflow on small screens.** → Reuse the scrollable table container and keep cells compact with wrapping where appropriate.
- **Dynamic route could accidentally accept Country or ROP.** → Validate with the pipeline-resource key guard and return not-found; specialized routes remain canonical.

## Migration Plan

1. Deploy the additive dynamic page and canonical route resolver.
2. Apply the Supabase migration updating the five pipeline-resource `route_path` values.
3. Verify direct navigation from Connections and Resources plus search/download behavior.
4. Rollback is application-safe: redeploy the prior application. The corrected route strings can remain because older code already tolerates valid `/dashboard/...` paths.

## Open Questions

None. Existing APIs, catalog payloads, and permissions provide all required behavior.
