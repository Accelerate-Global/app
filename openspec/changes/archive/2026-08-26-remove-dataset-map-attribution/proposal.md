## Why

The local map MVP displays an optional `Made with Natural Earth` link that
visually competes with AX Online and is unnecessary under Natural Earth's
public-domain terms. Removing optional source branding keeps the focused map
surface lightweight while preserving repository-level provenance.

## What Changes

- Remove the visible `Made with Natural Earth` link from Dataset Map mode.
- Keep Leaflet's built-in attribution control disabled and confirm no other
  provider logo, attribution, token, hosted tile, style, font, search, or
  geocoding branding is rendered.
- Preserve Natural Earth source, release, license, checksum, transformation,
  and size documentation in `public/map-data/README.md`.
- Update map component tests to enforce the branding-free runtime surface.
- Do not change the map geometry, filters, search, counts, data provenance,
  licensing, auth, permissions, APIs, Supabase, or deployment behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dataset-map-exploration`: Require the provider-free map surface to omit
  optional third-party source/provider branding while keeping maintainers'
  provenance documentation.

## Impact

- **UI:** Removes one optional link from
  `src/components/dashboard/dataset-map-view.tsx`; the existing legend remains.
- **Tests:** Extends `dataset-map-view.test.tsx` and the local browser review to
  prove no visible provider/source branding remains.
- **Contracts:** Updates the existing `dataset-map-exploration` specification.
- **Unaffected:** No auth, admin permission, data integrity, API, Supabase,
  database, Vercel deployment, dependency, boundary asset, or UI smoke route
  changes are required.
