import { describe, expect, it } from "vitest";

import { getPipelineRunDiagnostics } from "./diagnostics";
import type { PipelineRunSummary } from "./types";

const base: PipelineRunSummary = {
  id: "run-1",
  definitionKey: "source-imb-people-groups",
  definitionVersion: "v1",
  definitionChecksum: "a".repeat(64),
  correlationId: "correlation-1",
  launchKind: "manual",
  inputFingerprint: "b".repeat(64),
  status: "queued",
  currentStageKey: "ingest",
  actorOwnerId: "admin-1",
  actorEmail: null,
  progressCurrent: 0,
  progressTotal: 3,
  rowCount: null,
  warningCount: 0,
  errorCount: 0,
  publicationId: null,
  outOfDate: false,
  errorCode: null,
  errorMessage: null,
  stageCount: 3,
  completedStageCount: 0,
  retryCount: 0,
  startedAt: null,
  completedAt: null,
  createdAt: "2026-07-23T00:00:00.000Z",
  updatedAt: "2026-07-23T00:00:00.000Z",
};

describe("pipeline diagnostics", () => {
  it("reports review, stale-definition, and safe failure guidance", () => {
    expect(getPipelineRunDiagnostics({ ...base, status: "awaiting_review" })[0]?.code).toBe(
      "review-required",
    );
    expect(getPipelineRunDiagnostics({ ...base, outOfDate: true })[0]?.code).toBe(
      "definition-out-of-date",
    );
    expect(
      getPipelineRunDiagnostics({
        ...base,
        status: "failed",
        errorCode: "stage-adapter-missing",
        errorMessage: "No adapter",
      })[0],
    ).toMatchObject({ severity: "error", message: "No adapter" });
  });
});
