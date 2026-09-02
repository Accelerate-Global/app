import { describe, expect, it, vi } from "vitest";

import {
  executePrivateDataChatResourceQuery,
  renderPrivateDataChatResourceResult,
} from "@/lib/private-data-chat/resource-query";
import type { RopCodeEntry } from "@/lib/rop-codes";

const identity = {
  ownerId: "owner-1",
  email: "admin@example.com",
  fullName: null,
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};
const conversationId = "20000000-0000-4000-8000-000000000002";
const key = "continuation-test-key-that-is-at-least-thirty-two-bytes";
const version = {
  id: "10000000-0000-4000-8000-000000000001",
  versionNumber: 7,
  contentChecksum: "a".repeat(64),
};

function entry(code: string, name: string): RopCodeEntry {
  return {
    id: `rop3:${code}`,
    rowType: "rop3-person",
    rop1: { code: "1", name: "Affinity", display: "1 — Affinity" },
    rop2: { code: "12", name: "Cluster", display: "12 — Cluster" },
    rop25: { code: "1234", name: "People", display: "1234 — People" },
    rop3: { code, name, display: `${code} — ${name}` },
    status: "Active",
    place: "Sudan",
    language: "Example",
    source: "HIS",
    ethnicId: null,
    directRop2: "12",
    joinIssue: null,
    joinIssueLabel: null,
  };
}

const rows = [entry("119434", "Tassomi"), entry("119435", "Lamira")];

function dependencies() {
  return {
    getActive: vi.fn().mockResolvedValue({
      version,
      payload: { entries: rows },
    }),
    countEntries: vi.fn().mockResolvedValue(52),
    queryEntries: vi.fn().mockResolvedValue({
      entries: rows,
      nextCursor: "cursor-2",
      version,
    }),
    createContinuation: vi.fn().mockReturnValue("signed-next"),
    consumeContinuation: vi.fn(),
    appendAudit: vi.fn().mockResolvedValue(undefined),
    createQueryId: vi.fn().mockReturnValue("30000000-0000-4000-8000-000000000003"),
    now: vi.fn().mockReturnValue(1_000),
    pseudonymize: vi.fn().mockReturnValue("pseudonymous-owner"),
  };
}

describe("private data chat ROP resource queries", () => {
  it("gives exact code lookup precedence and labels the immutable version", async () => {
    const result = await executePrivateDataChatResourceQuery({
      identity,
      conversationId,
      continuationKey: key,
      resourceQuery: {
        resourceKey: "rop-codes",
        operation: "lookup",
        query: null,
        lookupKey: "119434",
        continuationToken: null,
        limit: 25,
      },
      dependencies: dependencies() as never,
    });
    expect(result).toMatchObject({
      returnedCount: 1,
      matchingCount: 1,
      resourceVersion: version,
      entries: [{ rop3: { code: "119434" } }],
    });
  });

  it("returns bounded stable pages with completeness, export, and signed next state", async () => {
    const deps = dependencies();
    const result = await executePrivateDataChatResourceQuery({
      identity,
      conversationId,
      continuationKey: key,
      resourceQuery: {
        resourceKey: "rop-codes",
        operation: "search",
        query: "Sudan",
        lookupKey: null,
        continuationToken: null,
        limit: 25,
      },
      dependencies: deps as never,
    });
    expect(result).toMatchObject({
      requestedLimit: 25,
      pageOffset: 0,
      returnedCount: 2,
      matchingCount: 52,
      hasMore: true,
      continuationToken: "signed-next",
      exportUrl: "/api/reference-resources/rop-codes/download?search=sudan",
    });
    expect(deps.createContinuation).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "cursor-2", pageOffset: 2 }),
    );
    expect(renderPrivateDataChatResourceResult(result).content).toBe(
      "52 ROP entries match; showing 1–2.",
    );
    expect(deps.appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        queryMode: "resource",
        resourceKey: "rop-codes",
        resourceOperation: "search",
        resourceVersionId: version.id,
        rowCount: 2,
        matchingCount: 52,
        sqlTemplate: null,
      }),
    );
    expect(JSON.stringify(deps.appendAudit.mock.calls)).not.toContain("Sudan");
    expect(JSON.stringify(deps.appendAudit.mock.calls)).not.toContain("Tassomi");
  });

  it("uses only token-bound query, cursor, limit, and version on continuation", async () => {
    const deps = dependencies();
    deps.consumeContinuation.mockResolvedValue({
      operation: "search",
      normalizedQuery: "sudan",
      cursor: "cursor-2",
      pageOffset: 50,
      limit: 25,
    });
    deps.queryEntries.mockResolvedValue({ entries: rows, nextCursor: null, version });
    const result = await executePrivateDataChatResourceQuery({
      identity,
      conversationId,
      continuationKey: key,
      resourceQuery: {
        resourceKey: "rop-codes",
        operation: "continue",
        query: null,
        lookupKey: null,
        continuationToken: "signed-current",
        limit: 1,
      },
      dependencies: deps as never,
    });
    expect(deps.queryEntries).toHaveBeenCalledWith(
      expect.objectContaining({ search: "sudan", cursor: "cursor-2", limit: 25 }),
    );
    expect(result).toMatchObject({ pageOffset: 50, hasMore: false });
  });

  it("returns bounded ambiguity choices and a count without row injection", async () => {
    const ambiguous = [entry("119434", "Shared"), entry("119435", "Shared")];
    const deps = dependencies();
    deps.getActive.mockResolvedValue({ version, payload: { entries: ambiguous } });
    const result = await executePrivateDataChatResourceQuery({
      identity,
      conversationId,
      continuationKey: key,
      resourceQuery: {
        resourceKey: "rop-codes",
        operation: "lookup",
        query: null,
        lookupKey: "Shared",
        continuationToken: null,
        limit: 25,
      },
      dependencies: deps as never,
    });
    expect(result).toMatchObject({
      returnedCount: 0,
      matchingCount: 2,
      ambiguityChoices: [{ rop3: { code: "119434" } }, { rop3: { code: "119435" } }],
    });
  });
});
