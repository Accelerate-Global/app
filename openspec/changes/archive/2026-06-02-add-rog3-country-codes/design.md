## Context

ROG3 is a legacy geography code used in dataset field definitions. It is close
to GEC/FIPS 10-4, but the existing resource must keep FIPS because consumers may
need both the original legacy FIPS value and the ROG3 cross-reference. NGA/GNS
publishes a current GENC-to-GEC workbook, while HIS ROG documents ROG3 as a
GEC/FIPS-style country cross-reference. The app already has a validated refresh
pipeline for ISO OBP, UNTERM, UNSD M49, GENC, legacy FIPS, and the curated
overlay.

## Decisions

- Add `rog3` as a nullable field on each generated entry without renaming or
  removing `fips`.
- Use the NGA/GNS `GENC_ED3U24_GEC_XWALK.xlsx` workbook as the primary current
  machine-readable ROG3/GEC source.
- Preserve HIS ROG source URLs in resource metadata because HIS defines how the
  ROG cross-reference should be understood for this app.
- Keep legacy FIPS parsing and validation unchanged; it remains a separate
  source check for the existing `fips` field.
- Parse the NGA workbook with the existing zip/XML approach used for workbook
  parsing, avoiding a new Excel dependency.

## Source Merge

- Parse the NGA workbook's geopolitical-entity sheet into entries containing
  GENC3, GENC2, numeric code, names, and GEC/ROG3.
- Validate ROG3 entries for minimum count, unique codes where listed, valid
  `A-Z` two-character codes, and allowed source blanks such as `--`.
- Match ROG3 to curated rows by existing FIPS/ROG-style code first, normalized
  source names and curated aliases second, and unambiguous GENC/ISO3 only as a
  final fallback.
- Treat source blanks as meaningful blanks. Rows such as Caribbean Netherlands
  and Saint Martin (French part) keep FIPS values but may have null ROG3.
- Preserve curated exceptions when neither primary nor fallback source can
  safely reconcile a row.

## Risks

- Source workbook structure drift should fail refresh validation and leave the
  checked-in generated resource usable.
- ISO3 fallback can collapse split territories if used too early, so code and
  name matches must take precedence.
- Some official crosswalk rows intentionally use `--`; those should not be
  converted into app codes.
