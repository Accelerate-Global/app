## Context

ISO OBP remains the official ISO 3166-1 source and currently returns 249
officially assigned country entries. The curated Accelerate Global CSV has 273
columns because it includes inactive rows, no-ISO rows, duplicate ISO3 territory
rows, and non-official code values. NCI EVS publishes a public GENC terminology
text feed with about 280 geopolitical entries. FIPS 10-4 is deprecated, so FIPS
values are displayed as legacy codes and not treated as current official codes.

## Decisions

- Preserve the curated CSV as the canonical row universe. GENC-only rows are
  enrichment and validation data, not app rows.
- Preserve every curated row, including inactive rows and rows without ISO3.
- Keep the existing route and refresh API path for compatibility.
- Keep live refresh non-mutating in the deployed app; the local refresh script
  rewrites the generated JSON snapshot for commits.
- Classify reused, non-official, and legacy-only rows explicitly instead of
  dropping or silently normalizing them.

## Source Merge

- Parse the CSV as a transposed sheet keyed by row labels.
- Merge ISO by primary alpha-3 code and use ISO metadata only for canonical
  official rows when a primary code is duplicated.
- Merge GENC by primary alpha-3 code first, then display/alias name matches.
- Display the CSV FIPS value and use the deprecated FIPS registry as a legacy
  source check where available.

## Risks

- External source shape drift should fail validation and leave the generated
  snapshot visible in the UI.
- GENC and legacy FIPS names do not always match curated display names; matching
  must use codes first and normalized names/aliases as fallback.
