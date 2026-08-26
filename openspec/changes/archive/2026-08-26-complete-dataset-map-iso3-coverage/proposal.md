## Why

The map joins rows by ISO3 correctly, but the bundled 1:110m polygon layer omits 75 small official ISO territories and countries. Before production, every official ISO3 in the repository country catalog must have a same-origin visual representation without replacing the lightweight provider-free map.

## What Changes

- Preserve the compact 1:110m country polygons for the world overview.
- Add one compact point representation for each official ISO3 code omitted by those polygons, deriving coordinates from pinned Natural Earth map-unit data.
- Render and select point representations with the same counts, color scale, keyboard semantics, and textual summaries as polygons.
- Add exhaustive coverage tests proving every official ISO3 in the AX country catalog appears exactly once in the bundled map asset and resolves by ISO3 even when a row's country name conflicts.
- Document the combined boundary sources, transformations, coverage, checksums, and free-tier footprint.
- Keep production database changes, geocoding, third-party runtime requests, and non-ISO administrative codes out of the acceptance contract.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `dataset-map-exploration`: Require every official ISO3 in the repository country catalog to have a bundled polygon or point representation and remain selectable by ISO3.

## Impact

- Boundary build and provenance: `scripts/build-dataset-map-boundaries.ts`, `public/map-data/natural-earth-countries-110m.geojson`, and `public/map-data/README.md`.
- Runtime rendering: `src/components/dashboard/dataset-country-map.tsx`.
- Coverage: map data/component tests and the existing browser map journeys.
- No auth, admin permission, API contract, Supabase schema/data, or Vercel configuration changes. Deployment remains the existing Git/PR release workflow after all local gates pass.
