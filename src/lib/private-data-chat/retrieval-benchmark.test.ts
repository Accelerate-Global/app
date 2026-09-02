import { describe, expect, it } from "vitest";

import { runPrivateDataChatRetrievalBenchmark } from "@/lib/private-data-chat/retrieval-benchmark";
import { buildPrivateDataChatSemanticContextPackage } from "@/lib/private-data-chat/semantic-context";

describe("private data chat frozen retrieval benchmark", () => {
  it("reports deterministic human-labeled gates independently from Qwen", async () => {
    const semanticPackage = buildPrivateDataChatSemanticContextPackage({
      sourceRetrievedAt: "2026-08-31T00:00:00.000Z",
    }).package;
    const report = await runPrivateDataChatRetrievalBenchmark({
      package: semanticPackage,
      repetitions: 2,
    });
    expect(report.metrics.caseCount).toBeGreaterThanOrEqual(36);
    expect(report.metrics.forbiddenSelectionCount).toBe(0);
    expect(report.metrics.maximumContextBytes).toBeLessThanOrEqual(8 * 1024);
    // The standalone review command owns the 25 ms wall-clock promotion gate.
    // Parallel Vitest scheduling is intentionally not a performance oracle.
    expect(Number.isFinite(report.metrics.lexicalP95Ms)).toBe(true);
    expect(report.metrics.repeatable).toBe(true);
  });
});
