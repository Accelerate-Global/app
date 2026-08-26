## Context

The production candidate uses a 254 KB Natural Earth 1:110m country polygon file with 177 unique three-letter keys. ISO3 lookup is authoritative in `src/lib/dataset-map-data.ts`, but the low-detail source intentionally omits small countries and territories: 75 of the 249 official ISO3 codes in `src/data/iso-country-codes.generated.json` have no polygon. Natural Earth provides map-unit label coordinates at 1:50m for all but two of those codes and 1:10m data for the remaining `BVT` and `UMI` representations.

## Goals / Non-Goals

**Goals:**

- Guarantee one bundled visual feature for every official ISO3 in the AX catalog.
- Keep the existing 1:110m polygons and add only lightweight points for omitted codes.
- Make point features visually countable, clickable, keyboard-operable, and selectable like polygons.
- Make boundary generation reproducible from pinned primary sources and fail closed if ISO3 coverage drifts.
- Preserve same-origin, provider-free runtime behavior and free-tier suitability.

**Non-Goals:**

- Replacing Natural Earth with a hosted map provider or geocoder.
- Loading 1:50m or 1:10m polygon geometry at runtime.
- Inventing or correcting country codes outside the repository catalog.
- Changing filters, dataset rows, Supabase, auth, RLS, or API contracts.

## Decisions

1. **Merge polygons and points into one same-origin GeoJSON asset.** The map continues to perform one fetch. Existing 1:110m polygons remain unchanged; omitted official ISO3 codes receive GeoJSON Point features.

2. **Derive points from pinned Natural Earth map-unit label coordinates.** Generation uses version `v5.1.2` 1:50m map units first and falls back to 1:10m map units for `BVT` and `UMI`. Runtime never contacts these sources. A full 1:50m or 1:10m polygon layer was rejected because its compressed footprint is roughly 0.8–4.4 MB versus a few kilobytes for points.

3. **Use the AX official ISO catalog as the coverage authority.** Build output MUST include exactly one feature for each `officialIsoAlpha3`; non-official Natural Earth administrative features may remain as background boundaries but do not satisfy or weaken the official-code invariant.

4. **Render points as Leaflet circle markers.** Markers use the same count-based colors and selected-state outline as polygons. The existing feature interaction hook supplies click, Enter, Space, accessible labels, and textual summaries.

5. **Fail the build helper and tests on drift.** Missing coordinates, invalid ISO3 values, duplicate output codes, or incomplete official catalog coverage are terminal errors. Tests load the checked-in production asset and aggregate one intentionally conflicting-name row for every official ISO3 to prove ISO3 precedence end to end.

## Risks / Trade-offs

- **[Risk] A point is less geographically precise than a polygon.** → Points are used only where the lightweight polygon source has no feature and are labeled with the exact catalog country/territory name.
- **[Risk] Several tiny territories cluster visually.** → Fixed-radius markers, keyboard access, and local text search keep them selectable.
- **[Risk] Upstream Natural Earth fields change.** → Sources are version-pinned and generation fails on missing official coverage.
- **[Risk] Extra point features increase payload size.** → Retain only ISO3, display name, and coordinates; document raw, output, and gzip sizes.

## Migration Plan

Generate and commit the merged asset, run focused tests and the complete ship-local gate, then deploy through the existing PR workflow. Rollback is the prior production commit; no database rollback or Supabase migration is needed.

## Open Questions

None. The user's production acceptance criterion is official ISO3 representation rather than a particular geopolitical boundary worldview.
