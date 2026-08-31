import type { PrivateDataChatSelectedKey } from "@/lib/private-data-chat/catalog";
import type {
  PrivateDataChatPlan,
  PrivateDataChatQueryResult,
} from "@/lib/private-data-chat/schemas";

export const PRIVATE_DATA_CHAT_CAPABILITY_SUITE_VERSION =
  "private-data-chat-capabilities-v4.review-1" as const;

export const PRIVATE_DATA_CHAT_EVALUATION_TIERS = [
  "smoke",
  "core",
  "extended",
] as const;

export type PrivateDataChatEvaluationTier =
  (typeof PRIVATE_DATA_CHAT_EVALUATION_TIERS)[number];

export type PrivateDataChatEvaluationRisk =
  | "standard"
  | "elevated"
  | "critical";

export type PrivateDataChatEvaluationCapability =
  | "compatibility-baseline"
  | "metric-selection"
  | "grouping"
  | "record-projection"
  | "filter-operator"
  | "sorting-and-limits"
  | "controlled-values"
  | "clarification"
  | "unsupported-concept"
  | "multi-turn"
  | "safety-refusal"
  | "injection-resistance"
  | "grounded-answer"
  | "null-and-zero"
  | "empty-result"
  | "untrusted-result-content"
  | "end-to-end-read-only";

export type PrivateDataChatEvaluationMessage = Readonly<{
  role: "user" | "assistant";
  content: string;
}>;

export type PrivateDataChatGoldenParameter =
  | string
  | number
  | boolean
  | null
  | readonly (string | number | boolean)[];

export type PrivateDataChatTextRubric = Readonly<{
  requiredAll?: readonly string[];
  requiredAny?: readonly (readonly string[])[];
  forbidden?: readonly string[];
  notes?: readonly string[];
}>;

type PrivateDataChatEvaluationCaseBase = Readonly<{
  id: string;
  tier: PrivateDataChatEvaluationTier;
  capability: PrivateDataChatEvaluationCapability;
  risk: PrivateDataChatEvaluationRisk;
  rationale: string;
  tags: readonly string[];
}>;

export type PrivateDataChatPlannerEvaluationCase =
  PrivateDataChatEvaluationCaseBase &
    Readonly<{
      kind: "planner";
      source: "v3-baseline" | "v4-expansion";
      messages: readonly PrivateDataChatEvaluationMessage[];
      expectedPlan: PrivateDataChatPlan;
      expectedCompilation?: Readonly<{
        selectedKeys: readonly string[];
        parameters: readonly PrivateDataChatGoldenParameter[];
      }>;
      textRubric?: PrivateDataChatTextRubric;
    }>;

export type PrivateDataChatAnswerEvaluationCase =
  PrivateDataChatEvaluationCaseBase &
    Readonly<{
      kind: "answer";
      question: string;
      selectedKeys: readonly PrivateDataChatSelectedKey[];
      result: PrivateDataChatQueryResult;
      expected: Readonly<{
        requiredFactKeys: readonly string[];
        requiredFactValues: readonly string[];
        maximumFacts: number;
        emptyResult: boolean;
        textRubric: PrivateDataChatTextRubric;
      }>;
    }>;

export type PrivateDataChatEndToEndQueryExpectation = Readonly<{
  decision: "query";
  selectedKeys: readonly PrivateDataChatSelectedKey[];
  filterFields: readonly string[];
  sort: readonly Readonly<{ field: string; direction: "asc" | "desc" }>[];
  rowCount: Readonly<{ minimum: number; maximum: number }>;
  requireCatalogVersion: true;
  requireProvenance: true;
  textRubric?: PrivateDataChatTextRubric;
}>;

export type PrivateDataChatEndToEndClarifyExpectation = Readonly<{
  decision: "clarify";
  requireNoQuery: true;
  textRubric: PrivateDataChatTextRubric;
}>;

export type PrivateDataChatEndToEndEvaluationCase =
  PrivateDataChatEvaluationCaseBase &
    Readonly<{
      kind: "end-to-end";
      messages: readonly PrivateDataChatEvaluationMessage[];
      expected:
        | PrivateDataChatEndToEndQueryExpectation
        | PrivateDataChatEndToEndClarifyExpectation;
    }>;

export type PrivateDataChatCapabilityEvaluationCase =
  | PrivateDataChatPlannerEvaluationCase
  | PrivateDataChatAnswerEvaluationCase
  | PrivateDataChatEndToEndEvaluationCase;

const tierRank: Record<PrivateDataChatEvaluationTier, number> = {
  smoke: 0,
  core: 1,
  extended: 2,
};

export function isPrivateDataChatCaseInTier(
  testCase: PrivateDataChatCapabilityEvaluationCase,
  requestedTier: PrivateDataChatEvaluationTier,
) {
  return tierRank[testCase.tier] <= tierRank[requestedTier];
}

export function getPrivateDataChatCasesForTier(
  cases: readonly PrivateDataChatCapabilityEvaluationCase[],
  requestedTier: PrivateDataChatEvaluationTier,
) {
  return cases.filter((testCase) =>
    isPrivateDataChatCaseInTier(testCase, requestedTier),
  );
}

export function getPrivateDataChatCaseInputText(
  testCase: PrivateDataChatCapabilityEvaluationCase,
) {
  if (testCase.kind === "answer") return testCase.question;
  return testCase.messages.map((message) => message.content).join("\n");
}
