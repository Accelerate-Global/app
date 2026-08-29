import { createHash } from "node:crypto";

import {
  IMB_FIELD_CONTRACT,
  IMB_FIELD_CONTRACT_VERSION,
  type ImbFieldSemanticType,
} from "@/lib/imb-forming/field-contract";
import { COUNTRY_RESOURCE_KEY } from "@/lib/reference-resources/types";

export const PRIVATE_DATA_CHAT_CATALOG_SCHEMA_VERSION = 2 as const;
export const PRIVATE_DATA_CHAT_CATALOG_CHECKSUM =
  "ac1c90c20f2dce52e95307a857ba66273e3a0d6699402326b6a40fce74ac59a6" as const;
export const PRIVATE_DATA_CHAT_CATALOG_VERSION =
  "primary-people-groups-v2.ac1c90c20f2d" as const;
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
export const PRIVATE_DATA_CHAT_RECORD_FIELD_KEYS = [
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
export type PrivateDataChatRecordFieldKey =
  (typeof PRIVATE_DATA_CHAT_RECORD_FIELD_KEYS)[number];
export type PrivateDataChatSelectedKey =
  | PrivateDataChatRecordFieldKey
  | PrivateDataChatMetricKey;

type CatalogValueType = "text" | "number" | "boolean";
type CatalogFieldUse = "dimension" | "filter" | "record";
type CatalogFilterOperator =
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "in";
type CatalogSensitivity = "private-internal";

type CatalogValueDomain =
  | Readonly<{ kind: "open" }>
  | Readonly<{ kind: "boolean"; values: readonly [true, false] }>
  | Readonly<{
      kind: "reference";
      resourceKey: typeof COUNTRY_RESOURCE_KEY;
      matching: "exact-accent-punctuation-insensitive";
      acceptedIdentifiers: readonly [
        "display-name",
        "approved-alias",
        "alpha-2",
        "alpha-3",
        "fips",
        "rog3",
      ];
    }>;

type CatalogSourceContract = Readonly<{
  contractKey: "imb-field-contract";
  contractVersion: typeof IMB_FIELD_CONTRACT_VERSION;
  outputField: string;
  semanticType: ImbFieldSemanticType;
}>;

type CatalogField = Readonly<{
  label: string;
  description: string;
  aliases: readonly string[];
  column: string;
  valueType: CatalogValueType;
  unit: string;
  nullable: boolean;
  nullMeaning: string;
  uses: readonly CatalogFieldUse[];
  operators: readonly CatalogFilterOperator[];
  valueDomain: CatalogValueDomain;
  sensitivity: CatalogSensitivity;
  provenance: Readonly<{
    canonicalFieldDefinitionKeys: readonly string[];
    sourceContracts: readonly CatalogSourceContract[];
  }>;
}>;

type CatalogMetric = Readonly<{
  label: string;
  description: string;
  aliases: readonly string[];
  semanticFormula: string;
  expression: string;
  unit: string;
  nullable: boolean;
  nullMeaning: string;
  compatibleDimensions: readonly PrivateDataChatDimensionKey[];
  dependencies: readonly PrivateDataChatFilterKey[];
  sensitivity: CatalogSensitivity;
}>;

const textOperators = ["eq", "neq", "in"] as const;
const numberOperators = [
  "eq",
  "neq",
  "lt",
  "lte",
  "gt",
  "gte",
  "in",
] as const;
const booleanOperators = ["eq", "neq", "in"] as const;
const openValueDomain = Object.freeze({ kind: "open" } as const);
const booleanValueDomain = Object.freeze({
  kind: "boolean",
  values: [true, false],
} as const);
const allMetricDimensions = [...PRIVATE_DATA_CHAT_DIMENSION_KEYS] as const;

function imbSourceContract(
  outputField: string,
  semanticType: ImbFieldSemanticType,
): CatalogSourceContract {
  return {
    contractKey: "imb-field-contract",
    contractVersion: IMB_FIELD_CONTRACT_VERSION,
    outputField,
    semanticType,
  };
}

export const PRIVATE_DATA_CHAT_FIELDS = Object.freeze({
  people_id: {
    label: "People ID",
    description:
      "Stable identifier for one people-group record in the approved current primary dataset.",
    aliases: ["people identifier", "people group id", "peid"],
    column: "people_id",
    valueType: "text",
    unit: "identifier",
    nullable: true,
    nullMeaning: "No valid approved people-group identifier was present.",
    uses: ["dimension", "filter", "record"],
    operators: textOperators,
    valueDomain: openValueDomain,
    sensitivity: "private-internal",
    provenance: {
      canonicalFieldDefinitionKeys: ["pg_peopleid1", "pg_peopleid3", "pg_peid"],
      sourceContracts: [imbSourceContract("PG_PEID", "identifier")],
    },
  },
  people_name: {
    label: "People name",
    description: "Approved display name for a people group.",
    aliases: ["people group", "people group name", "group name"],
    column: "people_name",
    valueType: "text",
    unit: "name",
    nullable: true,
    nullMeaning: "No valid approved display name was present.",
    uses: ["dimension", "filter", "record"],
    operators: textOperators,
    valueDomain: openValueDomain,
    sensitivity: "private-internal",
    provenance: {
      canonicalFieldDefinitionKeys: ["people_name", "pg_name_main"],
      sourceContracts: [imbSourceContract("PG_Name_Main", "string")],
    },
  },
  country: {
    label: "Country",
    description:
      "Canonical primary country name assigned to the people-group record; this is not a macro region or continent.",
    aliases: ["nation", "primary country", "country name"],
    column: "country",
    valueType: "text",
    unit: "country name",
    nullable: true,
    nullMeaning: "No valid primary country was present.",
    uses: ["dimension", "filter", "record"],
    operators: textOperators,
    valueDomain: {
      kind: "reference",
      resourceKey: COUNTRY_RESOURCE_KEY,
      matching: "exact-accent-punctuation-insensitive",
      acceptedIdentifiers: [
        "display-name",
        "approved-alias",
        "alpha-2",
        "alpha-3",
        "fips",
        "rog3",
      ],
    },
    sensitivity: "private-internal",
    provenance: {
      canonicalFieldDefinitionKeys: ["geo_country_name"],
      sourceContracts: [imbSourceContract("Geo_Country_Name", "string")],
    },
  },
  gsec: {
    label: "GSEC",
    description:
      "Numeric Christianity GSEC classification from approved source-priority selection when the stored value is valid.",
    aliases: ["christianity gsec", "global status estimate"],
    column: "gsec",
    valueType: "number",
    unit: "classification code",
    nullable: true,
    nullMeaning: "The GSEC source value was missing or not a valid number.",
    uses: ["dimension", "filter", "record"],
    operators: numberOperators,
    valueDomain: openValueDomain,
    sensitivity: "private-internal",
    provenance: {
      canonicalFieldDefinitionKeys: ["christianity_gsec"],
      sourceContracts: [imbSourceContract("Christianity_GSEC", "integer")],
    },
  },
  frontier_group: {
    label: "Frontier group",
    description: "Whether the people group is classified as a frontier group.",
    aliases: ["frontier", "frontier people group", "frontier status"],
    column: "frontier_group",
    valueType: "boolean",
    unit: "boolean",
    nullable: true,
    nullMeaning: "Frontier-group status was missing or not a valid boolean.",
    uses: ["dimension", "filter", "record"],
    operators: booleanOperators,
    valueDomain: booleanValueDomain,
    sensitivity: "private-internal",
    provenance: {
      canonicalFieldDefinitionKeys: ["christianity_frontier_group"],
      sourceContracts: [],
    },
  },
  engagement_phase: {
    label: "Engagement phase",
    description:
      "Numeric value from the approved eight-phases-of-engagement field when the stored value is valid.",
    aliases: ["engagement stage", "eight phases", "8 phases of engagement"],
    column: "engagement_phase",
    valueType: "number",
    unit: "phase code",
    nullable: true,
    nullMeaning: "The engagement-phase source value was missing or not a valid number.",
    uses: ["dimension", "filter", "record"],
    operators: numberOperators,
    valueDomain: openValueDomain,
    sensitivity: "private-internal",
    provenance: {
      canonicalFieldDefinitionKeys: ["engage_8_phases_of_engagement"],
      sourceContracts: [],
    },
  },
  globally_engaged: {
    label: "Globally engaged",
    description:
      "Whether global engagement is recorded anywhere for the people group.",
    aliases: [
      "engaged anywhere",
      "global engagement",
      "globally engaged anywhere",
    ],
    column: "globally_engaged",
    valueType: "boolean",
    unit: "boolean",
    nullable: true,
    nullMeaning: "Global-engagement status was missing or not a valid boolean.",
    uses: ["dimension", "filter", "record"],
    operators: booleanOperators,
    valueDomain: booleanValueDomain,
    sensitivity: "private-internal",
    provenance: {
      canonicalFieldDefinitionKeys: ["engage_global_engagement_anywhere"],
      sourceContracts: [
        imbSourceContract("Engage_Global_Engagement_Anywhere", "boolean"),
      ],
    },
  },
  population: {
    label: "Population",
    description:
      "People-group population from the approved current record when the stored value is valid.",
    aliases: [
      "people group population",
      "population estimate",
      "number of people",
    ],
    column: "population",
    valueType: "number",
    unit: "people",
    nullable: true,
    nullMeaning: "The population source value was missing or not a valid number.",
    uses: ["filter", "record"],
    operators: numberOperators,
    valueDomain: openValueDomain,
    sensitivity: "private-internal",
    provenance: {
      canonicalFieldDefinitionKeys: ["pg_population"],
      sourceContracts: [imbSourceContract("PG_Population", "integer")],
    },
  },
  percent_evangelical: {
    label: "Percent evangelical",
    description:
      "Approved PGAC evangelical percentage for the people-group record when the stored value is valid.",
    aliases: [
      "evangelical percent",
      "evangelical percentage",
      "percent evangelical pgac",
    ],
    column: "percent_evangelical",
    valueType: "number",
    unit: "percentage points",
    nullable: true,
    nullMeaning:
      "The approved evangelical-percentage source value was missing or not a valid number; null is not zero.",
    uses: ["filter", "record"],
    operators: numberOperators,
    valueDomain: openValueDomain,
    sensitivity: "private-internal",
    provenance: {
      canonicalFieldDefinitionKeys: ["percent_evangelical_pgac"],
      sourceContracts: [],
    },
  },
} satisfies Record<PrivateDataChatFilterKey, CatalogField>);

export const PRIVATE_DATA_CHAT_METRICS = Object.freeze({
  people_group_count: {
    label: "People-group count",
    description: "Count of matching people-group records at the dataset grain.",
    aliases: ["people groups", "number of people groups", "group count"],
    semanticFormula: "Count one row for each matching current people-group record.",
    expression: "count(*)::bigint",
    unit: "people groups",
    nullable: false,
    nullMeaning: "The count is zero when no records match.",
    compatibleDimensions: allMetricDimensions,
    dependencies: [],
    sensitivity: "private-internal",
  },
  total_population: {
    label: "Total population",
    description: "Sum of valid matching people-group population values.",
    aliases: ["population total", "combined population", "sum of population"],
    semanticFormula:
      "Sum valid population values for matching records; missing or invalid population values do not contribute.",
    expression: "coalesce(sum(p.population), 0)::numeric",
    unit: "people",
    nullable: false,
    nullMeaning: "The total is zero when no valid population values contribute.",
    compatibleDimensions: allMetricDimensions,
    dependencies: ["population"],
    sensitivity: "private-internal",
  },
  average_population: {
    label: "Average population",
    description: "Average of valid matching people-group population values.",
    aliases: ["mean population", "population average"],
    semanticFormula:
      "Average valid population values across matching records; missing or invalid values are excluded.",
    expression: "avg(p.population)::numeric",
    unit: "people per people group",
    nullable: true,
    nullMeaning: "The average is null when no valid population value contributes.",
    compatibleDimensions: allMetricDimensions,
    dependencies: ["population"],
    sensitivity: "private-internal",
  },
  average_percent_evangelical: {
    label: "Average percent evangelical",
    description:
      "Unweighted average of valid approved PGAC evangelical percentages across matching people-group records.",
    aliases: ["average evangelical percentage", "mean percent evangelical"],
    semanticFormula:
      "Average valid record-level PGAC percentage values without population weighting; missing or invalid values are excluded.",
    expression: "avg(p.percent_evangelical)::numeric",
    unit: "percentage points",
    nullable: true,
    nullMeaning: "The average is null when no valid percentage value contributes.",
    compatibleDimensions: allMetricDimensions,
    dependencies: ["percent_evangelical"],
    sensitivity: "private-internal",
  },
} satisfies Record<PrivateDataChatMetricKey, CatalogMetric>);

const PRIVATE_DATA_CHAT_CATALOG_CONTENT = Object.freeze({
  schemaVersion: PRIVATE_DATA_CHAT_CATALOG_SCHEMA_VERSION,
  dataset: {
    key: PRIVATE_DATA_CHAT_DATASET_KEY,
    label: "Current primary people-groups dataset",
    description:
      "The one approved current primary PGAC people-groups projection available to private data chat.",
    grain: {
      description: "One row per current primary people-group record.",
      keys: ["people_id"],
    },
    sensitivity: "private-internal",
    provenance: {
      projection: "approved-current-primary-people-groups",
      canonicalMetadata: [
        "field_definitions",
        "imb-field-contract-v2",
        COUNTRY_RESOURCE_KEY,
      ],
    },
    freshness: {
      kind: "query-provenance",
      description:
        "Each answer reports the current dataset-version creation timestamp returned by the approved projection.",
    },
    view: PRIVATE_DATA_CHAT_VIEW,
  },
  fields: PRIVATE_DATA_CHAT_FIELDS,
  metrics: PRIVATE_DATA_CHAT_METRICS,
  joinCapabilities: [] as const,
});

export function calculatePrivateDataChatCatalogChecksum() {
  return createHash("sha256")
    .update(JSON.stringify(PRIVATE_DATA_CHAT_CATALOG_CONTENT))
    .digest("hex");
}

function buildSynonyms() {
  const entries: Array<
    [string, PrivateDataChatFilterKey | PrivateDataChatMetricKey]
  > = [];

  for (const key of PRIVATE_DATA_CHAT_FILTER_KEYS) {
    for (const alias of PRIVATE_DATA_CHAT_FIELDS[key].aliases) {
      entries.push([alias, key]);
    }
  }

  for (const key of PRIVATE_DATA_CHAT_METRIC_KEYS) {
    for (const alias of PRIVATE_DATA_CHAT_METRICS[key].aliases) {
      entries.push([alias, key]);
    }
  }

  return Object.freeze(Object.fromEntries(entries));
}

export const PRIVATE_DATA_CHAT_SYNONYMS = buildSynonyms();

export const PRIVATE_DATA_CHAT_CATALOG = Object.freeze({
  ...PRIVATE_DATA_CHAT_CATALOG_CONTENT,
  version: PRIVATE_DATA_CHAT_CATALOG_VERSION,
  checksum: PRIVATE_DATA_CHAT_CATALOG_CHECKSUM,
  synonyms: PRIVATE_DATA_CHAT_SYNONYMS,
});

function valueTypeAcceptsSourceType(
  valueType: CatalogValueType,
  semanticType: ImbFieldSemanticType,
) {
  if (valueType === "text") {
    return semanticType === "string" || semanticType === "identifier";
  }
  if (valueType === "number") {
    return semanticType === "integer" || semanticType === "double";
  }
  return semanticType === "boolean";
}

export function getPrivateDataChatCatalogReconciliationFindings() {
  const findings: string[] = [];
  const aliases = new Map<string, string>();

  for (const key of PRIVATE_DATA_CHAT_FILTER_KEYS) {
    const field = PRIVATE_DATA_CHAT_FIELDS[key];

    if (!field.provenance.canonicalFieldDefinitionKeys.length) {
      findings.push(`${key} has no canonical field-definition provenance.`);
    }

    for (const source of field.provenance.sourceContracts) {
      const contractField = IMB_FIELD_CONTRACT.find(
        (entry) => entry.outputField === source.outputField,
      );
      if (!contractField) {
        findings.push(`${key} cites missing IMB contract field ${source.outputField}.`);
        continue;
      }
      if (
        contractField.type !== source.semanticType ||
        !valueTypeAcceptsSourceType(field.valueType, contractField.type)
      ) {
        findings.push(
          `${key} is incompatible with IMB contract field ${source.outputField}.`,
        );
      }
    }

    for (const alias of field.aliases) {
      const normalized = alias.trim().toLocaleLowerCase();
      const previous = aliases.get(normalized);
      if (previous && previous !== key) {
        findings.push(`Alias ${alias} is assigned to both ${previous} and ${key}.`);
      }
      aliases.set(normalized, key);
    }
  }

  for (const key of PRIVATE_DATA_CHAT_DIMENSION_KEYS) {
    if (!PRIVATE_DATA_CHAT_FIELDS[key].uses.includes("dimension")) {
      findings.push(`${key} is listed as a dimension without dimension use.`);
    }
  }

  for (const key of PRIVATE_DATA_CHAT_METRIC_KEYS) {
    const metric = PRIVATE_DATA_CHAT_METRICS[key];
    for (const dimension of metric.compatibleDimensions) {
      if (
        !(PRIVATE_DATA_CHAT_DIMENSION_KEYS as readonly string[]).includes(
          dimension,
        )
      ) {
        findings.push(`${key} cites unknown compatible dimension ${dimension}.`);
      }
    }
    for (const dependency of metric.dependencies) {
      if (
        !(PRIVATE_DATA_CHAT_FILTER_KEYS as readonly string[]).includes(
          dependency,
        )
      ) {
        findings.push(`${key} cites unknown dependency ${dependency}.`);
      }
    }
    for (const alias of metric.aliases) {
      const normalized = alias.trim().toLocaleLowerCase();
      const previous = aliases.get(normalized);
      if (previous && previous !== key) {
        findings.push(`Alias ${alias} is assigned to both ${previous} and ${key}.`);
      }
      aliases.set(normalized, key);
    }
  }

  return findings;
}

function renderValueDomain(domain: CatalogValueDomain) {
  if (domain.kind === "boolean") return "allowed values true or false";
  if (domain.kind === "reference") {
    return `approved ${domain.resourceKey} names, aliases, and codes; the application resolves exact normalized values and asks when a match is ambiguous`;
  }
  return "open typed values; do not invent or fuzzy-match values";
}

export function buildPrivateDataChatPlannerCatalogContext() {
  const dataset = PRIVATE_DATA_CHAT_CATALOG.dataset;
  const fields = PRIVATE_DATA_CHAT_FILTER_KEYS.map((key) => {
    const field = PRIVATE_DATA_CHAT_FIELDS[key];
    return `- ${key} — ${field.label}: ${field.description} Type=${field.valueType}; unit=${field.unit}; uses=${field.uses.join(",")}; operators=${field.operators.join(",")}; null=${field.nullMeaning}; aliases=${field.aliases.join(" | ")}; values=${renderValueDomain(field.valueDomain)}.`;
  });
  const metrics = PRIVATE_DATA_CHAT_METRIC_KEYS.map((key) => {
    const metric = PRIVATE_DATA_CHAT_METRICS[key];
    return `- ${key} — ${metric.label}: ${metric.description} Formula=${metric.semanticFormula}; unit=${metric.unit}; null=${metric.nullMeaning}; aliases=${metric.aliases.join(" | ")}; groupable by=${metric.compatibleDimensions.join(",")}.`;
  });

  return [
    `Catalog revision: ${PRIVATE_DATA_CHAT_CATALOG.version}`,
    `Catalog checksum: ${PRIVATE_DATA_CHAT_CATALOG.checksum}`,
    `Dataset ${dataset.key} — ${dataset.label}: ${dataset.description}`,
    `Grain: ${dataset.grain.description}`,
    `Freshness: ${dataset.freshness.description}`,
    "Approved fields:",
    ...fields,
    "Approved metrics:",
    ...metrics,
    "Approved joins: none. Macro region, continent, time series, and cross-dataset relationships are unavailable.",
  ].join("\n");
}

export type PrivateDataChatAnswerSemanticContext = Readonly<{
  catalogVersion: typeof PRIVATE_DATA_CHAT_CATALOG_VERSION;
  dataset: Readonly<{
    key: typeof PRIVATE_DATA_CHAT_DATASET_KEY;
    label: string;
    grain: string;
    freshness: string;
  }>;
  concepts: readonly Readonly<{
    key: PrivateDataChatSelectedKey;
    kind: "field" | "metric";
    label: string;
    description: string;
    unit: string;
    nullMeaning: string;
    semanticFormula?: string;
  }>[];
}>;

export function getPrivateDataChatAnswerSemanticContext(
  selectedKeys: readonly string[],
): PrivateDataChatAnswerSemanticContext {
  const seen = new Set<string>();
  const concepts: PrivateDataChatAnswerSemanticContext["concepts"][number][] = [];

  for (const key of selectedKeys) {
    if (seen.has(key)) continue;
    seen.add(key);

    if ((PRIVATE_DATA_CHAT_RECORD_FIELD_KEYS as readonly string[]).includes(key)) {
      const recordField = key as PrivateDataChatRecordFieldKey;
      const field = PRIVATE_DATA_CHAT_FIELDS[recordField];
      concepts.push({
        key: recordField,
        kind: "field",
        label: field.label,
        description: field.description,
        unit: field.unit,
        nullMeaning: field.nullMeaning,
      });
      continue;
    }

    if ((PRIVATE_DATA_CHAT_METRIC_KEYS as readonly string[]).includes(key)) {
      const metricKey = key as PrivateDataChatMetricKey;
      const metric = PRIVATE_DATA_CHAT_METRICS[metricKey];
      concepts.push({
        key: metricKey,
        kind: "metric",
        label: metric.label,
        description: metric.description,
        unit: metric.unit,
        nullMeaning: metric.nullMeaning,
        semanticFormula: metric.semanticFormula,
      });
    }
  }

  return {
    catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
    dataset: {
      key: PRIVATE_DATA_CHAT_DATASET_KEY,
      label: PRIVATE_DATA_CHAT_CATALOG.dataset.label,
      grain: PRIVATE_DATA_CHAT_CATALOG.dataset.grain.description,
      freshness: PRIVATE_DATA_CHAT_CATALOG.dataset.freshness.description,
    },
    concepts,
  };
}
