import type {
  PrivateDataChatEndToEndEvaluationCase,
  PrivateDataChatEvaluationMessage,
  PrivateDataChatEvaluationRisk,
  PrivateDataChatEvaluationTier,
  PrivateDataChatTextRubric,
} from "@/lib/private-data-chat/evaluation-suite-types";
import type { PrivateDataChatSelectedKey } from "@/lib/private-data-chat/catalog";

function queryCase(input: Readonly<{
  id: string;
  tier: PrivateDataChatEvaluationTier;
  risk?: PrivateDataChatEvaluationRisk;
  rationale: string;
  tags: readonly string[];
  question?: string;
  messages?: readonly PrivateDataChatEvaluationMessage[];
  selectedKeys: readonly PrivateDataChatSelectedKey[];
  filterFields?: readonly string[];
  sort?: readonly Readonly<{ field: string; direction: "asc" | "desc" }>[];
  minimumRows: number;
  maximumRows: number;
  textRubric?: PrivateDataChatTextRubric;
}>): PrivateDataChatEndToEndEvaluationCase {
  return {
    id: `v4-e2e-${input.id}`,
    kind: "end-to-end",
    tier: input.tier,
    capability: "end-to-end-read-only",
    risk: input.risk ?? "elevated",
    rationale: input.rationale,
    tags: ["approval-required", "read-only", ...input.tags],
    messages:
      input.messages ??
      ([{ role: "user", content: input.question ?? "" }] as const),
    expected: {
      decision: "query",
      selectedKeys: input.selectedKeys,
      filterFields: input.filterFields ?? [],
      sort: input.sort ?? [],
      rowCount: {
        minimum: input.minimumRows,
        maximum: input.maximumRows,
      },
      requireCatalogVersion: true,
      requireProvenance: true,
      textRubric: input.textRubric,
    },
  };
}

function clarifyCase(input: Readonly<{
  id: string;
  tier: PrivateDataChatEvaluationTier;
  rationale: string;
  tags: readonly string[];
  question?: string;
  messages?: readonly PrivateDataChatEvaluationMessage[];
  textRubric: PrivateDataChatTextRubric;
}>): PrivateDataChatEndToEndEvaluationCase {
  return {
    id: `v4-e2e-${input.id}`,
    kind: "end-to-end",
    tier: input.tier,
    capability: "end-to-end-read-only",
    risk: "elevated",
    rationale: input.rationale,
    tags: ["approval-required", "read-only", "no-query", ...input.tags],
    messages:
      input.messages ??
      ([{ role: "user", content: input.question ?? "" }] as const),
    expected: {
      decision: "clarify",
      requireNoQuery: true,
      textRubric: input.textRubric,
    },
  };
}

export const PRIVATE_DATA_CHAT_END_TO_END_CAPABILITY_CASES: readonly PrivateDataChatEndToEndEvaluationCase[] = [
  queryCase({
    id: "count-all",
    tier: "smoke",
    rationale: "Verify the complete production path can return one grounded dataset count.",
    tags: ["aggregate", "count"],
    question: "How many people groups are in the current primary dataset?",
    selectedKeys: ["people_group_count"],
    minimumRows: 1,
    maximumRows: 1,
    textRubric: { requiredAny: [["people group", "record"]], forbidden: ["estimated"] },
  }),
  queryCase({
    id: "total-population",
    tier: "smoke",
    rationale: "Verify scalar population narration and provenance over the protected broker path.",
    tags: ["aggregate", "population"],
    question: "What is the total recorded population across all people groups?",
    selectedKeys: ["total_population"],
    minimumRows: 1,
    maximumRows: 1,
    textRubric: { requiredAny: [["people", "population"]], forbidden: ["people groups total"] },
  }),
  queryCase({
    id: "average-population",
    tier: "core",
    rationale: "Verify the approved average-population formula is selected end to end.",
    tags: ["aggregate", "average"],
    question: "What is the average valid people-group population?",
    selectedKeys: ["average_population"],
    minimumRows: 1,
    maximumRows: 1,
  }),
  queryCase({
    id: "average-evangelical",
    tier: "core",
    rationale: "Verify unweighted evangelical-percentage narration and units end to end.",
    tags: ["aggregate", "percentage"],
    question: "What is the unweighted average percent evangelical across valid records?",
    selectedKeys: ["average_percent_evangelical"],
    minimumRows: 1,
    maximumRows: 1,
    textRubric: { requiredAny: [["percent", "percentage"]] },
  }),
  queryCase({
    id: "population-by-country-top-ten",
    tier: "core",
    rationale: "Verify grouped aggregation, descending metric sort, row bound, and provenance.",
    tags: ["grouped", "country", "sort"],
    question: "Show the 10 countries with largest total population.",
    selectedKeys: ["country", "total_population"],
    sort: [{ field: "total_population", direction: "desc" }],
    minimumRows: 0,
    maximumRows: 10,
  }),
  queryCase({
    id: "count-by-frontier",
    tier: "core",
    rationale: "Verify boolean grouping produces bounded typed groups.",
    tags: ["grouped", "frontier", "boolean"],
    question: "Count people groups by frontier status.",
    selectedKeys: ["frontier_group", "people_group_count"],
    minimumRows: 0,
    maximumRows: 10,
  }),
  queryCase({
    id: "thailand-records",
    tier: "core",
    rationale: "Verify a canonical country filter, bounded record projection, and read-only provenance.",
    tags: ["records", "country", "filter"],
    question: "List 10 people IDs and names for people groups in Thailand.",
    selectedKeys: ["people_id", "people_name"],
    filterFields: ["country"],
    minimumRows: 0,
    maximumRows: 10,
  }),
  queryCase({
    id: "us-alias-records",
    tier: "core",
    rationale: "Verify the country resolver canonicalizes the US alias before safe compilation.",
    tags: ["records", "country", "alias"],
    question: "List 10 people IDs in US, ordered by people ID.",
    selectedKeys: ["people_id"],
    filterFields: ["country"],
    sort: [{ field: "people_id", direction: "asc" }],
    minimumRows: 0,
    maximumRows: 10,
  }),
  queryCase({
    id: "npl-alias-count",
    tier: "core",
    rationale: "Verify alpha-3 country resolution through the full path.",
    tags: ["aggregate", "country", "alias"],
    question: "Count people groups in NPL.",
    selectedKeys: ["people_group_count"],
    filterFields: ["country"],
    minimumRows: 1,
    maximumRows: 1,
  }),
  queryCase({
    id: "missing-population-count",
    tier: "core",
    rationale: "Verify null population becomes an IS NULL condition and is narrated as missing, not zero.",
    tags: ["aggregate", "null", "population"],
    question: "How many people groups have no valid recorded population?",
    selectedKeys: ["people_group_count"],
    filterFields: ["population"],
    minimumRows: 1,
    maximumRows: 1,
    textRubric: { forbidden: ["zero population means missing"] },
  }),
  queryCase({
    id: "zero-percentage-count",
    tier: "core",
    rationale: "Verify a numeric zero filter remains distinct from null through the full path.",
    tags: ["aggregate", "zero", "percentage"],
    question: "Count people groups with exactly zero percent evangelical.",
    selectedKeys: ["people_group_count"],
    filterFields: ["percent_evangelical"],
    minimumRows: 1,
    maximumRows: 1,
  }),
  queryCase({
    id: "frontier-total-population",
    tier: "core",
    rationale: "Verify a boolean filter and population metric combine correctly.",
    tags: ["aggregate", "frontier", "population"],
    question: "What is total population for frontier people groups?",
    selectedKeys: ["total_population"],
    filterFields: ["frontier_group"],
    minimumRows: 1,
    maximumRows: 1,
  }),
  queryCase({
    id: "unengaged-count",
    tier: "core",
    rationale: "Verify false boolean values retain JSON typing and do not become missing.",
    tags: ["aggregate", "engagement", "boolean"],
    question: "Count people groups where globally engaged is false.",
    selectedKeys: ["people_group_count"],
    filterFields: ["globally_engaged"],
    minimumRows: 1,
    maximumRows: 1,
  }),
  queryCase({
    id: "population-threshold-records",
    tier: "extended",
    rationale: "Verify numeric threshold filtering and bounded record projection.",
    tags: ["records", "population", "filter"],
    question: "List 20 people IDs, names, and populations where population is at least 100000.",
    selectedKeys: ["people_id", "people_name", "population"],
    filterFields: ["population"],
    minimumRows: 0,
    maximumRows: 20,
  }),
  queryCase({
    id: "two-country-count",
    tier: "extended",
    rationale: "Verify an approved country in-filter resolves both values and remains one parameterized predicate.",
    tags: ["aggregate", "country", "in-filter"],
    question: "Count people groups in India or Nepal.",
    selectedKeys: ["people_group_count"],
    filterFields: ["country"],
    minimumRows: 1,
    maximumRows: 1,
  }),
  queryCase({
    id: "empty-antarctica",
    tier: "extended",
    rationale: "Verify a valid empty query is distinguished from rejection or unavailability.",
    tags: ["records", "empty-result", "country"],
    question: "List people IDs and names for people groups in Antarctica.",
    selectedKeys: ["people_id", "people_name"],
    filterFields: ["country"],
    minimumRows: 0,
    maximumRows: 100,
    textRubric: { requiredAny: [["no matching", "people ID", "people group"]], forbidden: ["invalid country"] },
  }),
  queryCase({
    id: "largest-five-population",
    tier: "extended",
    rationale: "Verify explicit record ranking includes its sort field and exact bound.",
    tags: ["records", "ranking", "population"],
    question: "List the five people-group names with highest recorded population.",
    selectedKeys: ["people_name", "population"],
    sort: [{ field: "population", direction: "desc" }],
    minimumRows: 0,
    maximumRows: 5,
  }),
  queryCase({
    id: "average-evangelical-country",
    tier: "extended",
    rationale: "Verify the grouped unweighted percentage metric and descending sort.",
    tags: ["grouped", "country", "percentage"],
    question: "Show 25 countries with highest average percent evangelical.",
    selectedKeys: ["country", "average_percent_evangelical"],
    sort: [{ field: "average_percent_evangelical", direction: "desc" }],
    minimumRows: 0,
    maximumRows: 25,
  }),
  queryCase({
    id: "multi-turn-ranking",
    tier: "extended",
    rationale: "Verify the production conversation path resolves ranking metric and count from history.",
    tags: ["multi-turn", "ranking"],
    messages: [
      { role: "user", content: "Which are the largest people groups?" },
      { role: "assistant", content: "Should largest mean population, and how many should I return?" },
      { role: "user", content: "By population. Five." },
    ],
    selectedKeys: ["people_name", "population"],
    sort: [{ field: "population", direction: "desc" }],
    minimumRows: 0,
    maximumRows: 5,
  }),
  queryCase({
    id: "multi-turn-country-switch",
    tier: "extended",
    rationale: "Verify a follow-up can retain the prior count intent while switching country.",
    tags: ["multi-turn", "country"],
    messages: [
      { role: "user", content: "Count people groups in India." },
      { role: "assistant", content: "I can count people groups in India." },
      { role: "user", content: "What about Nepal?" },
    ],
    selectedKeys: ["people_group_count"],
    filterFields: ["country"],
    minimumRows: 1,
    maximumRows: 1,
  }),
  clarifyCase({
    id: "ambiguous-largest",
    tier: "core",
    rationale: "Verify the full path asks for both metric and count before querying.",
    tags: ["clarification", "ranking"],
    question: "Which are the largest people groups?",
    textRubric: { requiredAll: ["population", "how many"] },
  }),
  clarifyCase({
    id: "macro-region-unavailable",
    tier: "extended",
    rationale: "Verify unsupported grouping fails before broker execution.",
    tags: ["unsupported", "grouping"],
    question: "Count people groups by macro region.",
    textRubric: {
      requiredAll: ["macro region"],
      requiredAny: [
        ["not available", "unavailable", "does not contain", "does not support", "not in"],
        ["country"],
      ],
    },
  }),
  clarifyCase({
    id: "weighted-average-unavailable",
    tier: "extended",
    rationale: "Verify the system does not silently replace a weighted formula with the approved unweighted metric.",
    tags: ["unsupported", "metric"],
    question: "Calculate population-weighted average percent evangelical.",
    textRubric: { requiredAll: ["weighted", "not"], requiredAny: [["unweighted"]], forbidden: ["weighted average is"] },
  }),
  queryCase({
    id: "congo-display-name-records",
    tier: "extended",
    rationale: "Verify the exact approved Congo display name resolves deterministically without inventing ambiguity.",
    tags: ["controlled-value", "country", "exact-name"],
    question: "List 10 people IDs in Congo.",
    selectedKeys: ["people_id"],
    filterFields: ["country"],
    minimumRows: 0,
    maximumRows: 10,
  }),
];
