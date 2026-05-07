## Why

The country and territory resource already links curated rows to ISO3, GENC, and FIPS metadata, but it does not expose the official UN country names that ISO identifies as the naming source for ISO 3166. Adding a UNTERM-to-M49 bridge gives users official short and formal names tied back to ISO3 without mixing official source data with locally curated aliases.

## What Changes

- Fetch UNTERM country-name data and UNSD M49 country/area data during the country-code refresh flow.
- Join UNTERM official English short/formal names to ISO3 via the M49 country/area name and ISO-alpha3 code.
- Extend each generated country/territory entry with nullable official UNTERM name fields and source metadata.
- Show official UN short/formal names separately in the country-code detail sheet, search, and CSV export.
- Preserve the current admin-only alternate-name editing workflow as a curated alias layer.

Non-goals:

- Do not create UI controls for editing official UNTERM names.
- Do not replace the current curated display names or row universe.
- Do not add Supabase tables, migrations, RLS policies, or new mutable APIs.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `iso-country-code-resource`: enrich the existing country and territory code resource with official UNTERM short/formal names linked to ISO3 through UNSD M49.

## Impact

- Affects `src/lib/iso-country-codes.ts`, the generated country-code JSON snapshot, `/api/iso-country-codes/refresh`, and the `/dashboard/country-codes` client UI/tests.
- Affects the country-code resource API response shape by adding nullable official-name metadata fields.
- Affects data integrity validation for source refreshes by adding UNTERM/M49 parsing and join checks.
- Does not change auth, admin permissions, Supabase persistence, Vercel deployment behavior, or UI smoke route coverage.
