import { describe, expect, it } from "vitest";

import { compilePrivateDataChatQuery } from "@/lib/private-data-chat/compiler";
import { PRIVATE_DATA_CHAT_EVALUATION_CASES } from "@/lib/private-data-chat/evaluation-cases";
import { privateDataChatPlanSchema } from "@/lib/private-data-chat/schemas";

describe("private data chat evaluation cases", () => {
  it("contains unique schema-valid sanitized cases", () => {
    const ids = new Set<string>();

    for (const testCase of PRIVATE_DATA_CHAT_EVALUATION_CASES) {
      expect(ids.has(testCase.id)).toBe(false);
      ids.add(testCase.id);
      privateDataChatPlanSchema.parse(testCase.expectedPlan);
    }
  });

  it("compiles every expected query without embedding user values", () => {
    for (const testCase of PRIVATE_DATA_CHAT_EVALUATION_CASES) {
      if (testCase.expectedPlan.decision !== "query") {
        continue;
      }

      const compiled = compilePrivateDataChatQuery(testCase.expectedPlan.query);

      for (const parameter of compiled.parameters.slice(0, -1)) {
        if (typeof parameter === "string") {
          expect(compiled.text).not.toContain(parameter);
        }
      }
    }
  });
});
