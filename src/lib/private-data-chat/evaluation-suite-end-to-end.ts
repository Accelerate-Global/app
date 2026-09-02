import type {
  PrivateDataChatEndToEndEvaluationCase,
  PrivateDataChatEvaluationMessage,
  PrivateDataChatEvaluationRisk,
  PrivateDataChatEvaluationTier,
  PrivateDataChatTextRubric,
} from "@/lib/private-data-chat/evaluation-suite-types";
import type { PrivateDataChatSelectedKey } from "@/lib/private-data-chat/catalog";
import type { PrivateDataChatResourceQuery } from "@/lib/private-data-chat/schemas";

function queryCase(input: Readonly<{
  id: string;
  version?: "v4" | "v5";
  tier: PrivateDataChatEvaluationTier;
  risk?: PrivateDataChatEvaluationRisk;
  rationale: string;
  tags: readonly string[];
  question?: string;
  messages?: readonly PrivateDataChatEvaluationMessage[];
  selectedKeys: readonly PrivateDataChatSelectedKey[];
  filterFields?: readonly string[];
  namedFilterKeys?: readonly string[];
  sort?: readonly Readonly<{ field: string; direction: "asc" | "desc" }>[];
  minimumRows: number;
  maximumRows: number;
  minimumMatching?: number;
  maximumMatching?: number;
  hasMore?: boolean;
  textRubric?: PrivateDataChatTextRubric;
}>): PrivateDataChatEndToEndEvaluationCase {
  return {
    id: `${input.version ?? "v4"}-e2e-${input.id}`,
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
      namedFilterKeys: input.namedFilterKeys,
      sort: input.sort ?? [],
      rowCount: {
        minimum: input.minimumRows,
        maximum: input.maximumRows,
      },
      matchingCount:
        input.minimumMatching === undefined || input.maximumMatching === undefined
          ? undefined
          : {
              minimum: input.minimumMatching,
              maximum: input.maximumMatching,
            },
      hasMore: input.hasMore,
      requireCatalogVersion: true,
      requireProvenance: true,
      textRubric: input.textRubric,
    },
  };
}

function resourceCase(input: Readonly<{
  id: string;
  tier: PrivateDataChatEvaluationTier;
  risk?: PrivateDataChatEvaluationRisk;
  rationale: string;
  tags: readonly string[];
  question?: string;
  messages?: readonly PrivateDataChatEvaluationMessage[];
  operation: PrivateDataChatResourceQuery["operation"];
  minimumRows: number;
  maximumRows: number;
  minimumMatching: number;
  maximumMatching: number;
  hasMore?: boolean;
  requireContinuation?: boolean;
  textRubric?: PrivateDataChatTextRubric;
}>): PrivateDataChatEndToEndEvaluationCase {
  return {
    id: `v5-e2e-${input.id}`,
    kind: "end-to-end",
    tier: input.tier,
    capability: "end-to-end-read-only",
    risk: input.risk ?? "elevated",
    rationale: input.rationale,
    tags: ["approval-required", "read-only", "resource-query", ...input.tags],
    messages:
      input.messages ??
      ([{ role: "user", content: input.question ?? "" }] as const),
    expected: {
      decision: "resource_query",
      operation: input.operation,
      rowCount: {
        minimum: input.minimumRows,
        maximum: input.maximumRows,
      },
      matchingCount: {
        minimum: input.minimumMatching,
        maximum: input.maximumMatching,
      },
      hasMore: input.hasMore,
      requireContinuation: input.requireContinuation,
      requireResourceVersion: true,
      textRubric: input.textRubric,
    },
  };
}

function clarifyCase(input: Readonly<{
  id: string;
  version?: "v4" | "v5";
  tier: PrivateDataChatEvaluationTier;
  rationale: string;
  tags: readonly string[];
  question?: string;
  messages?: readonly PrivateDataChatEvaluationMessage[];
  textRubric: PrivateDataChatTextRubric;
}>): PrivateDataChatEndToEndEvaluationCase {
  return {
    id: `${input.version ?? "v4"}-e2e-${input.id}`,
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
    question: "List 10 people IDs in U.S., ordered by people ID.",
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
    textRubric: {
      requiredAny: [
        ["population", "metric"],
        ["how many", "number of results", "result count", "limit"],
      ],
    },
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
        [
          "not available",
          "unavailable",
          "does not contain",
          "does not support",
          "not in",
          "not macro region",
          "not 'macro region'",
          'not "macro region"',
        ],
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
    textRubric: {
      requiredAll: ["weighted", "not"],
      requiredAny: [["unweighted"]],
    },
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
  queryCase({
    id: "incident-frontier-sudan-count",
    version: "v5",
    tier: "smoke",
    risk: "critical",
    rationale: "Regress the production incident's authoritative 103-row Sudan frontier count.",
    tags: ["incident-regression", "sudan", "frontier", "count"],
    question: "How many people groups in Sudan have Frontier Group equal to true?",
    selectedKeys: ["people_group_count"],
    filterFields: ["country", "frontier_group"],
    minimumRows: 1,
    maximumRows: 1,
    minimumMatching: 1,
    maximumMatching: 1,
    textRubric: { requiredAll: ["103"] },
  }),
  queryCase({
    id: "incident-uupg-sudan-count",
    version: "v5",
    tier: "smoke",
    risk: "critical",
    rationale: "Regress the authoritative null-preserving UUPG count of 104 for Sudan.",
    tags: ["incident-regression", "sudan", "uupg", "count"],
    question: "How many UUPG people groups are in Sudan using both current criteria?",
    selectedKeys: ["people_group_count"],
    filterFields: ["country"],
    namedFilterKeys: ["uupg"],
    minimumRows: 1,
    maximumRows: 1,
    minimumMatching: 1,
    maximumMatching: 1,
    textRubric: { requiredAll: ["104"], requiredAny: [["UUPG", "people group"]] },
  }),
  queryCase({
    id: "incident-explicit-dual-sudan-count",
    version: "v5",
    tier: "core",
    risk: "critical",
    rationale: "Distinguish the 67 explicit true/false dual-criterion rows from null-preserving UUPG.",
    tags: ["incident-regression", "sudan", "explicit-booleans", "count"],
    question: "How many people groups in Sudan have Frontier Group true and Global Engagement Anywhere false?",
    selectedKeys: ["people_group_count"],
    filterFields: ["country", "frontier_group", "globally_engaged"],
    minimumRows: 1,
    maximumRows: 1,
    minimumMatching: 1,
    maximumMatching: 1,
    textRubric: { requiredAll: ["67"] },
  }),
  queryCase({
    id: "incident-uupg-sudan-complete-page",
    version: "v5",
    tier: "smoke",
    risk: "critical",
    rationale: "Prove a 100-row page is narrated as 100 shown from 104 UUPG matches.",
    tags: ["incident-regression", "sudan", "uupg", "completeness", "100-of-104"],
    question: "List 100 people IDs and names for UUPG people groups in Sudan.",
    selectedKeys: ["people_id", "people_name"],
    filterFields: ["country"],
    namedFilterKeys: ["uupg"],
    minimumRows: 100,
    maximumRows: 100,
    minimumMatching: 104,
    maximumMatching: 104,
    hasMore: true,
    textRubric: {
      requiredAll: ["100", "104"],
      requiredAny: [["showing", "shown", "returned"], ["match", "matching"]],
      forbidden: ["total is 100", "only 100 match", "100 UUPG total"],
    },
  }),
  resourceCase({
    id: "rop-browse-first-page",
    tier: "smoke",
    rationale: "Browse the complete governed ROP catalog through a bounded first page.",
    tags: ["rop", "browse", "paging"],
    question: "Browse all ROP entries.",
    operation: "list",
    minimumRows: 25,
    maximumRows: 25,
    minimumMatching: 13_069,
    maximumMatching: 13_069,
    hasMore: true,
    requireContinuation: true,
    textRubric: { requiredAll: ["13,069"], requiredAny: [["showing", "match"]] },
  }),
  resourceCase({
    id: "rop-search-sudan",
    tier: "core",
    rationale: "Search all reviewed ROP entry fields through the typed resource adapter.",
    tags: ["rop", "search", "geography"],
    question: "Search the ROP catalog for Sudan.",
    operation: "search",
    minimumRows: 25,
    maximumRows: 25,
    minimumMatching: 312,
    maximumMatching: 312,
    hasMore: true,
    textRubric: { requiredAny: [["ROP", "entries"], ["match", "showing"]] },
  }),
  resourceCase({
    id: "rop-lookup-code",
    tier: "smoke",
    rationale: "Give an exact ROP3 code deterministic lookup precedence in production.",
    tags: ["rop", "lookup", "exact-code"],
    question: "Look up ROP3 code 100425.",
    operation: "lookup",
    minimumRows: 1,
    maximumRows: 1,
    minimumMatching: 1,
    maximumMatching: 1,
    hasMore: false,
    textRubric: { requiredAny: [["100425", "ROP"]] },
  }),
  resourceCase({
    id: "rop-count-all",
    tier: "core",
    rationale: "Count the complete active ROP resource without returning its rows.",
    tags: ["rop", "count"],
    question: "How many entries are in the ROP catalog?",
    operation: "count",
    minimumRows: 0,
    maximumRows: 0,
    minimumMatching: 13_069,
    maximumMatching: 13_069,
    hasMore: false,
    textRubric: { requiredAll: ["13,069"], requiredAny: [["ROP", "entries"]] },
  }),
  resourceCase({
    id: "rop-continue-second-page",
    tier: "extended",
    rationale: "Continue ROP results only with the server-issued identity/version-bound token.",
    tags: ["rop", "continue", "signed-state", "paging"],
    messages: [
      { role: "user", content: "Browse all ROP entries." },
      { role: "assistant", content: "I can show a bounded first ROP page." },
      { role: "user", content: "Show the next ROP page." },
    ],
    operation: "continue",
    minimumRows: 25,
    maximumRows: 25,
    minimumMatching: 13_069,
    maximumMatching: 13_069,
    hasMore: true,
    requireContinuation: true,
    textRubric: { requiredAll: ["13,069"], requiredAny: [["26", "50", "showing"]] },
  }),
  queryCase({
    id: "rop3-registered-filter",
    version: "v5",
    tier: "core",
    rationale: "Use only the server-owned dataset-bound ROP3 relationship for filtering.",
    tags: ["rop3", "registered-relationship", "filter"],
    question: "List 20 people IDs and names classified as ROP3 100425.",
    selectedKeys: ["people_id", "people_name"],
    filterFields: ["rop3_code"],
    minimumRows: 1,
    maximumRows: 1,
    minimumMatching: 1,
    maximumMatching: 1,
    hasMore: false,
  }),
  queryCase({
    id: "rop-geography-nonmultiplying-filter",
    version: "v5",
    tier: "core",
    rationale: "Use the registered EXISTS-style ROP geography filter without multiplying people-group rows.",
    tags: ["rop", "geography", "registered-relationship", "exists"],
    question: "List 25 people IDs whose bound ROP geography includes Sudan.",
    selectedKeys: ["people_id"],
    filterFields: ["rop_geography"],
    minimumRows: 25,
    maximumRows: 25,
    minimumMatching: 234,
    maximumMatching: 234,
    hasMore: true,
  }),
  queryCase({
    id: "rop-null-preserving-match-status",
    version: "v5",
    tier: "extended",
    rationale: "Return explicit ROP match states without dropping unmatched or malformed primary rows.",
    tags: ["rop", "match-status", "null-preserving", "registered-relationship"],
    question: "List 25 people IDs and their ROP match status.",
    selectedKeys: ["people_id", "rop_match_status"],
    minimumRows: 25,
    maximumRows: 25,
    minimumMatching: 12_507,
    maximumMatching: 12_507,
    hasMore: true,
  }),
  clarifyCase({
    id: "uupg-reviewed-definition",
    version: "v5",
    tier: "core",
    rationale: "Ground the visible UUPG explanation in the reviewed definition package.",
    tags: ["definition", "uupg", "null-preserving"],
    question: "What does UUPG mean in this app?",
    textRubric: {
      requiredAny: [
        ["Global Engagement Anywhere", "global engagement", "globally engaged"],
        ["Frontier Group", "frontier"],
        ["blank", "missing", "null"],
        ["Baseline UUPG", "baseline"],
      ],
    },
  }),
  clarifyCase({
    id: "off-topic-photosynthesis",
    version: "v5",
    tier: "smoke",
    rationale: "Keep a hard-negative general-knowledge request outside the governed data domain.",
    tags: ["off-topic", "hard-negative", "abstention"],
    question: "Explain photosynthesis.",
    textRubric: {
      requiredAny: [
        ["cannot", "can't", "only"],
        ["Accelerate Global", "people group", "data"],
      ],
      forbidden: ["chlorophyll", "sunlight", "carbon dioxide"],
    },
  }),
];
