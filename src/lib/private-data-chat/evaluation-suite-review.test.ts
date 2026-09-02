import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES } from "@/lib/private-data-chat/evaluation-suite";
import { renderPrivateDataChatEvaluationReview } from "@/lib/private-data-chat/evaluation-suite-review";

const committedReviewPath = path.join(
  process.cwd(),
  "docs/operations/private-data-chat-evaluation-suite-v4-review.md",
);

describe("private data chat evaluation review inventory", () => {
  it("renders deterministically without executing any case", () => {
    const first = renderPrivateDataChatEvaluationReview();
    const second = renderPrivateDataChatEvaluationReview();

    expect(first).toBe(second);
    expect(first).toContain("Status: APPROVED FOR EXECUTION");
    expect(first).toContain("Total proposed cases:** 450");
    expect(first).not.toMatch(/\n\n$/u);
    expect(first.match(/^### \d+\. /gmu)).toHaveLength(
      PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES.length,
    );
  });

  it("enumerates every structured case in source order", () => {
    const review = renderPrivateDataChatEvaluationReview();

    PRIVATE_DATA_CHAT_CAPABILITY_EVALUATION_CASES.forEach(
      (testCase, index) => {
        expect(review).toContain(`### ${index + 1}. \`${testCase.id}\``);
      },
    );
  });

  it("matches the committed human review document byte for byte", () => {
    expect(readFileSync(committedReviewPath, "utf8")).toBe(
      renderPrivateDataChatEvaluationReview(),
    );
  });
});
