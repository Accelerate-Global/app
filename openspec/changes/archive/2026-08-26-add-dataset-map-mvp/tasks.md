## 1. Confirm Scope and Add Local Map Inputs

- [x] 1.1 Rerun `pnpm run verify:change`, then run `pnpm run task:kickoff -- --scope` for the exact dataset-detail, map component, static asset, dependency, test, smoke, and OpenSpec paths reported by the candidate implementation.
- [x] 1.2 Add Leaflet and its TypeScript support as pinned workspace dependencies, load the renderer from the application bundle only, and verify that no CDN, token, provider environment variable, or hosted map source is introduced.
- [x] 1.3 Add a simplified Natural Earth 1:110m country GeoJSON asset with only the geometry and properties required for country joining, plus adjacent provenance documenting source URL, release, retrieval date, transformation, public-domain license, checksum, and compressed/uncompressed size.
- [x] 1.4 Add a reviewed country-boundary crosswalk for the minimum unambiguous AX country/territory exceptions discovered in representative data, keeping unknown and ambiguous values unmapped.

## 2. Build and Test Map Data Semantics

- [x] 2.1 Create pure, typed helpers that read canonical ISO3, country, and primary people-group cells from dataset rows without mutating them.
- [x] 2.2 Implement one memoizable linear aggregation that produces country matching-record counts, searchable country/people-group entries, total mapped rows, and unmapped reason counts from canonical filtered rows.
- [x] 2.3 Add direct unit tests for ISO3 precedence, reviewed country-name fallback, `XXX`, blank and ambiguous geography, boundary omissions, multi-row country counts, bounded search, and input immutability.
- [x] 2.4 Add a contract test proving map aggregation performs no geocoding or third-party request and labels its metric as matching records rather than population or priority.

## 3. Share Canonical Filter Results

- [x] 3.1 Extend `useDatasetTableState` to expose its existing memoized canonical filtered rows as a read-only result without rerunning filtering or deriving from the sorted TanStack Table model.
- [x] 3.2 Update `use-dataset-table-state.test.tsx` to prove Table and Map consumers receive the same rows after Region, Country, UUPG, Hotspots, and Watchlist evaluation and that existing sorting behavior remains unchanged.
- [x] 3.3 Verify saved-table URLs and derived datasets continue to initialize through the existing filter and backing-dataset paths, with no Table/Map field added to the saved-filter wire format.

## 4. Implement the Local-First Dataset Map UI

- [x] 4.1 Build a client-only country map renderer that lazy-loads Leaflet and the same-origin boundary asset, renders GeoJSON polygons without a tile layer, updates styles from country aggregates, and cleans up renderer state on view changes and unmount.
- [x] 4.2 Build the Map-mode shell with an explicit matching-record legend, mapped and unmapped counts, bounded local search, keyboard-operable search results, selected-country summary, and clear loading, empty, no-mappable-geography, and recoverable-error states.
- [x] 4.3 Render dataset values as React text rather than Leaflet popup HTML and add component tests covering untrusted-looking values, accessible names, keyboard interaction, country and people-group search, country selection, and renderer failure isolation.
- [x] 4.4 Add a `Table` / `Map` control to the existing dataset-detail composition, keep Table as the initial mode, preserve the filter panel and action bar, and keep the layout usable at desktop and phone widths.
- [x] 4.5 Update `dataset-detail-client.test.tsx` and any directly affected same-stem tests to prove view switching preserves filters, downloads, sorting, saved-table behavior, derived-view behavior, and role-based dataset access.
- [x] 4.6 Add literal `data-smoke-trigger`, `data-smoke-surface`, and `data-smoke-ready` markers for the map interaction and extend the existing dataset-detail journey so it opens Map mode, applies a filter, observes the updated summary, returns to Table mode, and detects any third-party map request.

## 5. Verify the Local MVP and Close the Change

- [x] 5.1 Run the direct map helper, state hook, dataset-detail, action-bar, and affected UI tests first; classify and fix every failure before proceeding.
- [x] 5.2 Run `pnpm run smoke:check`, then use the targeted browser smoke subset only when required by the current `pnpm run verify:change` plan or to isolate a browser-specific failure.
- [x] 5.3 Exercise the local UI with a representative merged dataset, a Hotspots/UUPG filtered result, a saved-table URL, zero-result filters, and invalid geography; confirm the map issues no external map/search requests and record the final lazy asset/bundle sizes for review.
- [x] 5.4 Rerun `pnpm run verify:change`, execute every listed required command, and finish with `pnpm run verify:change:run`; treat missing test deltas, skipped checks, and `No tests found` as blockers.
- [x] 5.5 After implementation and required verification pass, archive `add-dataset-map-mvp` through the repository OpenSpec archive command, rerun strict OpenSpec validation, and keep ship-local or release work out of scope unless separately authorized.
