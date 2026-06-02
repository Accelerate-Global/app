## Why

The country and territory code resource currently exposes ISO, GENC, and
legacy FIPS values, but dataset work also uses ROG3 as a separate compatibility
code. ROG3 overlaps heavily with legacy FIPS/GEC, yet it should not be treated
as the same field because users need to inspect and export both values.

## What Changes

- Add a separate `ROG3` field to the generated country and territory resource
  while preserving the existing `FIPS` field.
- Refresh ROG3 from the current NGA/GNS GENC-to-GEC crosswalk and document the
  HIS ROG cross-reference as the source that defines ROG3 semantics.
- Keep the curated Accelerate Global overlay as the resource row universe and
  use source matching rules that preserve split territory rows.
- Update the page table, detail sheet, search, refresh copy, and CSV download
  so both FIPS and ROG3 are visible.

## Capabilities

### Modified Capabilities

- `iso-country-code-resource`: Adds synced ROG3 country and territory codes as
  additive metadata alongside the existing ISO, GENC, FIPS, and curated fields.

## Impact

- Affects generated country-code JSON shape and live refresh behavior.
- Affects `/dashboard/country-codes` table columns, detail sheet, search text,
  and CSV output.
- Affects country-code route, client, API, generated-data, and field-source
  tests.
- Does not add database tables, Supabase migrations, RLS policy changes, or new
  routes.
