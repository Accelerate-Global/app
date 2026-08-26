## Why

AX Online can already merge, normalize, filter, and search partner datasets, but
users can inspect the resulting geography only through a table. A lightweight
map view would make country-level UUPG, Hotspots, Watchlist, region, and country
results easier to understand without creating a second dataset, a paid map
service dependency, or a separately maintained source pipeline.

## What Changes

- Add a `Table` / `Map` view choice to the existing authenticated dataset-detail
  experience in `src/components/dashboard/dataset-detail-client.tsx`.
- Render an interactive country-level map from a small, bundled, public-domain
  boundary resource joined through the dataset's normalized ISO3/country data.
- Drive the map from the same canonical filtered row set and saved filter state
  used by the existing dataset table, so Region, Country, UUPG, Hotspots, and
  Watchlist changes update both views consistently.
- Provide local country and people-group search, country selection, a concise
  country summary, and a visible count of records that cannot be mapped.
- Keep table access, downloads, saved tables, derived views, sorting, and all
  existing dataset permissions unchanged.
- Cover the view switch and map-ready interaction through the existing
  dataset-detail smoke route and component tests.
- Constrain the MVP to browser-side visualization of already loaded rows. It
  will not add map tiles, street or satellite imagery, address geocoding,
  routing, drawing tools, a map-specific database, a new ingestion pipeline, or
  a hosted mapping account.

## Capabilities

### New Capabilities

- `dataset-map-exploration`: Defines the authenticated dataset map view, its
  reuse of canonical filtering, local search and country interaction, unmapped
  record handling, and provider-free operating boundary.

### Modified Capabilities

None. Existing dataset access, filtering, saving, download, and dashboard layout
contracts remain authoritative and unchanged.

## Impact

- **UI:** Primarily affects the existing dataset-detail composition in
  `src/components/dashboard/dataset-detail-client.tsx`, the shared row/filter
  state in `src/components/dashboard/use-dataset-table-state.tsx`, and new
  dataset-map components and tests under `src/components/dashboard/`.
- **Static data and dependency:** Adds one simplified country-boundary asset and
  one lightweight client-side rendering dependency or equivalent local
  renderer. The boundary asset must have documented provenance and a license
  compatible with repository distribution.
- **APIs and data:** No new API contract, database table, Supabase migration,
  storage bucket, source connector, scheduled job, or duplicated dataset is
  planned. Existing row reads and client caching remain the data path.
- **Auth and permissions:** No auth or admin-permission changes. The map exists
  only inside the already protected dataset-detail page and cannot reveal rows
  the current user cannot access.
- **Data integrity:** The map is a presentation of canonical filtered rows, not
  a publication or source of record. Invalid or missing geography remains
  visible as an unmapped count rather than being silently geocoded or dropped.
- **Supabase and Vercel:** No new Supabase runtime surface and no Vercel
  deployment behavior change. The only expected hosting impact is delivery of
  a small static boundary asset and client bundle code.
- **UI smoke:** The existing `/dashboard/datasets/[datasetId]` route remains in
  `tests/ui/route-registry.ts`; the new switch and map surface require literal
  smoke trigger/surface/ready markers and targeted fixture coverage.
