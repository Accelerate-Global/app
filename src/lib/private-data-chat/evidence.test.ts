import { describe, expect, it } from "vitest";

import {
  buildPrivateDataChatEvidenceLedger,
  privateDataChatAnswerHasVisibleProvenance,
  privateDataChatAnswerUsesOnlyEvidenceNumbers,
  renderPrivateDataChatGroundedAnswer,
} from "@/lib/private-data-chat/evidence";
import type { PrivateDataChatQueryResult } from "@/lib/private-data-chat/schemas";

function result(
  overrides: Partial<PrivateDataChatQueryResult> = {},
): PrivateDataChatQueryResult {
  return {
    mode: "records",
    requestedLimit: 100,
    returnedCount: 1,
    matchingCount: 1,
    hasMore: false,
    selectedConcepts: ["people_id"],
    appliedNamedFilters: [],
    rows: [{ people_id: "SYNTHETIC-1" }],
    provenance: {
      queryId: "8a000001-1337-403d-8eb5-b7c44a1be131",
      catalogVersion: "test",
      dataset: "primary_people_groups",
      datasetId: "7a000001-1337-403d-8eb5-b7c44a1be131",
      datasetVersionCreatedAt: "2026-08-26T00:00:00.000Z",
      rowCount: 1,
      filters: [],
    },
    ...overrides,
  };
}

describe("private data chat evidence ledger", () => {
  it("distinguishes matching, returned, and requested counts", () => {
    const queryResult = result({
      returnedCount: 100,
      matchingCount: 103,
      hasMore: true,
      rows: Array.from({ length: 100 }, (_, index) => ({
        people_id: `SYNTHETIC-${index + 1}`,
      })),
      provenance: { ...result().provenance, rowCount: 100 },
    });
    const rendered = renderPrivateDataChatGroundedAnswer({ result: queryResult });

    expect(rendered.answer).toBe("103 people groups match; showing 100.");
    expect(rendered.ledger.byId.get("result.matching_count")?.value).toBe(103);
    expect(rendered.ledger.byId.get("result.returned_count")?.value).toBe(100);
  });

  it("renders scalar metric facts with their approved unit", () => {
    const queryResult = result({
      mode: "aggregate",
      requestedLimit: 1,
      selectedConcepts: ["people_group_count"],
      rows: [{ people_group_count: "103" }],
    });
    const rendered = renderPrivateDataChatGroundedAnswer({ result: queryResult });

    expect(rendered.answer).toBe("People-group count: 103 people groups");
    expect(rendered.facts).toEqual([
      "People-group count: 103 people groups",
    ]);
  });

  it("rejects model-authored values absent from the evidence scope", () => {
    const queryResult = result({
      mode: "aggregate",
      requestedLimit: 1,
      selectedConcepts: ["people_group_count"],
      rows: [{ people_group_count: "103" }],
    });
    const ledger = buildPrivateDataChatEvidenceLedger(queryResult);

    expect(
      privateDataChatAnswerUsesOnlyEvidenceNumbers(
        { answer: "There are 103 people groups.", facts: [] },
        ledger,
      ),
    ).toBe(true);
    expect(
      privateDataChatAnswerUsesOnlyEvidenceNumbers(
        { answer: "There are 100 people groups.", facts: [] },
        ledger,
      ),
    ).toBe(false);

    const grounded = renderPrivateDataChatGroundedAnswer({
      result: queryResult,
      modelAnswer: { answer: "There are 100 people groups.", facts: [] },
    });
    expect(grounded.usedFallback).toBe(true);
    expect(grounded.answer).toBe("People-group count: 103 people groups");
  });

  it("rejects visible provenance even when it adds no unsupported number", () => {
    const queryResult = result({
      mode: "aggregate",
      requestedLimit: 1,
      selectedConcepts: ["people_group_count"],
      rows: [{ people_group_count: "1" }],
    });
    const modelAnswer = {
      answer: "There is 1 people group. Catalog version is current.",
      facts: [],
    };

    expect(privateDataChatAnswerHasVisibleProvenance(modelAnswer)).toBe(true);
    const grounded = renderPrivateDataChatGroundedAnswer({
      result: queryResult,
      modelAnswer,
    });
    expect(grounded.usedFallback).toBe(true);
    expect(grounded.answer).toBe("People-group count: 1 people groups");
  });
});
