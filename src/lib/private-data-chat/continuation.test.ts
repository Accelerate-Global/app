import { describe, expect, it, vi } from "vitest";

import {
  consumePrivateDataChatContinuationToken,
  createPrivateDataChatContinuationToken,
  verifyPrivateDataChatContinuationToken,
} from "@/lib/private-data-chat/continuation";

const key = "continuation-test-key-that-is-at-least-thirty-two-bytes";
const versionId = "10000000-0000-4000-8000-000000000001";
const checksum = "a".repeat(64);
const conversationId = "20000000-0000-4000-8000-000000000002";

function token() {
  return createPrivateDataChatContinuationToken({
    ownerId: "owner-1",
    conversationId,
    resourceVersionId: versionId,
    resourceVersionChecksum: checksum,
    operation: "search",
    normalizedQuery: "sudan",
    cursor: "opaque-cursor",
    pageOffset: 25,
    limit: 25,
    key,
    now: 1_000,
    nonce: "30000000-0000-4000-8000-000000000003",
  });
}

describe("private data chat ROP continuation state", () => {
  it("binds cursor, ordering, query, identity, conversation, and exact version", () => {
    expect(
      verifyPrivateDataChatContinuationToken({
        token: token(),
        ownerId: "owner-1",
        conversationId,
        resourceVersionId: versionId,
        resourceVersionChecksum: checksum,
        key,
        now: 2_000,
      }),
    ).toMatchObject({
      cursor: "opaque-cursor",
      normalizedQuery: "sudan",
      ordering: "stable_key_ascending",
      pageOffset: 25,
    });
  });

  it.each([
    ["cross user", { ownerId: "owner-2" }],
    ["cross conversation", { conversationId: "40000000-0000-4000-8000-000000000004" }],
    ["stale version", { resourceVersionChecksum: "b".repeat(64) }],
    ["expired", { now: 2_000_000 }],
  ])("rejects %s state", (_label, override) => {
    expect(() =>
      verifyPrivateDataChatContinuationToken({
        token: token(),
        ownerId: "owner-1",
        conversationId,
        resourceVersionId: versionId,
        resourceVersionChecksum: checksum,
        key,
        now: 2_000,
        ...override,
      }),
    ).toThrow(/continuation is invalid/iu);
  });

  it("rejects tampering and one-time replay", async () => {
    expect(() =>
      verifyPrivateDataChatContinuationToken({
        token: `${token()}x`,
        ownerId: "owner-1",
        conversationId,
        resourceVersionId: versionId,
        resourceVersionChecksum: checksum,
        key,
        now: 2_000,
      }),
    ).toThrow(/signed state is invalid/iu);

    const recordUse = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const input = {
      token: token(),
      ownerId: "owner-1",
      conversationId,
      resourceVersionId: versionId,
      resourceVersionChecksum: checksum,
      key,
      now: 2_000,
    };
    await expect(
      consumePrivateDataChatContinuationToken(input, { recordUse }),
    ).resolves.toMatchObject({ cursor: "opaque-cursor" });
    await expect(
      consumePrivateDataChatContinuationToken(input, { recordUse }),
    ).rejects.toThrow(/already used/iu);
  });
});
