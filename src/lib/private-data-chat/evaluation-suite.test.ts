import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PRIVATE_DATA_CHAT_EVALUATION_CASES } from "@/lib/private-data-chat/evaluation-cases";
import {
  PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES,
  summarizePrivateDataChatCapabilitySuite,
} from "@/lib/private-data-chat/evaluation-suite";
import { PRIVATE_DATA_CHAT_END_TO_END_CAPABILITY_CASES } from "@/lib/private-data-chat/evaluation-suite-end-to-end";
import { validatePrivateDataChatCapabilitySuite } from "@/lib/private-data-chat/evaluation-suite-validation";
import type { PrivateDataChatPlannerEvaluationCase } from "@/lib/private-data-chat/evaluation-suite-types";

const suiteSourceFiles = [
  "evaluation-suite.ts",
  "evaluation-suite-types.ts",
  "evaluation-suite-planner.ts",
  "evaluation-suite-planner-helpers.ts",
  "evaluation-suite-planner-supported.ts",
  "evaluation-suite-planner-boundaries.ts",
  "evaluation-suite-planner-semantic-rag.ts",
  "evaluation-suite-answer.ts",
  "evaluation-suite-end-to-end.ts",
  "evaluation-suite-validation.ts",
  "evaluation-suite-review.ts",
  "evaluation-suite-export.ts",
] as const;

describe("private data chat capability evaluation suite", () => {
  it("contains 436 reviewable cases across the three isolated evaluation kinds", () => {
    const summary = summarizePrivateDataChatCapabilitySuite("extended");

    expect(summary.totalCases).toBe(436);
    expect(summary.estimatedInferenceCalls).toBe(457);
    expect(summary.byKind).toEqual({
      planner: 374,
      answer: 38,
      "end-to-end": 24,
    });
    expect(summary.byDeclaredTier).toEqual({
      smoke: 40,
      core: 164,
      extended: 232,
    });
  });

  it("keeps smoke and core as cumulative strict subsets", () => {
    const smoke = summarizePrivateDataChatCapabilitySuite("smoke");
    const core = summarizePrivateDataChatCapabilitySuite("core");
    const extended = summarizePrivateDataChatCapabilitySuite("extended");

    expect(smoke.totalCases).toBe(40);
    expect(smoke.estimatedInferenceCalls).toBe(42);
    expect(core.totalCases).toBe(204);
    expect(core.estimatedInferenceCalls).toBe(217);
    expect(extended.totalCases).toBeGreaterThan(core.totalCases);
  });

  it("preserves every v3 golden input, plan, and compilation expectation", () => {
    const baseline = PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES.filter(
      (testCase): testCase is PrivateDataChatPlannerEvaluationCase =>
        testCase.kind === "planner" && testCase.source === "v3-baseline",
    );

    expect(baseline).toHaveLength(PRIVATE_DATA_CHAT_EVALUATION_CASES.length);
    for (const original of PRIVATE_DATA_CHAT_EVALUATION_CASES) {
      const wrapped = baseline.find(
        (testCase) => testCase.id === `v3-${original.id}`,
      );
      expect(wrapped?.expectedPlan).toEqual(original.expectedPlan);
      expect(wrapped?.expectedCompilation).toEqual(original.expectedCompilation);
      expect(wrapped?.messages).toEqual(
        original.conversation ?? [{ role: "user", content: original.question }],
      );
    }
  });

  it("keeps remediated natural-language cases precise without overfitting wording", () => {
    const plannerCase = (id: string) =>
      PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES.find(
        (testCase): testCase is PrivateDataChatPlannerEvaluationCase =>
          testCase.kind === "planner" && testCase.id === id,
      );

    expect(
      plannerCase("v4-record-percent-evangelical-bounded")?.messages[0]
        ?.content,
    ).toContain("evangelical percentage values");
    expect(
      plannerCase("v4-clarify-engaged-meaning-ambiguous")?.messages[0]
        ?.content,
    ).toContain("globally engaged, or in a particular engagement phase");
    expect(
      plannerCase("v4-clarify-geographic-referent-missing")?.expectedPlan,
    ).toMatchObject({
      decision: "clarify",
      question: expect.stringContaining("What does there refer to"),
    });
    expect(
      plannerCase("v3-mutation-refusal")?.textRubric?.requiredAny?.[0],
    ).toContain("deleting");
    expect(
      plannerCase("v3-macro-country-join-unavailable")?.textRubric
        ?.requiredAny?.[1],
    ).toContain("dataset-bound ROP");
    expect(
      plannerCase("v4-clarify-forecast-unavailable")?.textRubric
        ?.requiredAny?.[0],
    ).toContain("does not include");
    expect(
      plannerCase("v4-clarify-forecast-unavailable")?.textRubric
        ?.requiredAny?.[0],
    ).toContain("not an approved");
    expect(
      plannerCase("v4-clarify-macro-region-unavailable")?.textRubric
        ?.requiredAny?.[0],
    ).toContain("not 'macro region'");
    expect(
      plannerCase("v4-clarify-office-join-unavailable")?.textRubric
        ?.requiredAny?.[1],
    ).toContain("not registered");
    expect(
      plannerCase("v4-refuse-reveal-system-prompt")?.textRubric
        ?.requiredAny?.[0],
    ).toContain("system instruction");
    expect(
      PRIVATE_DATA_CHAT_END_TO_END_CAPABILITY_CASES.find(
        (testCase) => testCase.id === "v4-e2e-average-evangelical",
      )?.expected.textRubric,
    ).toEqual({ requiredAny: [["percent", "percentage"]] });
    expect(
      PRIVATE_DATA_CHAT_END_TO_END_CAPABILITY_CASES.find(
        (testCase) => testCase.id === "v4-e2e-congo-display-name-records",
      )?.expected,
    ).toMatchObject({
      decision: "query",
      selectedKeys: ["people_id"],
      filterFields: ["country"],
      rowCount: { minimum: 0, maximum: 10 },
    });
  });

  it("passes deterministic schema, compiler, sanitization, and coverage checks", () => {
    expect(validatePrivateDataChatCapabilitySuite()).toEqual([]);
  });

  it("keeps suite definitions and validation free of network-bearing imports", () => {
    const forbiddenImports = [
      "qwen-gateway",
      "broker",
      "@supabase",
      "node:http",
      "node:https",
      "private-data-chat/config",
    ];

    for (const fileName of suiteSourceFiles) {
      const source = readFileSync(
        path.join(
          process.cwd(),
          "src/lib/private-data-chat",
          fileName,
        ),
        "utf8",
      );
      const importedModules = [
        ...source.matchAll(/from\s+["']([^"']+)["']/gu),
      ].map((match) => match[1]);

      for (const importedModule of importedModules) {
        expect(
          forbiddenImports.some((forbidden) =>
            importedModule.includes(forbidden),
          ),
          `${fileName} imports ${importedModule}`,
        ).toBe(false);
      }
      expect(source, `${fileName} contains a fetch call`).not.toMatch(
        /\bfetch\s*\(/u,
      );
      expect(source, `${fileName} reads environment configuration`).not.toMatch(
        /process\.env/u,
      );
    }
  });
});
