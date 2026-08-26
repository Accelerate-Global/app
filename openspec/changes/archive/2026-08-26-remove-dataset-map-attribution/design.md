## Context

Dataset Map mode currently renders one source-facing element: an optional
`Made with Natural Earth` link beneath the country polygons. Natural Earth says
credit is unnecessary for its public-domain data, Leaflet attribution is
already disabled in `dataset-country-map.tsx`, and map provenance is fully
recorded in `public/map-data/README.md`.

## Goals / Non-Goals

**Goals:**

- Remove optional third-party branding from the user-facing map.
- Retain the matching-record legend and all map behavior.
- Preserve complete maintainer-facing provenance and license documentation.
- Enforce the branding-free surface in component tests.

**Non-Goals:**

- Removing source provenance from the repository.
- Replacing Natural Earth geometry or Leaflet.
- Changing map data, filters, search, permissions, APIs, Supabase, or hosting.

## Decisions

Delete the Natural Earth anchor and simplify the legend row so it does not
reserve alignment space for a second item. Keep `attributionControl: false` on
the Leaflet map and keep the boundary README unchanged.

**Alternative considered:** Move the attribution into a tooltip or menu.
Rejected because attribution is optional and any runtime placement retains
unnecessary provider-facing UI.

## Risks / Trade-offs

- **[Maintainers may lose sight of the map source.]** → Keep source URL,
  release, retrieval date, transformation, license, checksum, and size in the
  adjacent boundary README and durable design archive.
- **[A future map dependency could reintroduce branding.]** → Retain source and
  browser checks for provider URLs, attribution controls, and visible labels.

## Migration Plan

Remove the link, update the test, verify the rendered local map, and run the
normal change gate. Rollback is restoring the optional anchor; no data or
service migration is involved.

## Open Questions

None.
