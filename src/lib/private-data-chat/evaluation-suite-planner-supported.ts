import {
  PRIVATE_DATA_CHAT_CATALOG_VERSION,
  PRIVATE_DATA_CHAT_DATASET_KEY,
  type PrivateDataChatDimensionKey,
  type PrivateDataChatMetricKey,
  type PrivateDataChatRecordFieldKey,
} from "@/lib/private-data-chat/catalog";
import { plannerQueryCase } from "@/lib/private-data-chat/evaluation-suite-planner-helpers";
import type {
  PrivateDataChatPlannerEvaluationCase,
  PrivateDataChatEvaluationTier,
} from "@/lib/private-data-chat/evaluation-suite-types";
import type {
  PrivateDataChatFilter,
  PrivateDataChatQuery,
} from "@/lib/private-data-chat/schemas";

type AggregateQuery = Extract<PrivateDataChatQuery, { mode: "aggregate" }>;
type RecordsQuery = Extract<PrivateDataChatQuery, { mode: "records" }>;

function aggregateQuery(
  input: Omit<AggregateQuery, "catalogVersion" | "dataset" | "mode">,
): AggregateQuery {
  return {
    catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
    dataset: PRIVATE_DATA_CHAT_DATASET_KEY,
    mode: "aggregate",
    ...input,
  };
}

function recordsQuery(
  input: Omit<RecordsQuery, "catalogVersion" | "dataset" | "mode">,
): RecordsQuery {
  return {
    catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
    dataset: PRIVATE_DATA_CHAT_DATASET_KEY,
    mode: "records",
    ...input,
  };
}

const metricFamilies: readonly Readonly<{
  metric: PrivateDataChatMetricKey;
  prompts: readonly string[];
}>[] = [
  {
    metric: "people_group_count",
    prompts: [
      "How many people-group records are in the approved current dataset?",
      "Give me the current number of people groups.",
      "What is the record count for the primary people-groups data?",
      "Count every people group in the present approved projection.",
      "Tell me the total count of people-group records, not their population.",
      "How many rows of people groups are available to this chat?",
    ],
  },
  {
    metric: "total_population",
    prompts: [
      "What is the total recorded population across all people groups?",
      "Add up the valid people-group population values.",
      "Give me the population sum for the current primary dataset.",
      "How many people are represented by the dataset-wide population sum?",
      "Calculate total population, ignoring missing population values.",
      "Report the dataset-wide population total in people.",
    ],
  },
  {
    metric: "average_population",
    prompts: [
      "What is the average recorded population per people group?",
      "Compute the mean of valid population values.",
      "Give me average people-group population, excluding missing values.",
      "What is the unweighted average recorded population across people groups?",
      "Report mean population in people.",
      "On average, how large is a people group by recorded population?",
    ],
  },
  {
    metric: "average_percent_evangelical",
    prompts: [
      "What is the average percent evangelical across valid records?",
      "Compute the unweighted mean evangelical percentage.",
      "Give me the average valid percent evangelical.",
      "What is the dataset-wide mean of recorded evangelical percentages?",
      "Report the approved unweighted average evangelical percentage.",
      "On average, what evangelical percentage is recorded?",
    ],
  },
];

const metricCases = metricFamilies.flatMap((family) =>
  family.prompts.map((question, index) =>
    plannerQueryCase({
      id: `v4-metric-${family.metric.replaceAll("_", "-")}-${String(index + 1).padStart(2, "0")}`,
      tier: index < 3 ? "core" : "extended",
      capability: "metric-selection",
      rationale: `Distinguish ${family.metric} from the other approved aggregate meanings across natural paraphrases.`,
      tags: ["aggregate", family.metric, "paraphrase"],
      question,
      reason: `Use the approved ${family.metric} metric over the full current dataset.`,
      query: aggregateQuery({
        metrics: [family.metric],
        dimensions: [],
        filters: [],
        sort: [],
        limit: 1,
      }),
      selectedKeys: [family.metric],
      parameters: [1],
    }),
  ),
);

const groupedDefinitions: readonly Readonly<{
  id: string;
  metric: PrivateDataChatMetricKey;
  dimension: PrivateDataChatDimensionKey;
  question: string;
  limit: number;
  sort?: readonly { field: PrivateDataChatMetricKey; direction: "asc" | "desc" }[];
}>[] = [
  { id: "count-country", metric: "people_group_count", dimension: "country", question: "Count people groups by country for up to 100 countries.", limit: 100 },
  { id: "count-frontier", metric: "people_group_count", dimension: "frontier_group", question: "How many people groups fall under each frontier status?", limit: 100 },
  { id: "count-engaged", metric: "people_group_count", dimension: "globally_engaged", question: "Show people-group count by global engagement status.", limit: 100 },
  { id: "count-phase", metric: "people_group_count", dimension: "engagement_phase", question: "Count people groups in each engagement phase.", limit: 100 },
  { id: "count-people-id", metric: "people_group_count", dimension: "people_id", question: "Count records by people ID for up to 100 identifiers.", limit: 100 },
  { id: "count-people-name", metric: "people_group_count", dimension: "people_name", question: "Count records by people-group name for up to 100 names.", limit: 100 },
  { id: "population-country", metric: "total_population", dimension: "country", question: "Show total population by country, highest total first, for 50 countries.", limit: 50, sort: [{ field: "total_population", direction: "desc" }] },
  { id: "population-frontier", metric: "total_population", dimension: "frontier_group", question: "Sum population for each frontier status.", limit: 100 },
  { id: "population-engaged", metric: "total_population", dimension: "globally_engaged", question: "Give total population by global engagement status.", limit: 100 },
  { id: "population-gsec", metric: "total_population", dimension: "gsec", question: "Total recorded population by GSEC classification, up to 100 groups.", limit: 100 },
  { id: "average-population-country", metric: "average_population", dimension: "country", question: "Show average people-group population by country, largest average first, for 25 countries.", limit: 25, sort: [{ field: "average_population", direction: "desc" }] },
  { id: "average-population-frontier", metric: "average_population", dimension: "frontier_group", question: "What is average valid population for each frontier status?", limit: 100 },
  { id: "average-population-engaged", metric: "average_population", dimension: "globally_engaged", question: "Compare average population by global engagement status.", limit: 100 },
  { id: "average-population-phase", metric: "average_population", dimension: "engagement_phase", question: "Average people-group population by engagement phase, up to 100 phases.", limit: 100 },
  { id: "average-evangelical-country", metric: "average_percent_evangelical", dimension: "country", question: "Show average evangelical percentage by country, highest first, for 25 countries.", limit: 25, sort: [{ field: "average_percent_evangelical", direction: "desc" }] },
  { id: "average-evangelical-frontier", metric: "average_percent_evangelical", dimension: "frontier_group", question: "Average valid evangelical percentage for each frontier status.", limit: 100 },
  { id: "average-evangelical-engaged", metric: "average_percent_evangelical", dimension: "globally_engaged", question: "Compare mean evangelical percentage by global engagement status.", limit: 100 },
  { id: "average-evangelical-gsec", metric: "average_percent_evangelical", dimension: "gsec", question: "Give average evangelical percentage by GSEC classification, up to 100 classifications.", limit: 100 },
];

const groupedCases = groupedDefinitions.map((definition, index) =>
  plannerQueryCase({
    id: `v4-group-${definition.id}`,
    tier: index % 2 === 0 ? "core" : "extended",
    capability: "grouping",
    rationale: `Verify ${definition.metric} can be grouped by the compatible ${definition.dimension} dimension without substituting another grain.`,
    tags: ["aggregate", "grouping", definition.metric, definition.dimension],
    question: definition.question,
    reason: `Group ${definition.metric} by ${definition.dimension}.`,
    query: aggregateQuery({
      metrics: [definition.metric],
      dimensions: [definition.dimension],
      filters: [],
      sort: definition.sort ? [...definition.sort] : [],
      limit: definition.limit,
    }),
    selectedKeys: [definition.dimension, definition.metric],
    parameters: [definition.limit],
  }),
);

const recordFields: readonly Readonly<{
  field: PrivateDataChatRecordFieldKey;
  label: string;
}>[] = [
  { field: "people_id", label: "people IDs" },
  { field: "people_name", label: "people-group names" },
  { field: "country", label: "country names" },
  { field: "gsec", label: "GSEC classifications" },
  { field: "frontier_group", label: "frontier statuses" },
  { field: "engagement_phase", label: "engagement phases" },
  { field: "globally_engaged", label: "global engagement statuses" },
  { field: "population", label: "population values" },
  { field: "percent_evangelical", label: "evangelical percentage values" },
];

const recordProjectionCases = recordFields.flatMap(({ field, label }) => [
  plannerQueryCase({
    id: `v4-record-${field.replaceAll("_", "-")}-bounded`,
    tier: "core",
    capability: "record-projection",
    rationale: `Select the approved ${field} record field without adding unrequested fields.`,
    tags: ["records", field, "projection"],
    question: `Show 10 ${label} from the current dataset.`,
    reason: `Return a bounded list containing only ${field}.`,
    query: recordsQuery({
      fields: [field],
      filters: [],
      sort: [],
      limit: 10,
    }),
    selectedKeys: [field],
    parameters: [10],
  }),
  plannerQueryCase({
    id: `v4-record-${field.replaceAll("_", "-")}-sorted`,
    tier: "extended",
    capability: "record-projection",
    rationale: `Keep the selected ${field} available when it is also the explicit stable sort field.`,
    tags: ["records", field, "sort"],
    question: `List 25 ${label}, ordered ascending by ${label}.`,
    reason: `Select and sort the bounded ${field} values in ascending order.`,
    query: recordsQuery({
      fields: [field],
      filters: [],
      sort: [{ field, direction: "asc" }],
      limit: 25,
    }),
    selectedKeys: [field],
    parameters: [25],
  }),
]);

type TextFilterDefinition = Readonly<{
  field: "people_id" | "people_name" | "country";
  label: string;
  scalar: string;
  alternate: string;
}>;

const textFilterDefinitions: readonly TextFilterDefinition[] = [
  { field: "people_id", label: "people ID", scalar: "SYNTH-001", alternate: "SYNTH-002" },
  { field: "people_name", label: "people name", scalar: "Synthetic Alpha", alternate: "Synthetic Beta" },
  { field: "country", label: "country", scalar: "Thailand", alternate: "Nepal" },
];

const textFilterCases = textFilterDefinitions.flatMap((definition) => {
  const cases: readonly Readonly<{
    suffix: string;
    tier: PrivateDataChatEvaluationTier;
    question: string;
    filter: PrivateDataChatFilter;
    parameter?: string | readonly string[];
  }>[] = [
    { suffix: "eq", tier: "core", question: `Count records where ${definition.label} equals ${definition.scalar}.`, filter: { field: definition.field, operator: "eq", value: definition.scalar }, parameter: definition.scalar },
    { suffix: "neq", tier: "core", question: `Count records where ${definition.label} is not ${definition.scalar}.`, filter: { field: definition.field, operator: "neq", value: definition.scalar }, parameter: definition.scalar },
    { suffix: "in", tier: "core", question: `Count records where ${definition.label} is either ${definition.scalar} or ${definition.alternate}.`, filter: { field: definition.field, operator: "in", value: [definition.scalar, definition.alternate] }, parameter: [definition.scalar, definition.alternate] },
    { suffix: "missing", tier: "extended", question: `Count records with no valid ${definition.label}.`, filter: { field: definition.field, operator: "eq", value: null } },
    { suffix: "present", tier: "extended", question: `Count records with a valid ${definition.label}.`, filter: { field: definition.field, operator: "neq", value: null } },
  ];

  return cases.map((entry) =>
    plannerQueryCase({
      id: `v4-filter-${definition.field.replaceAll("_", "-")}-${entry.suffix}`,
      tier: entry.tier,
      capability: entry.suffix === "missing" || entry.suffix === "present" ? "null-and-zero" : "filter-operator",
      rationale: `Exercise the ${entry.filter.operator} operator and nullable semantics for the text field ${definition.field}.`,
      tags: ["filter", definition.field, entry.filter.operator],
      question: entry.question,
      reason: `Count records using the approved ${definition.field} ${entry.filter.operator} filter.`,
      query: aggregateQuery({
        metrics: ["people_group_count"],
        dimensions: [],
        filters: [entry.filter],
        sort: [],
        limit: 1,
      }),
      selectedKeys: ["people_group_count"],
      parameters: entry.parameter === undefined ? [1] : [entry.parameter, 1],
    }),
  );
});

type NumberFilterDefinition = Readonly<{
  field: "gsec" | "engagement_phase" | "population" | "percent_evangelical";
  label: string;
  scalar: number;
  values: readonly number[];
}>;

const numberFilterDefinitions: readonly NumberFilterDefinition[] = [
  { field: "gsec", label: "GSEC classification", scalar: 3, values: [1, 3, 5] },
  { field: "engagement_phase", label: "engagement phase", scalar: 4, values: [1, 4, 8] },
  { field: "population", label: "recorded population", scalar: 100_000, values: [1_000, 10_000, 100_000] },
  { field: "percent_evangelical", label: "percent evangelical", scalar: 2.5, values: [0, 2.5, 10] },
];

const numberFilterCases = numberFilterDefinitions.flatMap((definition) => {
  const cases: readonly Readonly<{
    suffix: string;
    tier: PrivateDataChatEvaluationTier;
    question: string;
    filter: PrivateDataChatFilter;
    parameter?: number | readonly number[];
  }>[] = [
    { suffix: "eq", tier: "core", question: `Count people groups with ${definition.label} exactly ${definition.scalar}.`, filter: { field: definition.field, operator: "eq", value: definition.scalar }, parameter: definition.scalar },
    { suffix: "neq", tier: "core", question: `Count people groups whose ${definition.label} is not ${definition.scalar}.`, filter: { field: definition.field, operator: "neq", value: definition.scalar }, parameter: definition.scalar },
    { suffix: "lt", tier: "core", question: `Count people groups with ${definition.label} below ${definition.scalar}.`, filter: { field: definition.field, operator: "lt", value: definition.scalar }, parameter: definition.scalar },
    { suffix: "lte", tier: "core", question: `Count people groups with ${definition.label} at most ${definition.scalar}.`, filter: { field: definition.field, operator: "lte", value: definition.scalar }, parameter: definition.scalar },
    { suffix: "gt", tier: "core", question: `Count people groups with ${definition.label} above ${definition.scalar}.`, filter: { field: definition.field, operator: "gt", value: definition.scalar }, parameter: definition.scalar },
    { suffix: "gte", tier: "core", question: `Count people groups with ${definition.label} at least ${definition.scalar}.`, filter: { field: definition.field, operator: "gte", value: definition.scalar }, parameter: definition.scalar },
    { suffix: "in", tier: "extended", question: `Count people groups whose ${definition.label} is one of ${definition.values.join(", ")}.`, filter: { field: definition.field, operator: "in", value: [...definition.values] }, parameter: definition.values },
    { suffix: "missing", tier: "extended", question: `Count people groups with no valid ${definition.label}.`, filter: { field: definition.field, operator: "eq", value: null } },
    { suffix: "present", tier: "extended", question: `Count people groups with a valid ${definition.label}.`, filter: { field: definition.field, operator: "neq", value: null } },
  ];

  return cases.map((entry) =>
    plannerQueryCase({
      id: `v4-filter-${definition.field.replaceAll("_", "-")}-${entry.suffix}`,
      tier: entry.tier,
      capability: entry.suffix === "missing" || entry.suffix === "present" ? "null-and-zero" : "filter-operator",
      rationale: `Exercise ${entry.filter.operator} with the numeric ${definition.field} field and preserve numeric JSON typing.`,
      tags: ["filter", definition.field, entry.filter.operator, "numeric"],
      question: entry.question,
      reason: `Count records using the approved numeric ${definition.field} ${entry.filter.operator} filter.`,
      query: aggregateQuery({
        metrics: ["people_group_count"],
        dimensions: [],
        filters: [entry.filter],
        sort: [],
        limit: 1,
      }),
      selectedKeys: ["people_group_count"],
      parameters: entry.parameter === undefined ? [1] : [entry.parameter, 1],
    }),
  );
});

type BooleanFilterDefinition = Readonly<{
  field: "frontier_group" | "globally_engaged";
  label: string;
}>;

const booleanFilterDefinitions: readonly BooleanFilterDefinition[] = [
  { field: "frontier_group", label: "frontier-group status" },
  { field: "globally_engaged", label: "global-engagement status" },
];

const booleanFilterCases = booleanFilterDefinitions.flatMap((definition) => {
  const cases: readonly Readonly<{
    suffix: string;
    tier: PrivateDataChatEvaluationTier;
    question: string;
    filter: PrivateDataChatFilter;
    parameter?: boolean | readonly boolean[];
  }>[] = [
    { suffix: "true", tier: "core", question: `Count people groups where ${definition.label} is true.`, filter: { field: definition.field, operator: "eq", value: true }, parameter: true },
    { suffix: "false", tier: "core", question: `Count people groups where ${definition.label} is false.`, filter: { field: definition.field, operator: "eq", value: false }, parameter: false },
    { suffix: "not-true", tier: "core", question: `Count people groups where ${definition.label} is not true.`, filter: { field: definition.field, operator: "neq", value: true }, parameter: true },
    { suffix: "in", tier: "core", question: `Count people groups where ${definition.label} is either true or false.`, filter: { field: definition.field, operator: "in", value: [true, false] }, parameter: [true, false] },
    { suffix: "missing", tier: "extended", question: `Count people groups with missing ${definition.label}.`, filter: { field: definition.field, operator: "eq", value: null } },
    { suffix: "present", tier: "extended", question: `Count people groups with a valid ${definition.label}.`, filter: { field: definition.field, operator: "neq", value: null } },
  ];

  return cases.map((entry) =>
    plannerQueryCase({
      id: `v4-filter-${definition.field.replaceAll("_", "-")}-${entry.suffix}`,
      tier: entry.tier,
      capability: entry.suffix === "missing" || entry.suffix === "present" ? "null-and-zero" : "filter-operator",
      rationale: `Exercise boolean and nullable handling for ${definition.field} without converting booleans to strings.`,
      tags: ["filter", definition.field, entry.filter.operator, "boolean"],
      question: entry.question,
      reason: `Count records using the approved boolean ${definition.field} filter.`,
      query: aggregateQuery({
        metrics: ["people_group_count"],
        dimensions: [],
        filters: [entry.filter],
        sort: [],
        limit: 1,
      }),
      selectedKeys: ["people_group_count"],
      parameters: entry.parameter === undefined ? [1] : [entry.parameter, 1],
    }),
  );
});

const sortLimitDefinitions: readonly Readonly<{
  id: string;
  tier: PrivateDataChatEvaluationTier;
  question: string;
  query: PrivateDataChatQuery;
  selectedKeys: readonly string[];
  limit: number;
}>[] = [
  { id: "largest-one", tier: "core", question: "Show the people-group name and recorded population for the single highest-population group.", query: recordsQuery({ fields: ["people_name", "population"], filters: [], sort: [{ field: "population", direction: "desc" }], limit: 1 }), selectedKeys: ["people_name", "population"], limit: 1 },
  { id: "smallest-one", tier: "core", question: "List exactly 1 people-group name and recorded population, ordered by recorded population ascending.", query: recordsQuery({ fields: ["people_name", "population"], filters: [], sort: [{ field: "population", direction: "asc" }], limit: 1 }), selectedKeys: ["people_name", "population"], limit: 1 },
  { id: "largest-hundred", tier: "extended", question: "List the names and recorded populations of the 100 highest-population people groups.", query: recordsQuery({ fields: ["people_name", "population"], filters: [], sort: [{ field: "population", direction: "desc" }], limit: 100 }), selectedKeys: ["people_name", "population"], limit: 100 },
  { id: "names-alphabetical", tier: "core", question: "List 15 people-group names in alphabetical order.", query: recordsQuery({ fields: ["people_name"], filters: [], sort: [{ field: "people_name", direction: "asc" }], limit: 15 }), selectedKeys: ["people_name"], limit: 15 },
  { id: "countries-reverse", tier: "extended", question: "Return 20 country values in reverse alphabetical order.", query: recordsQuery({ fields: ["country"], filters: [], sort: [{ field: "country", direction: "desc" }], limit: 20 }), selectedKeys: ["country"], limit: 20 },
  { id: "evangelical-high", tier: "core", question: "List 25 people-group names and evangelical percentages, highest percentage first.", query: recordsQuery({ fields: ["people_name", "percent_evangelical"], filters: [], sort: [{ field: "percent_evangelical", direction: "desc" }], limit: 25 }), selectedKeys: ["people_name", "percent_evangelical"], limit: 25 },
  { id: "evangelical-low", tier: "extended", question: "List 25 people-group names and evangelical percentages, lowest percentage first.", query: recordsQuery({ fields: ["people_name", "percent_evangelical"], filters: [], sort: [{ field: "percent_evangelical", direction: "asc" }], limit: 25 }), selectedKeys: ["people_name", "percent_evangelical"], limit: 25 },
  { id: "gsec-high", tier: "core", question: "Show 10 people IDs and GSEC classifications, highest GSEC first.", query: recordsQuery({ fields: ["people_id", "gsec"], filters: [], sort: [{ field: "gsec", direction: "desc" }], limit: 10 }), selectedKeys: ["people_id", "gsec"], limit: 10 },
  { id: "phase-low", tier: "extended", question: "Show 10 people IDs and engagement phases, lowest phase first.", query: recordsQuery({ fields: ["people_id", "engagement_phase"], filters: [], sort: [{ field: "engagement_phase", direction: "asc" }], limit: 10 }), selectedKeys: ["people_id", "engagement_phase"], limit: 10 },
  { id: "country-alpha-group", tier: "core", question: "Count people groups by country, ordered alphabetically by country, for 100 countries.", query: aggregateQuery({ metrics: ["people_group_count"], dimensions: ["country"], filters: [], sort: [{ field: "country", direction: "asc" }], limit: 100 }), selectedKeys: ["country", "people_group_count"], limit: 100 },
  { id: "country-count-group", tier: "extended", question: "Show country and people-group count for 30 countries, ordered by people-group count descending.", query: aggregateQuery({ metrics: ["people_group_count"], dimensions: ["country"], filters: [], sort: [{ field: "people_group_count", direction: "desc" }], limit: 30 }), selectedKeys: ["country", "people_group_count"], limit: 30 },
  { id: "country-population-small", tier: "extended", question: "Show 20 countries with the smallest total recorded population.", query: aggregateQuery({ metrics: ["total_population"], dimensions: ["country"], filters: [], sort: [{ field: "total_population", direction: "asc" }], limit: 20 }), selectedKeys: ["country", "total_population"], limit: 20 },
];

const sortLimitCases = sortLimitDefinitions.map((definition) =>
  plannerQueryCase({
    id: `v4-sort-limit-${definition.id}`,
    tier: definition.tier,
    capability: "sorting-and-limits",
    rationale: "Verify explicit ranking direction and result bounds survive planning exactly.",
    tags: ["sort", "limit", String(definition.limit)],
    question: definition.question,
    reason: "Apply the requested approved sort and bounded result count.",
    query: definition.query,
    selectedKeys: definition.selectedKeys,
    parameters: [definition.limit],
  }),
);

const geographyValues = [
  "US",
  "USA",
  "U.S.",
  "United States",
  "TH",
  "THA",
  "Thailand",
  "NP",
  "NPL",
  "Nepal",
  "Côte d’Ivoire",
  "Ivory Coast",
  "Korea, South",
  "Congo",
  "ZZZ",
] as const;

const geographyCases = geographyValues.map((value, index) =>
  plannerQueryCase({
    id: `v4-country-value-${String(index + 1).padStart(2, "0")}`,
    tier: index < 8 ? "core" : "extended",
    capability: "controlled-values",
    risk: value === "Congo" ? "elevated" : "standard",
    rationale:
      value === "Congo"
        ? "Preserve an ambiguous country term for deterministic resolver clarification after planning."
        : "Preserve the exact user country spelling or code for deterministic server-side resolution.",
    tags: ["country", "controlled-value", value === "ZZZ" ? "unknown" : "alias"],
    question: `Count people groups in the country identified as ${value}.`,
    reason: "Preserve the country value for deterministic reference-resource resolution.",
    query: aggregateQuery({
      metrics: ["people_group_count"],
      dimensions: [],
      filters: [{ field: "country", operator: "eq", value }],
      sort: [],
      limit: 1,
    }),
    selectedKeys: ["people_group_count"],
    parameters: [value, 1],
  }),
);

const complexBoundaryCases: readonly PrivateDataChatPlannerEvaluationCase[] = [
  plannerQueryCase({
    id: "v4-policy-aggregate-max-shape",
    tier: "extended",
    capability: "sorting-and-limits",
    risk: "elevated",
    rationale: "Exercise the approved maximum of three metrics, two dimensions, two sorts, and 100 grouped rows without exceeding policy.",
    tags: ["policy-boundary", "aggregate", "maximum-shape"],
    question: "For up to 100 country and frontier-status combinations, show people-group count, total population, and average population, ordered by total population descending and then country ascending.",
    reason: "Use the requested maximum-size approved aggregate shape.",
    query: aggregateQuery({
      metrics: ["people_group_count", "total_population", "average_population"],
      dimensions: ["country", "frontier_group"],
      filters: [],
      sort: [
        { field: "total_population", direction: "desc" },
        { field: "country", direction: "asc" },
      ],
      limit: 100,
    }),
    selectedKeys: [
      "country",
      "frontier_group",
      "people_group_count",
      "total_population",
      "average_population",
    ],
    parameters: [100],
  }),
  plannerQueryCase({
    id: "v4-policy-record-max-shape",
    tier: "extended",
    capability: "sorting-and-limits",
    risk: "elevated",
    rationale: "Exercise six fields, six filters, three sorts, and 100 rows at the exact approved record-policy boundary.",
    tags: ["policy-boundary", "records", "maximum-shape"],
    question: "List up to 100 people IDs, names, countries, populations, frontier statuses, and engagement phases where country is Thailand, population is at least 1000, percent evangelical is present, frontier status is true, globally engaged is false, and engagement phase is 1, 2, or 3; order by population descending, people ID ascending, then country ascending.",
    reason: "Use the requested maximum-size approved record shape.",
    query: recordsQuery({
      fields: [
        "people_id",
        "people_name",
        "country",
        "population",
        "frontier_group",
        "engagement_phase",
      ],
      filters: [
        { field: "country", operator: "eq", value: "Thailand" },
        { field: "population", operator: "gte", value: 1_000 },
        { field: "percent_evangelical", operator: "neq", value: null },
        { field: "frontier_group", operator: "eq", value: true },
        { field: "globally_engaged", operator: "eq", value: false },
        { field: "engagement_phase", operator: "in", value: [1, 2, 3] },
      ],
      sort: [
        { field: "population", direction: "desc" },
        { field: "people_id", direction: "asc" },
        { field: "country", direction: "asc" },
      ],
      limit: 100,
    }),
    selectedKeys: [
      "people_id",
      "people_name",
      "country",
      "population",
      "frontier_group",
      "engagement_phase",
    ],
    parameters: ["Thailand", 1_000, true, false, [1, 2, 3], 100],
  }),
];

export const PRIVATE_DATA_CHAT_SUPPORTED_PLANNER_CASES: readonly PrivateDataChatPlannerEvaluationCase[] = [
  ...metricCases,
  ...groupedCases,
  ...recordProjectionCases,
  ...textFilterCases,
  ...numberFilterCases,
  ...booleanFilterCases,
  ...sortLimitCases,
  ...geographyCases,
  ...complexBoundaryCases,
];
