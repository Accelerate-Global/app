import { describe, expect, it } from "vitest";

import { PRIVATE_DATA_CHAT_CATALOG_VERSION } from "@/lib/private-data-chat/catalog";
import { compilePrivateDataChatQuery } from "@/lib/private-data-chat/compiler";
import {
  createPrivateDataChatTurnStateToken,
  verifyPrivateDataChatTurnStateToken,
} from "@/lib/private-data-chat/turn-state";
import type { PrivateDataChatQueryResult } from "@/lib/private-data-chat/schemas";

const key = "turn-state-test-key-that-is-at-least-32-characters";
const ownerId = "9a000001-1337-403d-8eb5-b7c44a1be131";
const conversationId = "9b000001-1337-403d-8eb5-b7c44a1be131";
const compiled = compilePrivateDataChatQuery({
  catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
  dataset: "primary_people_groups",
  mode: "records",
  fields: ["people_id"],
  filters: [],
  sort: [],
  limit: 100,
});
const result: PrivateDataChatQueryResult = {
  mode: "records",
  requestedLimit: 100,
  returnedCount: 100,
  matchingCount: 103,
  hasMore: true,
  selectedConcepts: ["people_id"],
  appliedNamedFilters: [],
  rows: Array.from({ length: 100 }, (_, index) => ({
    people_id: `SYNTHETIC-${index + 1}`,
  })),
  provenance: {
    queryId: "8a000001-1337-403d-8eb5-b7c44a1be131",
    catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
    dataset: "primary_people_groups",
    datasetId: "7a000001-1337-403d-8eb5-b7c44a1be131",
    datasetVersionCreatedAt: "2026-08-26T00:00:00.000Z",
    rowCount: 100,
    filters: [],
  },
};

describe("private data chat turn state", () => {
  it("round-trips bounded evidence without raw rows or owner identity", () => {
    const token = createPrivateDataChatTurnStateToken({
      ownerId,
      conversationId,
      compiled,
      result,
      key,
      now: 1_000,
      ttlMs: 10_000,
    });
    const verified = verifyPrivateDataChatTurnStateToken({
      token,
      ownerId,
      conversationId,
      key,
      now: 2_000,
    });

    expect(verified).toMatchObject({
      matchingCount: 103,
      returnedCount: 100,
      hasMore: true,
      selectedConcepts: ["people_id"],
    });
    expect(token).not.toContain(ownerId);
    expect(token).not.toContain("SYNTHETIC-1");
  });

  it("rejects tamper, cross-user, cross-conversation, and expiry", () => {
    const token = createPrivateDataChatTurnStateToken({
      ownerId,
      conversationId,
      compiled,
      result,
      key,
      now: 1_000,
      ttlMs: 1_000,
    });

    expect(() =>
      verifyPrivateDataChatTurnStateToken({
        token: `${token.slice(0, -1)}x`,
        ownerId,
        conversationId,
        key,
        now: 1_500,
      }),
    ).toThrow();
    expect(() =>
      verifyPrivateDataChatTurnStateToken({
        token,
        ownerId: "other-user",
        conversationId,
        key,
        now: 1_500,
      }),
    ).toThrow();
    expect(() =>
      verifyPrivateDataChatTurnStateToken({
        token,
        ownerId,
        conversationId: "9c000001-1337-403d-8eb5-b7c44a1be131",
        key,
        now: 1_500,
      }),
    ).toThrow();
    expect(() =>
      verifyPrivateDataChatTurnStateToken({
        token,
        ownerId,
        conversationId,
        key,
        now: 2_000,
      }),
    ).toThrow();
  });
});
