import { describe, expect, it } from "vitest";

import {
  PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS,
  type SemanticEvaluationPartition,
} from "@/lib/private-data-chat/semantic-evaluation-corpus";

describe("private data chat semantic evaluation corpus", () => {
  it("freezes a broad human-labeled train/dev/holdout inventory", () => {
    expect(PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS).toHaveLength(36);
    expect(
      new Set(PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS.map((item) => item.stage)),
    ).toEqual(
      new Set(["retrieval", "planner", "answer", "end_to_end", "security"]),
    );
    expect(
      PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS.filter((item) => item.critical)
        .length,
    ).toBeGreaterThanOrEqual(28);
  });

  it("keeps intent and plan-skeleton groups inside one frozen partition", () => {
    const partitionsByIntent = new Map<string, Set<SemanticEvaluationPartition>>();
    const partitionsBySkeleton = new Map<string, Set<SemanticEvaluationPartition>>();

    for (const item of PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS) {
      const intentPartitions = partitionsByIntent.get(item.intentGroup) ?? new Set();
      intentPartitions.add(item.partition);
      partitionsByIntent.set(item.intentGroup, intentPartitions);

      const skeletonPartitions =
        partitionsBySkeleton.get(item.planSkeleton) ?? new Set();
      skeletonPartitions.add(item.partition);
      partitionsBySkeleton.set(item.planSkeleton, skeletonPartitions);
    }

    expect([...partitionsByIntent.values()].every((value) => value.size === 1)).toBe(
      true,
    );
    expect(
      [...partitionsBySkeleton.values()].every((value) => value.size === 1),
    ).toBe(true);
  });

  it("never permits dev or holdout cases to become demonstrations", () => {
    expect(
      PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS.filter(
        (item) => item.demonstrationEligible,
      ).every((item) => item.partition === "train"),
    ).toBe(true);
    expect(
      PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS.filter(
        (item) => item.partition === "holdout",
      ).every((item) => !item.demonstrationEligible),
    ).toBe(true);
  });

  it("carries explicit human relevance and hard-negative labels", () => {
    for (const item of PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS) {
      expect(item.humanRelevance.requiredCardKeys).toBeDefined();
      expect(item.humanRelevance.relevantCardKeys).toBeDefined();
      expect(item.humanRelevance.forbiddenCardKeys).toBeDefined();
    }

    expect(
      PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS.some(
        (item) => item.humanRelevance.forbiddenCardKeys.length > 0,
      ),
    ).toBe(true);
  });
});
