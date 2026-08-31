import { isDeepStrictEqual } from "node:util";

import {
  PRIVATE_DATA_CHAT_CATALOG_VERSION,
  PRIVATE_DATA_CHAT_DIMENSION_KEYS,
  PRIVATE_DATA_CHAT_FIELDS,
  PRIVATE_DATA_CHAT_FILTER_KEYS,
  PRIVATE_DATA_CHAT_METRIC_KEYS,
  PRIVATE_DATA_CHAT_RECORD_FIELD_KEYS,
  getPrivateDataChatAnswerSemanticContext,
} from "@/lib/private-data-chat/catalog";
import { compilePrivateDataChatQuery } from "@/lib/private-data-chat/compiler";
import {
  PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES,
  getPrivateDataChatCasesForTier,
} from "@/lib/private-data-chat/evaluation-suite";
import {
  getPrivateDataChatCaseInputText,
  type PrivateDataChatCapabilityEvaluationCase,
  type PrivateDataChatTextRubric,
} from "@/lib/private-data-chat/evaluation-suite-types";
import {
  privateDataChatPlanSchema,
  privateDataChatQueryResultSchema,
  privateDataChatRequestSchema,
} from "@/lib/private-data-chat/schemas";

export type PrivateDataChatEvaluationValidationIssue = Readonly<{
  code: string;
  message: string;
  caseId?: string;
}>;

function normalizeInput(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

function rubricHasPositiveExpectation(rubric: PrivateDataChatTextRubric | undefined) {
  return Boolean(
    rubric &&
      ((rubric.requiredAll?.length ?? 0) > 0 ||
        (rubric.requiredAny?.length ?? 0) > 0),
  );
}

function caseSignature(testCase: PrivateDataChatCapabilityEvaluationCase) {
  if (testCase.kind === "answer") {
    return normalizeInput(
      `${testCase.kind}\n${testCase.question}\n${JSON.stringify(testCase.result.rows)}`,
    );
  }

  return normalizeInput(
    `${testCase.kind}\n${testCase.messages
      .map((message) => `${message.role}:${message.content}`)
      .join("\n")}`,
  );
}

function issue(
  issues: PrivateDataChatEvaluationValidationIssue[],
  code: string,
  message: string,
  caseId?: string,
) {
  issues.push({ code, message, ...(caseId ? { caseId } : {}) });
}

function validatePlannerCase(
  testCase: Extract<PrivateDataChatCapabilityEvaluationCase, { kind: "planner" }>,
  issues: PrivateDataChatEvaluationValidationIssue[],
) {
  const request = privateDataChatRequestSchema.safeParse({
    messages: testCase.messages,
  });
  if (!request.success) {
    issue(issues, "planner-messages", request.error.message, testCase.id);
  }

  const plan = privateDataChatPlanSchema.safeParse(testCase.expectedPlan);
  if (!plan.success) {
    issue(issues, "planner-plan", plan.error.message, testCase.id);
    return;
  }

  if (plan.data.decision !== "query") {
    if (testCase.expectedCompilation) {
      issue(
        issues,
        "non-query-compilation",
        "A clarification or answer case must not declare compiled SQL expectations.",
        testCase.id,
      );
    }
    if (!rubricHasPositiveExpectation(testCase.textRubric)) {
      issue(
        issues,
        "non-query-rubric",
        "A clarification or answer case requires a positive deterministic text rubric.",
        testCase.id,
      );
    }
    return;
  }

  if (!testCase.expectedCompilation) {
    issue(
      issues,
      "query-compilation-missing",
      "A query case must declare expected selected keys and parameters.",
      testCase.id,
    );
    return;
  }

  if (plan.data.query.catalogVersion !== PRIVATE_DATA_CHAT_CATALOG_VERSION) {
    issue(
      issues,
      "stale-catalog",
      "The expected plan does not use the active catalog version.",
      testCase.id,
    );
  }

  try {
    const compiled = compilePrivateDataChatQuery(plan.data.query);
    if (
      !isDeepStrictEqual(
        compiled.selectedKeys,
        testCase.expectedCompilation.selectedKeys,
      )
    ) {
      issue(
        issues,
        "selected-keys",
        `Expected ${JSON.stringify(testCase.expectedCompilation.selectedKeys)} but compiled ${JSON.stringify(compiled.selectedKeys)}.`,
        testCase.id,
      );
    }
    if (
      !isDeepStrictEqual(
        compiled.parameters,
        testCase.expectedCompilation.parameters,
      )
    ) {
      issue(
        issues,
        "parameters",
        `Expected ${JSON.stringify(testCase.expectedCompilation.parameters)} but compiled ${JSON.stringify(compiled.parameters)}.`,
        testCase.id,
      );
    }
    if (!compiled.text.startsWith("SELECT\n") || compiled.text.includes(";")) {
      issue(
        issues,
        "compiled-shape",
        "Compiled output must be one semicolon-free SELECT.",
        testCase.id,
      );
    }

    for (const parameter of compiled.parameters.slice(0, -1)) {
      const values = Array.isArray(parameter) ? parameter : [parameter];
      for (const value of values) {
        if (
          typeof value === "string" &&
          value.length > 1 &&
          compiled.text.includes(value)
        ) {
          issue(
            issues,
            "parameter-in-sql",
            "A user/model string value appeared inside compiled SQL text.",
            testCase.id,
          );
        }
      }
    }
  } catch (error) {
    issue(
      issues,
      "compile-error",
      error instanceof Error ? error.message : String(error),
      testCase.id,
    );
  }
}

function validateAnswerCase(
  testCase: Extract<PrivateDataChatCapabilityEvaluationCase, { kind: "answer" }>,
  issues: PrivateDataChatEvaluationValidationIssue[],
) {
  const result = privateDataChatQueryResultSchema.safeParse(testCase.result);
  if (!result.success) {
    issue(issues, "answer-result", result.error.message, testCase.id);
    return;
  }

  if (
    result.data.provenance.catalogVersion !==
    PRIVATE_DATA_CHAT_CATALOG_VERSION
  ) {
    issue(
      issues,
      "answer-catalog",
      "The answer fixture does not use the active catalog version.",
      testCase.id,
    );
  }
  if (result.data.provenance.rowCount !== result.data.rows.length) {
    issue(
      issues,
      "answer-row-count",
      "Synthetic provenance row count does not match the fixture rows.",
      testCase.id,
    );
  }
  if (testCase.expected.emptyResult !== (result.data.rows.length === 0)) {
    issue(
      issues,
      "answer-empty",
      "The empty-result rubric disagrees with the fixture rows.",
      testCase.id,
    );
  }
  if (testCase.expected.maximumFacts < 1 || testCase.expected.maximumFacts > 20) {
    issue(
      issues,
      "answer-fact-limit",
      "Answer fact limits must remain within the structured response schema.",
      testCase.id,
    );
  }
  if (!rubricHasPositiveExpectation(testCase.expected.textRubric)) {
    issue(
      issues,
      "answer-rubric",
      "Every answer case requires a positive deterministic text rubric.",
      testCase.id,
    );
  }

  const semanticContext = getPrivateDataChatAnswerSemanticContext(
    testCase.selectedKeys,
  );
  if (semanticContext.concepts.length !== new Set(testCase.selectedKeys).size) {
    issue(
      issues,
      "answer-semantic-context",
      "One or more selected answer keys did not resolve to semantic context.",
      testCase.id,
    );
  }

  for (const key of testCase.expected.requiredFactKeys) {
    if (!testCase.selectedKeys.includes(key as never)) {
      issue(
        issues,
        "answer-fact-key",
        `Required fact key ${key} is not a selected semantic concept.`,
        testCase.id,
      );
    }
  }

  const serializedRows = JSON.stringify(result.data.rows);
  for (const value of testCase.expected.requiredFactValues) {
    if (!serializedRows.includes(value)) {
      issue(
        issues,
        "answer-fact-value",
        `Required grounded value ${JSON.stringify(value)} is absent from the synthetic rows.`,
        testCase.id,
      );
    }
  }
}

function validateEndToEndCase(
  testCase: Extract<PrivateDataChatCapabilityEvaluationCase, { kind: "end-to-end" }>,
  issues: PrivateDataChatEvaluationValidationIssue[],
) {
  const request = privateDataChatRequestSchema.safeParse({
    messages: testCase.messages,
  });
  if (!request.success) {
    issue(issues, "e2e-messages", request.error.message, testCase.id);
  }
  if (
    !testCase.tags.includes("approval-required") ||
    !testCase.tags.includes("read-only")
  ) {
    issue(
      issues,
      "e2e-approval",
      "Every end-to-end case must be explicitly approval-gated and read-only.",
      testCase.id,
    );
  }

  const mutatingPattern =
    /\b(delete|update|insert|publish|export|email|download|create\s+table|drop\s+table)\b/iu;
  if (mutatingPattern.test(getPrivateDataChatCaseInputText(testCase))) {
    issue(
      issues,
      "e2e-mutation",
      "End-to-end review cases must not request mutations or distribution actions.",
      testCase.id,
    );
  }

  if (testCase.expected.decision === "clarify") {
    if (!rubricHasPositiveExpectation(testCase.expected.textRubric)) {
      issue(
        issues,
        "e2e-clarify-rubric",
        "An end-to-end clarification requires a positive text rubric.",
        testCase.id,
      );
    }
    return;
  }

  if (
    testCase.expected.rowCount.minimum < 0 ||
    testCase.expected.rowCount.maximum > 100 ||
    testCase.expected.rowCount.minimum > testCase.expected.rowCount.maximum
  ) {
    issue(
      issues,
      "e2e-row-bound",
      "End-to-end row assertions must remain within the broker's 0-100 row bound.",
      testCase.id,
    );
  }
  if (testCase.expected.selectedKeys.length === 0) {
    issue(
      issues,
      "e2e-selected-keys",
      "A query case requires at least one selected semantic key.",
      testCase.id,
    );
  }
  for (const field of testCase.expected.filterFields) {
    if (!(PRIVATE_DATA_CHAT_FILTER_KEYS as readonly string[]).includes(field)) {
      issue(
        issues,
        "e2e-filter-field",
        `End-to-end filter field ${field} is not approved.`,
        testCase.id,
      );
    }
  }
}

function validateCoverage(
  issues: PrivateDataChatEvaluationValidationIssue[],
) {
  const plannerQueries = PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES.filter(
    (
      testCase,
    ): testCase is Extract<
      PrivateDataChatCapabilityEvaluationCase,
      { kind: "planner" }
    > => testCase.kind === "planner",
  ).filter(
    (testCase) => testCase.expectedPlan.decision === "query",
  );
  const metrics = new Set<string>();
  const dimensions = new Set<string>();
  const fields = new Set<string>();
  const filterOperators = new Set<string>();
  const nullFields = new Set<string>();
  const limits = new Set<number>();
  const sortDirections = new Set<string>();

  for (const testCase of plannerQueries) {
    if (testCase.expectedPlan.decision !== "query") continue;
    const query = testCase.expectedPlan.query;
    limits.add(query.limit);
    query.sort.forEach((sort) => sortDirections.add(sort.direction));
    query.filters.forEach((filter) => {
      filterOperators.add(`${filter.field}:${filter.operator}`);
      if (filter.value === null) nullFields.add(filter.field);
    });
    if (query.mode === "aggregate") {
      query.metrics.forEach((metric) => metrics.add(metric));
      query.dimensions.forEach((dimension) => dimensions.add(dimension));
    } else {
      query.fields.forEach((field) => fields.add(field));
    }
  }

  const expectedSets: readonly [string, readonly string[], Set<string>][] = [
    ["metric", PRIVATE_DATA_CHAT_METRIC_KEYS, metrics],
    ["dimension", PRIVATE_DATA_CHAT_DIMENSION_KEYS, dimensions],
    ["record field", PRIVATE_DATA_CHAT_RECORD_FIELD_KEYS, fields],
    ["nullable filter field", PRIVATE_DATA_CHAT_FILTER_KEYS, nullFields],
  ];
  for (const [label, expected, actual] of expectedSets) {
    for (const value of expected) {
      if (!actual.has(value)) {
        issue(
          issues,
          "coverage",
          `The suite does not cover approved ${label} ${value}.`,
        );
      }
    }
  }

  for (const fieldKey of PRIVATE_DATA_CHAT_FILTER_KEYS) {
    for (const operator of PRIVATE_DATA_CHAT_FIELDS[fieldKey].operators) {
      if (!filterOperators.has(`${fieldKey}:${operator}`)) {
        issue(
          issues,
          "coverage",
          `The suite does not cover ${fieldKey}:${operator}.`,
        );
      }
    }
  }
  if (!limits.has(1) || !limits.has(100)) {
    issue(issues, "coverage", "The suite must cover both limit boundaries 1 and 100.");
  }
  if (!sortDirections.has("asc") || !sortDirections.has("desc")) {
    issue(issues, "coverage", "The suite must cover ascending and descending sorts.");
  }
}

export function validatePrivateDataChatCapabilitySuite(
  cases: readonly PrivateDataChatCapabilityEvaluationCase[] =
    PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES,
) {
  const issues: PrivateDataChatEvaluationValidationIssue[] = [];
  const ids = new Set<string>();
  const signatures = new Set<string>();

  if (cases.length < 200) {
    issue(issues, "suite-size", "The capability suite must contain at least 200 cases.");
  }
  if (
    cases.filter(
      (testCase) =>
        testCase.kind === "planner" && testCase.source === "v3-baseline",
    ).length !== 23
  ) {
    issue(issues, "baseline-size", "The suite must preserve all 23 v3 baseline cases.");
  }

  const smokeCount = getPrivateDataChatCasesForTier(cases, "smoke").length;
  const coreCount = getPrivateDataChatCasesForTier(cases, "core").length;
  const extendedCount = getPrivateDataChatCasesForTier(cases, "extended").length;
  if (!(smokeCount >= 20 && coreCount > smokeCount && extendedCount > coreCount)) {
    issue(
      issues,
      "tier-shape",
      "Smoke, core, and extended tiers must be cumulative and strictly increasing.",
    );
  }

  for (const testCase of cases) {
    if (!/^(v3|v4)-[a-z0-9][a-z0-9-]*$/u.test(testCase.id)) {
      issue(issues, "case-id", "Case ID is not stable kebab-case.", testCase.id);
    }
    if (ids.has(testCase.id)) {
      issue(issues, "duplicate-id", "Case ID is duplicated.", testCase.id);
    }
    ids.add(testCase.id);

    const signature = caseSignature(testCase);
    if (signatures.has(signature)) {
      issue(
        issues,
        "duplicate-input",
        "An identical input and fixture already exist for this evaluation kind.",
        testCase.id,
      );
    }
    signatures.add(signature);

    if (testCase.rationale.trim().length < 20) {
      issue(
        issues,
        "rationale",
        "Each case requires a substantive review rationale.",
        testCase.id,
      );
    }
    if (testCase.tags.length === 0 || testCase.tags.some((tag) => tag.trim() === "")) {
      issue(issues, "tags", "Each case requires non-empty tags.", testCase.id);
    }

    if (testCase.kind === "planner") validatePlannerCase(testCase, issues);
    if (testCase.kind === "answer") validateAnswerCase(testCase, issues);
    if (testCase.kind === "end-to-end") validateEndToEndCase(testCase, issues);
  }

  const serialized = JSON.stringify(cases);
  const forbiddenSensitivePatterns: readonly [RegExp, string][] = [
    [/@risencode\.org/iu, "a production user email"],
    [/data\.accelerateglobal\.org/iu, "the production application hostname"],
    [/workers\.dev/iu, "a Cloudflare worker hostname"],
    [/\b(?:192\.168|10\.77)\.[0-9.]+\b/iu, "a private infrastructure address"],
    [/postgres(?:ql)?:\/\//iu, "a database URL"],
    [/PRIVATE_QWEN_[A-Z_]+=/u, "a configured secret assignment"],
    [/-----BEGIN [A-Z ]+PRIVATE KEY-----/u, "a private key"],
  ];
  for (const [pattern, label] of forbiddenSensitivePatterns) {
    if (pattern.test(serialized)) {
      issue(issues, "sensitive-content", `The suite contains ${label}.`);
    }
  }

  validateCoverage(issues);
  return issues;
}
