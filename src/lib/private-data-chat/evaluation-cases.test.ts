import { describe, expect, it } from "vitest";

import { PRIVATE_DATA_CHAT_CATALOG_VERSION } from "@/lib/private-data-chat/catalog";
import { compilePrivateDataChatQuery } from "@/lib/private-data-chat/compiler";
import { PRIVATE_DATA_CHAT_EVALUATION_CASES } from "@/lib/private-data-chat/evaluation-cases";
import { privateDataChatPlanSchema } from "@/lib/private-data-chat/schemas";
import { PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION } from "@/lib/private-data-chat/named-filters";

describe("private data chat evaluation cases", () => {
  it("covers the required semantic and adversarial behavior classes", () => {
    expect(PRIVATE_DATA_CHAT_EVALUATION_CASES.length).toBeGreaterThanOrEqual(22);
    expect(
      new Set(PRIVATE_DATA_CHAT_EVALUATION_CASES.map((testCase) => testCase.category)),
    ).toEqual(
      new Set([
        "aggregation",
        "records",
        "filtering",
        "geography",
        "empty-result",
        "boundary",
        "clarification",
        "unsupported",
        "multi-turn",
        "security",
      ]),
    );
  });

  it("contains unique schema-valid sanitized golden decisions", () => {
    const ids = new Set<string>();

    for (const testCase of PRIVATE_DATA_CHAT_EVALUATION_CASES) {
      expect(ids.has(testCase.id)).toBe(false);
      ids.add(testCase.id);
      privateDataChatPlanSchema.parse(testCase.expectedPlan);

      if (testCase.conversation) {
        expect(testCase.conversation.at(-1)?.role).toBe("user");
        expect(testCase.conversation).toHaveLength(3);
      }

      if (testCase.expectedPlan.decision === "query") {
        expect(testCase.expectedPlan.query.catalogVersion).toBe(
          PRIVATE_DATA_CHAT_CATALOG_VERSION,
        );
        expect(testCase.expectedPlan.query.namedFilterRegistryVersion).toBe(
          PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
        );
        expect(testCase.expectedPlan.query.namedFilters).toEqual([]);
        expect(testCase.expectedCompilation).toBeDefined();
      } else {
        expect(testCase.expectedCompilation).toBeUndefined();
      }
    }
  });

  it("compiles every golden query to the expected concepts and parameters", () => {
    for (const testCase of PRIVATE_DATA_CHAT_EVALUATION_CASES) {
      if (testCase.expectedPlan.decision !== "query") continue;

      const compiled = compilePrivateDataChatQuery(testCase.expectedPlan.query);

      expect(compiled.catalogVersion, testCase.id).toBe(
        PRIVATE_DATA_CHAT_CATALOG_VERSION,
      );
      expect(compiled.selectedKeys, testCase.id).toEqual(
        testCase.expectedCompilation?.selectedKeys,
      );
      expect(compiled.parameters, testCase.id).toEqual(
        testCase.expectedCompilation?.parameters,
      );
      expect(compiled.text, testCase.id).toMatch(/^SELECT\n/u);
      expect(compiled.text, testCase.id).not.toContain(";");

      for (const parameter of compiled.parameters.slice(0, -1)) {
        const values = Array.isArray(parameter) ? parameter : [parameter];
        for (const value of values) {
          if (typeof value === "string" && value.length > 0) {
            expect(compiled.text, testCase.id).not.toContain(value);
          }
        }
      }
    }
  });
});
