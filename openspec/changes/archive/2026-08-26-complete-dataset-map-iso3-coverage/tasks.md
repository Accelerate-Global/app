## 1. Build Complete ISO3 Asset

- [x] 1.1 Add a reproducible pinned-source boundary builder that preserves 1:110m polygons and adds one point for every omitted official ISO3.
- [x] 1.2 Regenerate the checked-in GeoJSON and update provenance, checksums, feature counts, and compressed footprint documentation.
- [x] 1.3 Add exhaustive tests for valid unique codes, all 249 official catalog codes, point fallback coverage, and ISO3-over-name aggregation.

## 2. Render ISO3 Point Fallbacks

- [x] 2.1 Render point features as count-colored selectable Leaflet circle markers without changing polygon behavior.
- [x] 2.2 Extend component and browser coverage for point click/keyboard selection, summaries, filters, and provider-free requests.

## 3. Verify, Archive, and Release

- [x] 3.1 Run direct boundary/map tests, `pnpm run smoke:check`, and the focused browser journey while debugging.
- [x] 3.2 Run `pnpm run verify:change:run` and verify that the implementation, tests, and OpenSpec requirements agree before archive.
- [x] 3.3 Confirm the existing Git/PR release workflow remains unchanged and identify the production verification target.
