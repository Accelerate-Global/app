import { describe, expect, it } from "vitest";

import { getGeneratedRopCodeResource } from "@/lib/rop-codes";
import { runPrivateDataChatRopEntryBenchmark } from "@/lib/private-data-chat/rop-entry-benchmark";

describe("private data chat ROP entry retrieval benchmark", () => {
  it(
    "passes exact, hierarchy, description, place, language, geography, status, issue, and hard-negative gates",
    () => {
      const report = runPrivateDataChatRopEntryBenchmark({
        resource: getGeneratedRopCodeResource(),
        repetitions: 2,
      });
      expect(report.metrics.caseCount).toBeGreaterThanOrEqual(11);
      expect(report.metrics.exactRecallAt1).toBe(1);
      expect(report.metrics.recallAt6).toBeGreaterThanOrEqual(0.95);
      expect(report.metrics.hardNegativeAccuracy).toBe(1);
      expect(report.metrics.repeatable).toBe(true);
    },
    15_000,
  );
});
