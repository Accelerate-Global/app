## Context

The country and territory code resource is generated from ISO OBP, GENC, legacy
FIPS, and the curated Accelerate Global overlay in
`src/lib/iso-country-codes.ts`. The resource already supports admin-maintained
alternate names through a private Supabase-backed override table, while the
checked-in generated JSON remains the deterministic source for normal page
loads.

ISO documents ISO 3166 as the code authority but identifies United Nations
sources as the source for country names. UNSD M49 publishes country/area names
with ISO-alpha3 codes and states that M49 adopts the official short name shown
on UNTERM. UNTERM provides short and formal names in a downloadable XLSX file
but does not include ISO3 in that download, so the bridge needs both sources.

## Goals / Non-Goals

**Goals:**

- Add official UN English short/formal names to the generated resource.
- Link UNTERM names to ISO3 by joining UNTERM English short names against UNSD
  M49 country/area rows.
- Keep official UN names visually and structurally separate from curated
  alternate names.
- Preserve the current row universe, display names, admin permissions, and
  persisted alias override behavior.

**Non-Goals:**

- Do not add user editing for official UNTERM fields.
- Do not replace curated display names with UNTERM names.
- Do not add database tables, migrations, RLS policies, or local Supabase
  requirements.
- Do not change Vercel deployment behavior.

## Decisions

- Fetch UNTERM XLSX and parse the workbook directly in the existing refresh
  helper. This keeps the refresh command and admin endpoint as the single
  source-update path. Alternative considered: manually maintain a CSV export,
  but that would make official-name updates non-refreshable.
- Fetch M49 HTML and parse the English countries/areas table into ISO3 bridge
  rows. This avoids relying on non-official mirrors and matches the public UN
  source already used to explain the bridge. Alternative considered: join
  UNTERM directly to ISO OBP English short names, but M49 is the UN-maintained
  bridge that explicitly includes ISO-alpha3.
- Match by normalized English names first and support a small local alias map
  only for known official punctuation/article differences. Unmatched rows keep
  nullable UNTERM fields. Alternative considered: fail if every active resource
  row cannot be bridged, but the curated row universe includes territories and
  historical/special entries beyond the UNTERM membership-style list.
- Keep curated aliases in `alternativeNames` and official UN names in dedicated
  nullable fields. Alternative considered: append official names to aliases,
  but that would blur source authority and make user edits indistinguishable
  from official source data.

## Risks / Trade-offs

- UNTERM workbook format changes -> Validate required headers and minimum row
  count before using parsed names.
- M49 markup changes -> Validate minimum row count and required columns before
  returning bridge rows.
- Name matching gaps -> Keep rows valid with null UNTERM fields and cover known
  differences with direct tests.
- Extra refresh dependency -> Keep live refresh non-destructive; failures
  return the existing gateway error and leave the checked-in resource visible.
