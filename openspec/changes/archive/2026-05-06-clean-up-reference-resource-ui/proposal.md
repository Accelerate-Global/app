## Why

The dashboard and reference-resource pages currently duplicate navigation and
show utility UI that is not useful for the requested resource workflow. Users
should reach resources from the Resources area, see saved datasets only when
they have saved datasets, and open resource rows the same way they open API
connection rows.

## What Changes

- Remove the dashboard Reference Resources card.
- Hide the dashboard Saved Datasets section when the signed-in user has no
  owner-scoped saved datasets.
- Change the country-code page back link to return to `/dashboard/resources`.
- Remove the country-code visible-count badge while preserving search,
  refresh, and CSV download.
- Remove the API Connections Resources Open action column and make Resources
  rows clickable and keyboard-accessible.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `reference-resources`: dashboard resource discovery and empty saved-dataset
  visibility are changing.
- `iso-country-code-resource`: country-code page navigation and visible-count
  controls are changing.
- `api-connection-runs`: Resources grid row-opening behavior is changing.

## Impact

- Affects dashboard, country-code, and API Connections UI components and their
  same-stem tests.
- Affects OpenSpec behavior contracts for reference-resource discovery,
  country-code controls, and API Connections Resources.
- Does not change auth, admin permissions, Supabase schema, RLS, API contracts,
  data persistence, Vercel deployment behavior, or UI smoke route registration.
