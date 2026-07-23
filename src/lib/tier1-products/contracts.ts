import { checksumProductValue } from "./canonical";
import type { SouthAsiaScopeContract } from "./types";

export const TIER1_PGIC_FIELD_KEYS = [
  "PG_AX_unique_PG_ID_PGIC",
  "PGIC",
  "AX_PGIC",
  "pgic",
] as const;
export const TIER1_ROP3_FIELD_KEYS = ["PG_ROP3", "ROP3", "PG_ROP_3", "RO3"] as const;
export const TIER1_ISO3_FIELD_KEYS = ["Geo_ISO3", "ISO3", "Country_ISO3", "ISO_3"] as const;
export const TIER1_WORKERS_POPULATION_PER_WORKER = 50_000;
export const AGGREGATE1_PERCENT_FIELDS = [
  "Christianity_Percent_All_Types",
  "Christianity_Percent_Evangelical",
] as const;
export const AGGREGATE1_PERCENT_DECIMAL_PLACES = 2;

export const SELF_ENGAGED_THRESHOLDS = Object.freeze({
  gsecMaximum: 2,
  believerMinimum: 50,
  evangelicalPercentMinimum: 0.05,
  alternateBelieverMinimum: 500,
  engagementPhaseMinimum: 6,
  independentlyEngagedPercentMinimum: 1,
});

export const WATCHLIST_THRESHOLDS = Object.freeze({
  imbGsecMaximum: 2,
  believerMaximumExclusive: 50,
  evangelicalPercentMaximumExclusive: 0.05,
  alternateBelieverMaximumExclusive: 500,
  evangelicalPercentHardMaximumExclusive: 1,
});

export const HOTSPOT_COUNTRY_LIMIT = 10;

export const SOUTH_ASIA_SCOPE_V1: SouthAsiaScopeContract = Object.freeze({
  version: "south-asia-v1",
  checksum: checksumProductValue({
    countries: ["Bangladesh", "India", "Maldives", "Nepal", "Pakistan", "Sri Lanka"],
    aliases: { pankistan: "pakistan", "sri-lanka": "sri lanka", srianka: "sri lanka" },
  }),
  canonicalCountries: ["Bangladesh", "India", "Maldives", "Nepal", "Pakistan", "Sri Lanka"],
  aliases: { pankistan: "pakistan", "sri-lanka": "sri lanka", srianka: "sri lanka" },
});

const commonNormalization = Object.freeze({
  text: "NFKC, trim, collapse whitespace",
  decimal: "strip commas and trailing percent sign; finite decimal only",
  boolean: "explicit true/false token lists; unknown is null",
  sourceAliases: { et: "etno", etn: "etno", im: "imb" },
});

const priorityBinding = Object.freeze({
  key: "tier1-field-priority-rules",
  fallbackOrder: ["jp", "imb", "ax", "etno", "wcd"],
  equalHighestPriorityValues: "blocking-error",
  missingFieldRule: "warning-once-per-field",
});

const publicationBindings = Object.freeze([
  "pipeline-release-set",
  "reference-resource-set",
  "ax-registry-revision",
]);

export const TIER1_PRODUCT_SEMANTIC_CONTRACTS = Object.freeze({
  "tier1-pgic-merge": {
    version: "tier1-pgic-merge-semantics-v1",
    grouping: { kind: "canonical-pgic", fields: TIER1_PGIC_FIELD_KEYS, missing: "blocking-error" },
    fieldAliases: { rop3: TIER1_ROP3_FIELD_KEYS, iso3: TIER1_ISO3_FIELD_KEYS },
    duplicateSourceBinding: "blocking-error",
    fieldSelection: priorityBinding,
    workersPopulationPerWorker: TIER1_WORKERS_POPULATION_PER_WORKER,
    normalization: commonNormalization,
    externalBindings: [...publicationBindings, priorityBinding.key],
  },
  "tier1-specific-pg-merge": {
    version: "tier1-specific-pg-merge-semantics-v1",
    grouping: {
      kind: "rop3-plus-iso3",
      rop3Fields: TIER1_ROP3_FIELD_KEYS,
      iso3Fields: TIER1_ISO3_FIELD_KEYS,
      incompleteKey: "retain-unmerged-with-warning",
    },
    duplicateSourceBinding: "blocking-error",
    fieldSelection: priorityBinding,
    workersPopulationPerWorker: TIER1_WORKERS_POPULATION_PER_WORKER,
    normalization: commonNormalization,
    externalBindings: [...publicationBindings, priorityBinding.key],
  },
  "aggregate1-pgac": {
    version: "aggregate1-pgac-semantics-v1",
    grouping: { kind: "rop3", blank: "exclude-with-warning" },
    population: { invalidOrNegative: "exclude-with-warning", operation: "sum" },
    country: { primary: "largest-population-then-source-index", alternates: "sorted-unique" },
    weightedPercentFields: AGGREGATE1_PERCENT_FIELDS,
    percentDecimalPlaces: AGGREGATE1_PERCENT_DECIMAL_PLACES,
    contributorOrder: ["jp", "imb", "ax", "etno", "wcd"],
    fieldSelection: priorityBinding,
    workersPopulationPerWorker: TIER1_WORKERS_POPULATION_PER_WORKER,
    externalBindings: ["tier1-specific-pg", priorityBinding.key],
  },
  "aggregate1-self-engaged": {
    version: "aggregate1-self-engaged-semantics-v1",
    thresholds: SELF_ENGAGED_THRESHOLDS,
    conditions: [
      "gsec-at-most-threshold",
      "frontier-is-false",
      "believers-at-least-minimum",
      "percent-or-believer-alternative",
      "eligible-phase-or-independent-percent",
    ],
    externalBindings: ["aggregate1-pgac"],
  },
  "aggregate1-watchlist": {
    version: "aggregate1-watchlist-semantics-v1",
    thresholds: WATCHLIST_THRESHOLDS,
    sourceQualifiedRules: { gsec: "apply-only-when-source-IMB", frontier: "apply-only-when-source-JP" },
    externalBindings: ["aggregate1-pgac"],
  },
  "aggregate1-baseline-uupg": {
    version: "aggregate1-baseline-uupg-semantics-v1",
    conditions: {
      globalEngagementAnywhere: false,
      frontier: "when-source-JP-require-true",
    },
    externalBindings: ["aggregate1-watchlist"],
  },
  "aggregate1-hotspots": {
    version: "aggregate1-hotspots-semantics-v1",
    countryLimit: HOTSPOT_COUNTRY_LIMIT,
    ranking: "population-descending-country-ascending",
    invalidPopulation: "exclude-from-country-total",
    externalBindings: ["aggregate1-baseline-uupg"],
  },
  "aggregate1-south-asia": {
    version: "aggregate1-south-asia-semantics-v1",
    scope: SOUTH_ASIA_SCOPE_V1,
    countrySeparators: ["/", ",", ";", "|"],
    normalization: "lowercase-and-collapse-nonalphanumeric",
    externalBindings: ["aggregate1-pgac", "south-asia-scope"],
  },
} as const);

export type Tier1ProductSemanticContractKey = keyof typeof TIER1_PRODUCT_SEMANTIC_CONTRACTS;

export function getTier1ProductSemanticContract(key: Tier1ProductSemanticContractKey) {
  return TIER1_PRODUCT_SEMANTIC_CONTRACTS[key];
}
