## Why

Users need a first-class in-app resource for HIS Registry of Peoples codes so
ROP1, ROP2, ROP25, and ROP3 values can be reviewed without leaving the dataset
workflow. The country and territory code resource already establishes the
reference-resource pattern this should follow.

## What Changes

- Add an authenticated ROP Codes resource page that uses a single searchable
  table with one matched field each for ROP1, ROP2, ROP25, and ROP3.
- Add a generated HIS ROP snapshot, local refresh script, and admin-only live
  refresh endpoint backed by the public HIS ArcGIS FeatureServer.
- Include ROP3 geography details from ROP3GeoIndex in the row detail sheet only.
- Add a built-in Resources card, route smoke registration, tests, and source
  validation.
- Non-goals: do not change dataset import semantics, API connection run
  behavior, Supabase schema/RLS, saved tables, workspace roles, or Vercel
  deployment behavior.

## Capabilities

### New Capabilities
- `rop-code-resource`: Defines the authenticated HIS ROP code reference
  resource, source refresh behavior, flattened hierarchy matching, detail
  geography, download behavior, and UI smoke coverage.

### Modified Capabilities
- `reference-resources`: Adds the ROP Codes card to the authenticated Resources
  page.

## Impact

- Affects UI routes under `src/app/dashboard/**`, shared dashboard components,
  generated app data, one internal refresh API, route smoke registration, and
  package scripts.
- Affects API contracts by adding an admin-only `GET /api/rop-codes/refresh`
  endpoint that returns live resource data without persisting server-side files.
- Affects data integrity at the resource level by validating HIS row shape,
  minimum counts, unique codes, and hierarchy joins before replacing the visible
  resource.
- Affects UI smoke coverage because the new dashboard page must be registered in
  `tests/ui/route-registry.ts` and expose matching smoke markers.
- Does not affect auth role definitions, Supabase schema/RLS, provider-facing
  secrets, or production deployment configuration.
