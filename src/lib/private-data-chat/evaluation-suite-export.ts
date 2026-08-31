import { createHash } from "node:crypto";

import {
  PRIVATE_DATA_CHAT_CATALOG_CHECKSUM,
  PRIVATE_DATA_CHAT_CATALOG_VERSION,
  getPrivateDataChatAnswerSemanticContext,
} from "@/lib/private-data-chat/catalog";
import { PRIVATE_DATA_CHAT_POLICY_VERSION } from "@/lib/private-data-chat/compiler";
import {
  PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES,
  PRIVATE_DATA_CHAT_CAPABILITY_SUITE_VERSION,
  summarizePrivateDataChatCapabilitySuite,
} from "@/lib/private-data-chat/evaluation-suite";
import {
  PRIVATE_DATA_CHAT_ANSWER_PROMPT_VERSION,
  PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT,
  PRIVATE_DATA_CHAT_PLANNER_PROMPT_VERSION,
  PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT,
  PRIVATE_QWEN_MODEL_SHA256,
  PRIVATE_QWEN_RUNTIME_REVISION,
} from "@/lib/private-data-chat/prompts";
import {
  PRIVATE_DATA_CHAT_ANSWER_JSON_SCHEMA,
  PRIVATE_DATA_CHAT_PLAN_JSON_SCHEMA,
} from "@/lib/private-data-chat/schemas";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function canonicalPrivateDataChatEvaluationJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function hashPrivateDataChatEvaluationValue(value: unknown) {
  return createHash("sha256")
    .update(canonicalPrivateDataChatEvaluationJson(value), "utf8")
    .digest("hex");
}

export function hashPrivateDataChatEvaluationText(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function plannerDocument() {
  const cases = PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES.filter(
    (testCase) => testCase.kind === "planner",
  ).map((testCase) => {
    const expectedDecision = testCase.expectedPlan.decision;
    const referenceText =
      expectedDecision === "clarify"
        ? testCase.expectedPlan.question
        : expectedDecision === "answer"
          ? testCase.expectedPlan.answer
          : undefined;

    return {
      id: testCase.id,
      tier: testCase.tier,
      capability: testCase.capability,
      risk: testCase.risk,
      source: testCase.source,
      messages: testCase.messages,
      expected_decision: expectedDecision,
      expected_query:
        expectedDecision === "query" ? testCase.expectedPlan.query : null,
      expected_compilation: testCase.expectedCompilation ?? null,
      reference_text: referenceText ?? null,
      text_rubric: testCase.textRubric ?? null,
    };
  });

  return {
    suite_id: `${PRIVATE_DATA_CHAT_CAPABILITY_SUITE_VERSION}.planner`,
    suite_version: PRIVATE_DATA_CHAT_CAPABILITY_SUITE_VERSION,
    data_classification: "sanitized-no-production-rows",
    catalog_version: PRIVATE_DATA_CHAT_CATALOG_VERSION,
    catalog_checksum: PRIVATE_DATA_CHAT_CATALOG_CHECKSUM,
    planner_prompt_version: PRIVATE_DATA_CHAT_PLANNER_PROMPT_VERSION,
    compiler_policy_version: PRIVATE_DATA_CHAT_POLICY_VERSION,
    cases,
  };
}

function answerDocument() {
  const cases = PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES.filter(
    (testCase) => testCase.kind === "answer",
  ).map((testCase) => ({
    id: testCase.id,
    tier: testCase.tier,
    capability: testCase.capability,
    risk: testCase.risk,
    question: testCase.question,
    result: testCase.result,
    semantic_context: getPrivateDataChatAnswerSemanticContext(
      testCase.selectedKeys,
    ),
    expected: testCase.expected,
  }));

  return {
    suite_id: `${PRIVATE_DATA_CHAT_CAPABILITY_SUITE_VERSION}.answer`,
    suite_version: PRIVATE_DATA_CHAT_CAPABILITY_SUITE_VERSION,
    data_classification: "synthetic-no-production-rows",
    catalog_version: PRIVATE_DATA_CHAT_CATALOG_VERSION,
    catalog_checksum: PRIVATE_DATA_CHAT_CATALOG_CHECKSUM,
    answer_prompt_version: PRIVATE_DATA_CHAT_ANSWER_PROMPT_VERSION,
    cases,
  };
}

function endToEndDocument() {
  const cases = PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES.filter(
    (testCase) => testCase.kind === "end-to-end",
  );

  return {
    suite_id: `${PRIVATE_DATA_CHAT_CAPABILITY_SUITE_VERSION}.end-to-end`,
    suite_version: PRIVATE_DATA_CHAT_CAPABILITY_SUITE_VERSION,
    data_classification: "questions-and-structural-assertions-only",
    catalog_version: PRIVATE_DATA_CHAT_CATALOG_VERSION,
    cases,
  };
}

export function buildPrivateDataChatLiveEvaluationBundle(input: Readonly<{
  compilerSourceSha256: string;
  reviewDocumentSha256: string;
  benchmarkSourceSha256: string;
}>) {
  const plans = plannerDocument();
  const answers = answerDocument();
  const endToEnd = endToEndDocument();
  const summary = summarizePrivateDataChatCapabilitySuite("extended");

  return {
    documents: {
      plans,
      answers,
      endToEnd,
      plannerPrompt: PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT,
      answerPrompt: PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT,
      plannerSchema: PRIVATE_DATA_CHAT_PLAN_JSON_SCHEMA,
      answerSchema: PRIVATE_DATA_CHAT_ANSWER_JSON_SCHEMA,
    },
    manifest: {
      suite_id: PRIVATE_DATA_CHAT_CAPABILITY_SUITE_VERSION,
      approved_execution: {
        tier: "extended",
        diagnostic_repetitions: 1,
        clean_model_repetitions: 3,
        end_to_end_repetitions: 3,
      },
      counts: {
        total: summary.totalCases,
        planner: summary.byKind.planner ?? 0,
        answer: summary.byKind.answer ?? 0,
        end_to_end: summary.byKind["end-to-end"] ?? 0,
        clean_model_calls: (summary.byKind.planner ?? 0) * 3 +
          (summary.byKind.answer ?? 0) * 3,
      },
      contract: {
        catalog_version: PRIVATE_DATA_CHAT_CATALOG_VERSION,
        catalog_checksum: PRIVATE_DATA_CHAT_CATALOG_CHECKSUM,
        planner_prompt_version: PRIVATE_DATA_CHAT_PLANNER_PROMPT_VERSION,
        answer_prompt_version: PRIVATE_DATA_CHAT_ANSWER_PROMPT_VERSION,
        compiler_policy_version: PRIVATE_DATA_CHAT_POLICY_VERSION,
        model_artifact_sha256: PRIVATE_QWEN_MODEL_SHA256,
        runtime_revision: PRIVATE_QWEN_RUNTIME_REVISION,
      },
      hashes: {
        complete_suite_sha256: hashPrivateDataChatEvaluationValue(
          PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES,
        ),
        planner_cases_sha256: hashPrivateDataChatEvaluationValue(plans),
        answer_cases_sha256: hashPrivateDataChatEvaluationValue(answers),
        end_to_end_cases_sha256: hashPrivateDataChatEvaluationValue(endToEnd),
        planner_prompt_sha256: hashPrivateDataChatEvaluationText(
          PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT,
        ),
        answer_prompt_sha256: hashPrivateDataChatEvaluationText(
          PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT,
        ),
        planner_schema_sha256: hashPrivateDataChatEvaluationValue(
          PRIVATE_DATA_CHAT_PLAN_JSON_SCHEMA,
        ),
        answer_schema_sha256: hashPrivateDataChatEvaluationValue(
          PRIVATE_DATA_CHAT_ANSWER_JSON_SCHEMA,
        ),
        compiler_source_sha256: input.compilerSourceSha256,
        review_document_sha256: input.reviewDocumentSha256,
        benchmark_source_sha256: input.benchmarkSourceSha256,
      },
    },
  } as const;
}
