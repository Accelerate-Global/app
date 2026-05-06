## Why

The Country & Territory Codes resource table is too wide after alias, numeric,
classification, and copy columns were added. Users need a scannable table with
the same searchable details available in the established right-side sheet
pattern used elsewhere in the dashboard.

## What Changes

- Compact the `/dashboard/country-codes` table to the primary scan columns:
  country/territory, status, ISO3, FIPS, and GENC3.
- Move ISO2, numeric codes, classification, copy actions, source identifiers,
  and alternative names into a row detail sheet that opens from the right.
- Let users change a row's active/inactive status and add alternative names for
  the current browser session without writing workspace data.
- Remove the duplicate in-card resource title and generated metadata sentence
  while preserving refresh, JSON download, visible count, and full-field search.
- Add UI smoke markers for the new detail sheet surface.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `iso-country-code-resource`: changes the country-code resource table and
  interaction requirements.

## Impact

- Affects `src/components/dashboard/iso-country-codes-client.tsx` and its
  component tests.
- Affects the `iso-country-code-resource` OpenSpec requirement for resource
  interaction behavior.
- Does not change auth, admin permissions, Supabase data, Vercel deployment
  behavior, generated resource schema, refresh API contracts, or external
  source scraping.
- UI smoke coverage is affected through a new sheet surface marker on the
  existing registered page.
