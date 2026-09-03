import { PRIVATE_DATA_CHAT_ANSWER_CAPABILITY_CASES } from "@/lib/private-data-chat/evaluation-suite-answer";
import { PRIVATE_DATA_CHAT_END_TO_END_CAPABILITY_CASES } from "@/lib/private-data-chat/evaluation-suite-end-to-end";
import { PRIVATE_DATA_CHAT_PLANNER_CAPABILITY_CASES } from "@/lib/private-data-chat/evaluation-suite-planner";
import {
  PRIVATE_DATA_CHAT_CAPABILITY_SUITE_VERSION,
  PRIVATE_DATA_CHAT_EVALUATION_TIERS,
  getPrivateDataChatCasesForTier,
  type PrivateDataChatCapabilityEvaluationCase,
  type PrivateDataChatEvaluationCapability,
  type PrivateDataChatEvaluationRisk,
  type PrivateDataChatEvaluationTier,
} from "@/lib/private-data-chat/evaluation-suite-types";

export {
  PRIVATE_DATA_CHAT_CAPABILITY_SUITE_VERSION,
  PRIVATE_DATA_CHAT_EVALUATION_TIERS,
  getPrivateDataChatCasesForTier,
};
export type {
  PrivateDataChatCapabilityEvaluationCase,
  PrivateDataChatEvaluationTier,
};

export const PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES: readonly PrivateDataChatCapabilityEvaluationCase[] = [
  ...PRIVATE_DATA_CHAT_PLANNER_CAPABILITY_CASES,
  ...PRIVATE_DATA_CHAT_ANSWER_CAPABILITY_CASES,
  ...PRIVATE_DATA_CHAT_END_TO_END_CAPABILITY_CASES,
];

function increment(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1;
}

function estimatedInferenceCalls(testCase: PrivateDataChatCapabilityEvaluationCase) {
  if (testCase.expectedModelCalls !== undefined) {
    return testCase.expectedModelCalls;
  }
  if (testCase.kind !== "end-to-end") return 1;
  return testCase.expected.decision === "query" ? 2 : 1;
}

export function summarizePrivateDataChatCapabilitySuite(
  requestedTier: PrivateDataChatEvaluationTier = "extended",
) {
  const cases = getPrivateDataChatCasesForTier(
    PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES,
    requestedTier,
  );
  const byKind: Record<string, number> = {};
  const byCapability: Partial<Record<PrivateDataChatEvaluationCapability, number>> =
    {};
  const byRisk: Partial<Record<PrivateDataChatEvaluationRisk, number>> = {};
  const byDeclaredTier: Partial<Record<PrivateDataChatEvaluationTier, number>> = {};
  let inferenceCalls = 0;

  for (const testCase of cases) {
    increment(byKind, testCase.kind);
    increment(byCapability as Record<string, number>, testCase.capability);
    increment(byRisk as Record<string, number>, testCase.risk);
    increment(byDeclaredTier as Record<string, number>, testCase.tier);
    inferenceCalls += estimatedInferenceCalls(testCase);
  }

  return {
    version: PRIVATE_DATA_CHAT_CAPABILITY_SUITE_VERSION,
    requestedTier,
    totalCases: cases.length,
    estimatedInferenceCalls: inferenceCalls,
    byKind,
    byCapability,
    byRisk,
    byDeclaredTier,
  } as const;
}
