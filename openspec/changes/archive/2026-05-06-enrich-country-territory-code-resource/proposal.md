## Why

The country-code resource currently exposes the official ISO 3166-1 list, but
dataset cleanup also needs aliases, legacy FIPS codes, and territory rows from
the curated Accelerate Global ISO3 sheet. The curated sheet intentionally has
more rows than ISO because it includes legacy FIPS/GEC-style entities, duplicate
ISO3 territory rows, and non-official code values.

## What Changes

- Broaden the resource from a pure ISO list to a country and territory code
  crosswalk.
- Commit the curated transposed CSV overlay as the row universe for the app
  resource.
- Refresh ISO from ISO OBP, GENC from the NCI EVS GENC text feed, and legacy
  FIPS values from a deprecated FIPS 10-4 registry, then merge those sources onto
  the curated CSV rows.
- Show all curated rows in the authenticated web UI with aliases, FIPS, GENC,
  status, classification, search, copy, download, and live refresh behavior.

## Capabilities

### Modified Capabilities

- `iso-country-code-resource`: Expands the resource to include curated country
  and territory rows with source enrichment and clear classification.

## Impact

- Affects generated app resource shape and source refresh behavior.
- Affects `/dashboard/country-codes` UI labels, table columns, search, and copy
  behavior.
- Affects the API Connections built-in Resources row label.
- Does not add Supabase schema, RLS, or persistence changes.
