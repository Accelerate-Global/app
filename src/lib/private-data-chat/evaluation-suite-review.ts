import {
  PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES,
  PRIVATE_DATA_CHAT_CAPABILITY_SUITE_VERSION,
  summarizePrivateDataChatCapabilitySuite,
} from "@/lib/private-data-chat/evaluation-suite";
import type {
  PrivateDataChatCapabilityEvaluationCase,
  PrivateDataChatTextRubric,
} from "@/lib/private-data-chat/evaluation-suite-types";

function jsonBlock(value: unknown) {
  return `\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;
}

function renderRubric(rubric: PrivateDataChatTextRubric | undefined) {
  if (!rubric) return "No free-text assertion; structured semantics are authoritative.";
  return jsonBlock(rubric).trim();
}

function renderPlannerCase(
  testCase: Extract<PrivateDataChatCapabilityEvaluationCase, { kind: "planner" }>,
) {
  const lines = [
    "**Conversation**",
    jsonBlock(testCase.messages).trim(),
    "",
    "**Expected planner decision**",
    jsonBlock(testCase.expectedPlan).trim(),
  ];

  if (testCase.expectedCompilation) {
    lines.push(
      "",
      "**Expected deterministic compilation semantics**",
      jsonBlock(testCase.expectedCompilation).trim(),
    );
  }
  if (testCase.textRubric) {
    lines.push("", "**Text rubric**", renderRubric(testCase.textRubric));
  }

  return lines.join("\n");
}

function renderAnswerCase(
  testCase: Extract<PrivateDataChatCapabilityEvaluationCase, { kind: "answer" }>,
) {
  return [
    "**Question**",
    jsonBlock(testCase.question).trim(),
    "",
    `**Selected semantic keys:** ${testCase.selectedKeys.map((key) => `\`${key}\``).join(", ")}`,
    "",
    "**Synthetic bounded result**",
    jsonBlock(testCase.result).trim(),
    "",
    "**Grounding and narration rubric**",
    jsonBlock(testCase.expected).trim(),
  ].join("\n");
}

function renderEndToEndCase(
  testCase: Extract<
    PrivateDataChatCapabilityEvaluationCase,
    { kind: "end-to-end" }
  >,
) {
  return [
    "**Conversation**",
    jsonBlock(testCase.messages).trim(),
    "",
    "**Structural full-path assertion**",
    jsonBlock(testCase.expected).trim(),
    "",
    "This case is defined for later execution only after separate approval.",
  ].join("\n");
}

function renderCase(testCase: PrivateDataChatCapabilityEvaluationCase, index: number) {
  const common = [
    `### ${index + 1}. \`${testCase.id}\``,
    "",
    `- **Kind:** ${testCase.kind}`,
    `- **Declared tier:** ${testCase.tier}`,
    `- **Capability:** ${testCase.capability}`,
    `- **Risk:** ${testCase.risk}`,
    `- **Tags:** ${testCase.tags.map((tag) => `\`${tag}\``).join(", ")}`,
    `- **Why this case exists:** ${testCase.rationale}`,
    ...(testCase.expectedModelCalls === undefined
      ? []
      : [`- **Expected model calls:** ${testCase.expectedModelCalls}`]),
    "",
  ];

  if (testCase.kind === "planner") {
    common.push(renderPlannerCase(testCase));
  } else if (testCase.kind === "answer") {
    common.push(renderAnswerCase(testCase));
  } else {
    common.push(renderEndToEndCase(testCase));
  }

  return `${common.join("\n")}\n`;
}

function renderTierTable() {
  const summaries = (["smoke", "core", "extended"] as const).map((tier) =>
    summarizePrivateDataChatCapabilitySuite(tier),
  );
  return [
    "| Cumulative tier | Cases | Planner | Grounded answer | End to end | Estimated model calls for one repetition | Three repetitions |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...summaries.map(
      (summary) =>
        `| ${summary.requestedTier} | ${summary.totalCases} | ${summary.byKind.planner ?? 0} | ${summary.byKind.answer ?? 0} | ${summary.byKind["end-to-end"] ?? 0} | ${summary.estimatedInferenceCalls} | ${summary.estimatedInferenceCalls * 3} |`,
    ),
  ].join("\n");
}

function renderCapabilityTable() {
  const summary = summarizePrivateDataChatCapabilitySuite("extended");
  return [
    "| Capability | Cases |",
    "| --- | ---: |",
    ...Object.entries(summary.byCapability)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([capability, count]) => `| ${capability} | ${count} |`),
  ].join("\n");
}

export function renderPrivateDataChatEvaluationReview() {
  const summary = summarizePrivateDataChatCapabilitySuite("extended");
  const sections = [
    "# Private Data Chat Capability Evaluation Suite v6 — Review Inventory",
    "",
    "> **Status: APPROVED FOR EXECUTION.** This sanitized inventory remains generation-only; live execution is recorded separately in hash-bound receipts.",
    "",
    `- **Suite version:** \`${PRIVATE_DATA_CHAT_CAPABILITY_SUITE_VERSION}\``,
    `- **Total proposed cases:** ${summary.totalCases}`,
    `- **Compatibility baseline:** 23 unchanged v3 planner cases`,
    `- **Full one-repetition estimate:** ${summary.estimatedInferenceCalls} model calls`,
    "- **Private production values committed:** none; answer fixtures are synthetic and full-path cases use structural assertions",
    "",
    "## What the three kinds measure",
    "",
    "- **Planner:** whether a conversation becomes the exact approved semantic decision, query shape, selected concepts, and out-of-line parameters.",
    "- **Grounded answer:** whether Qwen narrates only supplied synthetic rows using the selected units and null meanings.",
    "- **End to end:** later, separately approved read-only checks across the application, protected gateway, local Qwen, deterministic compiler, broker, provenance, and answer path.",
    "",
    "## Proposed execution tiers",
    "",
    "Tiers are cumulative. The model-call estimate counts one planner or answer call per isolated case and two calls for an end-to-end query that reaches grounded narration, except explicitly deterministic cases that declare zero model calls.",
    "",
    renderTierTable(),
    "",
    "## Coverage by capability",
    "",
    renderCapabilityTable(),
    "",
    "## Review checklist",
    "",
    "- [ ] Every prompt and preceding conversation turn is acceptable.",
    "- [ ] Every expected semantic plan or clarification matches the intended business meaning.",
    "- [ ] Synthetic answer fixtures and grounding rubrics are appropriate.",
    "- [ ] The desired first-run tier is selected: smoke, core, or extended.",
    "- [ ] End-to-end cases are either separately approved or explicitly excluded from the first run.",
    "- [ ] The desired repetition count is selected after a one-repetition diagnostic pass.",
    "",
    "## Scoring rules",
    "",
    "- Query cases compare the structured decision and query contract; free-form planner reason wording is not deep-equaled.",
    "- Every expected query must validate against the current catalog and compile to the listed selected keys and positional parameters.",
    "- Clarifications and refusals use required and forbidden text concepts while requiring that no query run.",
    "- Grounded answers must cover the listed fact keys and synthetic values, obey the text rubric, and add no unsupported numeric or causal claim.",
    "- End-to-end cases use only bounded structural properties and provenance; the repository stores no private result snapshot.",
    "",
    "## Complete case inventory",
    "",
    ...PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES.map(renderCase),
  ];

  return `${sections.join("\n").trimEnd()}\n`;
}
