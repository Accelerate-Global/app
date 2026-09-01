import { describe, expect, it, vi } from "vitest";

import type { CurrentIdentity } from "@/lib/auth";
import { PRIVATE_DATA_CHAT_CATALOG_VERSION } from "@/lib/private-data-chat/catalog";
import {
  executePrivateDataChatQuery,
  stripPrivateDataChatInternalColumns,
} from "@/lib/private-data-chat/broker";
import { compilePrivateDataChatQuery } from "@/lib/private-data-chat/compiler";

const identity: CurrentIdentity = {
  ownerId: "9a000001-1337-403d-8eb5-b7c44a1be131",
  email: "admin@example.com",
  fullName: "Admin Example",
  workspaceRole: "admin",
  isDatasetAdmin: true,
  mode: "supabase",
};

const compiled = compilePrivateDataChatQuery({
  catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
  dataset: "primary_people_groups",
  mode: "aggregate",
  metrics: ["people_group_count"],
  dimensions: ["country"],
  filters: [{ field: "frontier_group", operator: "eq", value: true }],
  sort: [],
  limit: 10,
});

describe("executePrivateDataChatQuery", () => {
  it("returns bounded rows with provenance and a redacted audit template", async () => {
    const appendAudit = vi.fn().mockResolvedValue(undefined);
    const result = await executePrivateDataChatQuery({
      identity,
      compiled,
      retrievalAudit: {
        audience: "planner",
        semanticSnapshotChecksum: "b".repeat(64),
        retrievalPolicyChecksum: "c".repeat(64),
        retrievalTier: "exact-postgres-lexical",
        selectedCardKeys: ["metric.people_group_count"],
        selectedCardChecksums: ["d".repeat(64)],
        contextBytes: 512,
        latencyMs: 3,
      },
      dependencies: {
        runReadOnlyQuery: vi.fn().mockResolvedValue({
          rows: [{ country: "India", people_group_count: "2" }],
          matchingCount: 1,
          datasetId: "7a000001-1337-403d-8eb5-b7c44a1be131",
          datasetVersionCreatedAt: "2026-08-26T00:00:00.000Z",
        }),
        appendAudit,
        now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(125),
        createQueryId: () => "8a000001-1337-403d-8eb5-b7c44a1be131",
        pseudonymize: () => "a".repeat(64),
      },
    });

    expect(result.rows).toEqual([
      { country: "India", people_group_count: "2" },
    ]);
    expect(result.provenance).toMatchObject({
      queryId: "8a000001-1337-403d-8eb5-b7c44a1be131",
      rowCount: 1,
      filters: [{ field: "frontier_group", operator: "eq" }],
    });
    expect(result).toMatchObject({
      mode: "aggregate",
      requestedLimit: 10,
      returnedCount: 1,
      matchingCount: 1,
      hasMore: false,
      selectedConcepts: ["country", "people_group_count"],
      appliedNamedFilters: [],
    });
    expect(appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "executed",
        modelSha256:
          "671e47e0ec53c665d048b98c3ecbfd5236b5ca9c3e02ed19fc8f81f7b85140c7",
        runtimeRevision: "c1d0e7a004015f23bc0233470b747b596f29b264",
        sqlTemplate: expect.stringContaining("$1"),
        rowCount: 1,
        matchingCount: 1,
        requestedLimit: 10,
        queryMode: "aggregate",
        retrievalAudience: "planner",
        semanticSnapshotChecksum: "b".repeat(64),
        retrievalPolicyChecksum: "c".repeat(64),
        retrievalTier: "exact-postgres-lexical",
        retrievedCardKeys: ["metric.people_group_count"],
        retrievedCardChecksums: ["d".repeat(64)],
        contextBytes: 512,
      }),
    );
    expect(JSON.stringify(appendAudit.mock.calls)).not.toContain("true");
  });

  it("strips the internal window count and rejects inconsistent evidence", () => {
    expect(
      stripPrivateDataChatInternalColumns([
        { people_id: "PG-1", __matched_count: "3" },
        { people_id: "PG-2", __matched_count: BigInt(3) },
      ]),
    ).toEqual({
      rows: [{ people_id: "PG-1" }, { people_id: "PG-2" }],
      matchingCount: 3,
    });

    expect(() =>
      stripPrivateDataChatInternalColumns([
        { people_id: "PG-1", __matched_count: 3 },
        { people_id: "PG-2", __matched_count: 2 },
      ]),
    ).toThrow(/inconsistent/i);
  });

  it("normalizes provider failures and records only a stable reason", async () => {
    const appendAudit = vi.fn().mockResolvedValue(undefined);
    await expect(
      executePrivateDataChatQuery({
        identity,
        compiled,
        dependencies: {
          runReadOnlyQuery: vi.fn().mockRejectedValue(new Error("secret host error")),
          appendAudit,
          now: () => 100,
          createQueryId: () => "8a000001-1337-403d-8eb5-b7c44a1be131",
          pseudonymize: () => "a".repeat(64),
        },
      }),
    ).rejects.toMatchObject({ code: "query_failed" });

    expect(appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "failed",
        reasonCode: "query_failed",
        rowCount: null,
      }),
    );
    expect(JSON.stringify(appendAudit.mock.calls)).not.toContain("secret host error");
  });
});
