export const PRIVATE_DATA_CHAT_CATALOG_VERSION =
  "primary-people-groups-v1" as const;
export const PRIVATE_DATA_CHAT_DATASET_KEY = "primary_people_groups" as const;
export const PRIVATE_DATA_CHAT_VIEW =
  "analytics_ro.primary_people_groups" as const;

export const PRIVATE_DATA_CHAT_DIMENSION_KEYS = [
  "people_id",
  "people_name",
  "country",
  "gsec",
  "frontier_group",
  "engagement_phase",
  "globally_engaged",
] as const;

export const PRIVATE_DATA_CHAT_METRIC_KEYS = [
  "people_group_count",
  "total_population",
  "average_population",
  "average_percent_evangelical",
] as const;

export const PRIVATE_DATA_CHAT_FILTER_KEYS = [
  ...PRIVATE_DATA_CHAT_DIMENSION_KEYS,
  "population",
  "percent_evangelical",
] as const;

export type PrivateDataChatDimensionKey =
  (typeof PRIVATE_DATA_CHAT_DIMENSION_KEYS)[number];
export type PrivateDataChatMetricKey =
  (typeof PRIVATE_DATA_CHAT_METRIC_KEYS)[number];
export type PrivateDataChatFilterKey =
  (typeof PRIVATE_DATA_CHAT_FILTER_KEYS)[number];

type CatalogValueType = "text" | "number" | "boolean";

type CatalogField = {
  label: string;
  description: string;
  column: string;
  valueType: CatalogValueType;
};

type CatalogMetric = {
  label: string;
  description: string;
  expression: string;
};

export const PRIVATE_DATA_CHAT_FIELDS = Object.freeze({
  people_id: {
    label: "People ID",
    description: "Stable people-group identifier in the approved primary dataset.",
    column: "people_id",
    valueType: "text",
  },
  people_name: {
    label: "People name",
    description: "People-group display name.",
    column: "people_name",
    valueType: "text",
  },
  country: {
    label: "Country",
    description: "Canonical primary country name for the people group.",
    column: "country",
    valueType: "text",
  },
  gsec: {
    label: "GSEC",
    description: "Christianity GSEC classification when the source value is valid.",
    column: "gsec",
    valueType: "number",
  },
  frontier_group: {
    label: "Frontier group",
    description: "Whether the people group is classified as a frontier group.",
    column: "frontier_group",
    valueType: "boolean",
  },
  engagement_phase: {
    label: "Engagement phase",
    description: "Eight-phases engagement value when the source value is valid.",
    column: "engagement_phase",
    valueType: "number",
  },
  globally_engaged: {
    label: "Globally engaged",
    description: "Whether global engagement is recorded anywhere.",
    column: "globally_engaged",
    valueType: "boolean",
  },
  population: {
    label: "Population",
    description: "People-group population when the source value is valid.",
    column: "population",
    valueType: "number",
  },
  percent_evangelical: {
    label: "Percent evangelical",
    description: "Approved PGAC evangelical percentage when valid.",
    column: "percent_evangelical",
    valueType: "number",
  },
} satisfies Record<PrivateDataChatFilterKey, CatalogField>);

export const PRIVATE_DATA_CHAT_METRICS = Object.freeze({
  people_group_count: {
    label: "People-group count",
    description: "Count of matching people-group records.",
    expression: "count(*)::bigint",
  },
  total_population: {
    label: "Total population",
    description: "Sum of valid matching people-group population values.",
    expression: "coalesce(sum(p.population), 0)::numeric",
  },
  average_population: {
    label: "Average population",
    description: "Average of valid matching people-group population values.",
    expression: "avg(p.population)::numeric",
  },
  average_percent_evangelical: {
    label: "Average percent evangelical",
    description: "Average of valid matching PGAC evangelical percentages.",
    expression: "avg(p.percent_evangelical)::numeric",
  },
} satisfies Record<PrivateDataChatMetricKey, CatalogMetric>);

export const PRIVATE_DATA_CHAT_SYNONYMS = Object.freeze({
  "people groups": "people_group_count",
  "people-group count": "people_group_count",
  "total population": "total_population",
  "average population": "average_population",
  "percent evangelical": "average_percent_evangelical",
  nation: "country",
  nations: "country",
  "frontier groups": "frontier_group",
  "engagement anywhere": "globally_engaged",
} as const);

export const PRIVATE_DATA_CHAT_CATALOG = Object.freeze({
  version: PRIVATE_DATA_CHAT_CATALOG_VERSION,
  dataset: {
    key: PRIVATE_DATA_CHAT_DATASET_KEY,
    label: "Current primary people-groups dataset",
    view: PRIVATE_DATA_CHAT_VIEW,
  },
  fields: PRIVATE_DATA_CHAT_FIELDS,
  metrics: PRIVATE_DATA_CHAT_METRICS,
  synonyms: PRIVATE_DATA_CHAT_SYNONYMS,
});
