/**
 * Reviewed fallbacks for AX canonical display names that differ from the
 * Natural Earth 1:110m ADMIN name. ISO3 remains the preferred join key.
 */
export const DATASET_MAP_COUNTRY_NAME_ALIASES = {
  Bahamas: "BHS",
  "Brunei Darussalam": "BRN",
  Congo: "COG",
  Eswatini: "SWZ",
  Lao: "LAO",
  Serbia: "SRB",
  "Tanzania, the United Republic of": "TZA",
  "Timor-Leste": "TLS",
  "United Kingdom of Great Britain and Northern Ireland": "GBR",
} as const satisfies Readonly<Record<string, string>>;
