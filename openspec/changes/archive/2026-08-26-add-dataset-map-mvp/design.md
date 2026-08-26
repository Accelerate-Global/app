## Context

The dataset-detail page already loads accessible rows through the shared row
cache and evaluates Region, Watchlist, Hotspots, UUPG, and Country sections once
through `applyDatasetFilterSections`. The result is currently consumed only by
TanStack Table in `src/components/dashboard/use-dataset-table-state.tsx`, while
filter state and the page layout are coordinated by
`src/components/dashboard/dataset-detail-client.tsx`.

The MVP needs to prove that the same normalized AX output is useful as a
geographic exploration surface. It must remain a client-side view of data the
user has already been authorized to read, preserve the table as the default,
avoid a map-specific source of truth, and add no paid or quota-metered runtime
service. The initial geographic level is country, which matches the current
Country and Hotspots behavior and avoids the completeness and overplotting
problems of row-level coordinates.

## Goals / Non-Goals

**Goals:**

- Add a local-first `Table` / `Map` choice without adding a route or changing
  existing dataset access behavior.
- Feed both views from one canonical filtered row collection.
- Visualize matching-record density by country, with an explicit legend and
  concise selected-country summary.
- Search the current filtered result locally by country and primary people-group
  name, then focus the corresponding country.
- Treat missing, invalid, ambiguous, and unsupported geography as visible
  unmapped results rather than silently correcting or discarding it.
- Keep runtime map traffic on the AX Online origin and preserve the existing
  Supabase and Vercel architecture.
- Make the map testable through pure geography/aggregation helpers, component
  tests, and the existing dataset-detail smoke route.

**Non-Goals:**

- Street, road, satellite, terrain, or address-level cartography.
- Geocoding, reverse geocoding, routing, directions, or place search.
- Row-level markers, clustering, heatmaps, drawing tools, or editable geometry.
- A new map API, database table, Storage bucket, provider account, scheduled
  job, ingestion adapter, or map-specific publication.
- Persisting the selected Table/Map mode in saved tables or dataset defaults.
- Changing filters, sorting, downloads, saved tables, derived views, source
  refresh, auth, workspace roles, RLS, or deployment behavior.

## Decisions

### 1. Extend the existing dataset-detail view

Add the view choice near the existing dataset action bar and keep `Table` as the
initial mode on every navigation. The existing filter panel remains visible and
controls both modes. Opening a saved table or derived view therefore supplies
its existing filter state to the map automatically, without adding map state to
the saved-filter wire format.

**Alternative considered:** A standalone map page. Rejected because it would
duplicate row loading, filters, permissions, navigation, smoke coverage, and
saved-view behavior while encouraging the map to become a separate product.

### 2. Expose the canonical filtered rows from the existing state hook

`useDatasetTableState` will expose the already memoized filtered rows as a
read-only value in addition to its current table state. The map aggregation will
consume that value; it will not call `applyDatasetFilterSections` again and will
not fetch rows separately. Table sorting remains table-only because country
aggregation is independent of row order.

The data path is:

```text
authorized row API -> dataset row cache -> canonical filter evaluation
                                           |                |
                                           v                v
                                       table rows      country aggregation
                                                            |
                                                            v
                                                       map presentation
```

**Alternative considered:** Derive map data from `table.getRowModel()`. Rejected
because the table model includes presentation concerns such as sorting and
would couple map correctness to TanStack Table lifecycle.

### 3. Render only same-origin vector geography

Use Leaflet as an installed client dependency, loaded only when Map mode is
opened, to render local GeoJSON polygons and interaction controls. Do not use a
CDN, `TileLayer`, map token, external style URL, or hosted tiles. Leaflet is
chosen over a hand-built SVG interaction layer because it supplies established
pan, zoom, bounds, GeoJSON, popup, and cleanup behavior with a small surface.
It is chosen over MapLibre for this MVP because country polygons do not require
WebGL, vector-tile styles, or a tile-source abstraction.

Commit a simplified Natural Earth 1:110m country boundary asset under a
map-specific static-data directory. Natural Earth publishes its vector map data
as public domain at `https://www.naturalearthdata.com/about/terms-of-use/`.
Record the source URL, source release, retrieval date, transformation notes,
license, and checksum next to the asset. Load the asset lazily and from the same
origin only after Map mode is selected.

**Alternative considered:** OpenStreetMap, MapTiler, Mapbox, or Google-hosted
tiles. Rejected because the country MVP does not need street context, and a
hosted dependency introduces quotas, terms, keys, outage behavior, and possible
cost. A hosted basemap can be reconsidered only after the provider-free MVP
demonstrates a concrete need for local detail.

### 4. Join rows to boundaries deterministically

Build a pure geography adapter that reads canonical dataset cells using the
same column identity conventions as the table and filtering code. Prefer a
valid `Geo_ISO3` value. A normalized `Geo_Country_Name` may be used only when it
matches one unambiguous boundary name or an explicitly reviewed alias in the
bundled crosswalk. Unknown codes such as `XXX`, blank values, ambiguous names,
and boundary omissions remain unmapped.

The adapter returns country aggregates plus an unmapped count and reason counts.
It never mutates source rows, calls a geocoder, or writes a corrected value back
to AX data. The default fill metric is the number of matching rows because that
is always defined and avoids implying that population values can safely be
summed across every dataset. The legend and country summary label the metric as
`matching records`.

**Alternative considered:** Fall back to latitude/longitude. Rejected for the
MVP because coordinate coverage differs by source and placing a point inside a
country reliably would require an additional spatial operation. Existing
coordinates remain available for a later, separately specified point-map phase.

### 5. Keep search local and non-authoritative

The map search index is derived in memory from the current filtered rows. It
matches normalized country names and the canonical primary people-group name
field. Results are bounded and grouped by type. Selecting a country result
focuses and selects its polygon; selecting a people-group result focuses its
mapped country and identifies the matching record in the textual country
summary.

Search focus is ephemeral UI state. It does not change canonical filter state,
saved filters, downloads, or source data. Users continue to use the Country
filter when they want to narrow the underlying result set.

**Alternative considered:** A geocoding or hosted search API. Rejected because
the search domain is the already loaded AX dataset, not public places or
addresses.

### 6. Provide a textual and resilient interaction path

The map surface includes a visible heading, legend, result count, unmapped
count, search control, selected-country summary, and explicit empty/error
states. Search results and the country summary provide keyboard-operable textual
alternatives to pointer interaction with polygons. Dataset values are rendered
as React text; the implementation must not pass dataset strings to Leaflet HTML
popup APIs.

If no filtered rows map to a country, the Map view explains the condition and
keeps the Table switch available. If the boundary asset or map renderer fails,
the page shows a recoverable map error without affecting the table, filters,
downloads, or other dataset actions.

### 7. Make the free-tier boundary verifiable

Tests will assert that map data is produced from supplied rows and the bundled
boundary/crosswalk resource, with no fetch path other than the same-origin
static asset and existing row cache. The browser smoke interaction will open Map
mode, wait for a literal map-ready marker, apply a filter, and confirm the map
summary changes. Network inspection in the smoke fixture must not observe a
third-party map, tile, style, font, search, or geocoding request.

No local Supabase instance is expected for unit or component work. The terminal
verification gate determines whether the repository's current impact rules add
any broader checks.

## Risks / Trade-offs

- **[Country-level output may not satisfy the eventual meaning of “local
  maps.”]** → Treat this as a hypothesis-testing MVP. Require evidence from user
  testing before adding detailed basemaps or row-level points.
- **[Natural Earth and AX country/territory semantics can differ.]** → Prefer
  ISO3, keep a small reviewed crosswalk, expose unmapped counts, and test
  territories and unknown codes explicitly.
- **[Matching-row counts can be mistaken for population or priority.]** → Label
  the legend and summary explicitly and do not add a generic “intensity” label.
  Existing Hotspots/UUPG/Watchlist filters determine membership; the map only
  counts the resulting rows.
- **[Large datasets could make repeated aggregation or search expensive.]** →
  Use one memoized linear aggregation over the already filtered rows, keep
  search results bounded, render one polygon per country, and lazy-load the map
  dependency and boundary asset.
- **[A browser-only renderer can complicate SSR and tests.]** → Isolate Leaflet
  behind a client component with deterministic setup/teardown, keep all mapping
  and search logic pure, and mock only the renderer boundary in component tests.
- **[Map-only cues can be inaccessible.]** → Preserve textual search, legend,
  summaries, counts, and the fully accessible table path; verify keyboard focus
  and names in component and smoke tests.
- **[A new static asset adds repository and Vercel bandwidth.]** → Use the
  smallest sufficient Natural Earth scale, simplify properties, lazy-load it,
  and record its compressed and uncompressed sizes during implementation.

## Migration Plan

1. Add and document the pinned boundary asset and pure row-to-country adapter.
2. Expose canonical filtered rows and add the map aggregation/search tests.
3. Add the lazy client renderer, textual summary, and Table/Map control with
   Table remaining the default.
4. Add dataset-detail component and UI smoke coverage, then run the repository
   change gate and terminal verification.
5. Test locally with at least one representative merged dataset, one filtered
   Hotspots/UUPG case, one saved-table URL, and records with invalid geography.
6. Do not ship until local behavior, accessibility, request isolation, and asset
   size are accepted. No data migration, remote migration, or production source
   mutation is required.

Rollback is removal of the Map control, map-only components/dependency, and
boundary asset. Because no persisted shape, API, database, filter wire format,
or source data changes, rollback does not require data recovery.

## Open Questions

None block implementation. Visual color scale, exact map height, and bounded
search-result count can be selected during implementation and validated in the
local UI without changing the behavioral contract above.
