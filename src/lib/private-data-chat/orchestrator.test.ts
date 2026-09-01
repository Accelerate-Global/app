import { afterEach, describe, expect, it, vi } from "vitest";

import type { CurrentIdentity } from "@/lib/auth";
import {
  inheritPrivateDataChatViewContext,
  orchestratePrivateDataChatTurn,
} from "@/lib/private-data-chat/orchestrator";
import { PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION } from "@/lib/private-data-chat/named-filters";
import { PrivateDataChatBrokerError } from "@/lib/private-data-chat/broker";
import { PRIVATE_DATA_CHAT_CATALOG_VERSION } from "@/lib/private-data-chat/catalog";
import { PrivateQwenGatewayError } from "@/lib/private-data-chat/qwen-gateway";

const identity: CurrentIdentity = {
  ownerId: "owner-1",
  email: "admin@example.com",
  fullName: null,
  workspaceRole: "admin",
  isDatasetAdmin: true,
  mode: "supabase",
};

const provenance = {
  queryId: "8a000001-1337-403d-8eb5-b7c44a1be131",
  catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
  dataset: "primary_people_groups" as const,
  datasetId: "7a000001-1337-403d-8eb5-b7c44a1be131",
  datasetVersionCreatedAt: "2026-08-26T00:00:00.000Z",
  rowCount: 1,
  filters: [],
};

const aggregateResult = {
  mode: "aggregate" as const,
  requestedLimit: 1,
  returnedCount: 1,
  matchingCount: 1,
  hasMore: false,
  selectedConcepts: ["people_group_count" as const],
  appliedNamedFilters: [],
  rows: [{ people_group_count: "3" }],
  provenance,
};

describe("private data chat orchestrator", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses off-topic questions before Qwen when reviewed retrieval has no domain evidence", async () => {
    vi.stubEnv("PRIVATE_DATA_CHAT_SEMANTIC_CONTEXT_ENABLED", "true");
    vi.stubEnv("PRIVATE_DATA_CHAT_TURN_STATE_HMAC_KEY", "t".repeat(40));
    vi.stubEnv("PRIVATE_DATA_CHAT_VIEW_CONTEXT_HMAC_KEY", "v".repeat(40));
    vi.stubEnv("PRIVATE_DATA_CHAT_CONTINUATION_HMAC_KEY", "c".repeat(40));
    const plan = vi.fn();
    const result = await orchestratePrivateDataChatTurn({
      identity,
      messages: [{ role: "user", content: "Write a poem about a bicycle." }],
      dependencies: {
        gateway: { plan, answer: vi.fn() },
        loadSemanticContext: vi.fn().mockResolvedValue({
          version: { contentChecksum: "a".repeat(64) },
          payload: {},
        }),
        retrieveSemanticContext: vi.fn().mockResolvedValue({
          status: "clarify",
          reason: "semantic-retrieval-low-confidence",
          missingKeys: [],
          views: [],
        }),
      } as never,
    });
    expect(result.content).toMatch(/only help with Accelerate Global/iu);
    expect(plan).not.toHaveBeenCalled();
  });

  it("passes only structural reviewed-retrieval lineage into the broker audit", async () => {
    vi.stubEnv("PRIVATE_DATA_CHAT_SEMANTIC_CONTEXT_ENABLED", "true");
    vi.stubEnv("PRIVATE_DATA_CHAT_TURN_STATE_HMAC_KEY", "t".repeat(40));
    vi.stubEnv("PRIVATE_DATA_CHAT_VIEW_CONTEXT_HMAC_KEY", "v".repeat(40));
    vi.stubEnv("PRIVATE_DATA_CHAT_CONTINUATION_HMAC_KEY", "c".repeat(40));
    const retrieval = {
      status: "ready" as const,
      snapshotChecksum: "a".repeat(64),
      definitionPackageChecksum: "b".repeat(64),
      policyVersion: "semantic-retrieval-v1.1.exact-fts-coverage",
      policyChecksum: "c".repeat(64),
      views: [],
      items: [
        {
          stableKey: "metric.people_group_count",
          contentChecksum: "d".repeat(64),
        },
      ],
      serialized: "{}",
      bytes: 2,
      exactKeys: ["metric.people_group_count"],
    };
    const executeQuery = vi.fn().mockResolvedValue(aggregateResult);
    await orchestratePrivateDataChatTurn({
      identity,
      messages: [{ role: "user", content: "Count people groups." }],
      conversationId: "20000000-0000-4000-8000-000000000002",
      dependencies: {
        loadSemanticContext: vi.fn().mockResolvedValue({
          version: { contentChecksum: "a".repeat(64) },
          payload: {},
        }),
        retrieveSemanticContext: vi.fn().mockResolvedValue(retrieval),
        gateway: {
          plan: vi.fn().mockResolvedValue({
            decision: "query",
            reason: "Count records.",
            query: {
              catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
              dataset: "primary_people_groups",
              mode: "aggregate",
              metrics: ["people_group_count"],
              dimensions: [],
              filters: [],
              sort: [],
              limit: 1,
            },
          }),
          answer: vi.fn().mockResolvedValue({
            answer: "There are 3 people groups.",
            facts: ["people_group_count: 3"],
          }),
        },
        executeQuery,
      } as never,
    });
    expect(executeQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        retrievalAudit: expect.objectContaining({
          audience: "planner",
          semanticSnapshotChecksum: "a".repeat(64),
          retrievalPolicyChecksum: "c".repeat(64),
          retrievalTier: "exact-postgres-lexical",
          selectedCardKeys: ["metric.people_group_count"],
          selectedCardChecksums: ["d".repeat(64)],
          contextBytes: 2,
        }),
      }),
    );
    expect(JSON.stringify(executeQuery.mock.calls)).not.toContain(
      "Count people groups.",
    );
  });
  it("inherits verified current-view filters, overrides the same field, and supports explicit all-data replacement", () => {
    const currentView = {
      filters: [{ field: "country", operator: "eq", value: "Sudan" }],
      namedFilters: [
        {
          key: "uupg",
          version: 1,
          options: {
            globalEngagementAnywhereEnabled: true,
            frontierGroupEnabled: true,
          },
        },
      ],
      sort: [],
    } as never;
    const query = {
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
      namedFilterRegistryVersion: PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
      dataset: "primary_people_groups" as const,
      mode: "aggregate" as const,
      metrics: ["people_group_count" as const],
      dimensions: [],
      filters: [],
      namedFilters: [],
      sort: [],
      limit: 1,
    };
    expect(
      inheritPrivateDataChatViewContext({
        query,
        currentView,
        question: "How many match this view?",
      }),
    ).toMatchObject({
      filters: [{ value: "Sudan" }],
      namedFilters: [{ key: "uupg" }],
    });
    expect(
      inheritPrivateDataChatViewContext({
        query: {
          ...query,
          filters: [{ field: "country", operator: "eq", value: "India" }],
        },
        currentView,
        question: "What about India instead?",
      }).filters,
    ).toEqual([{ field: "country", operator: "eq", value: "India" }]);
    expect(
      inheritPrivateDataChatViewContext({
        query,
        currentView,
        question: "Ignore the current view and count the entire dataset.",
      }),
    ).toEqual(query);
  });
  it("returns clarifications without querying", async () => {
    const executeQuery = vi.fn();
    const result = await orchestratePrivateDataChatTurn({
      identity,
      messages: [{ role: "user", content: "Which are largest?" }],
      dependencies: {
        gateway: {
          plan: vi.fn().mockResolvedValue({
            decision: "clarify",
            question: "Largest by population?",
            reason: "Metric is ambiguous.",
          }),
          answer: vi.fn(),
        },
        executeQuery,
      },
    });

    expect(result).toEqual({
      content: "Largest by population?",
      facts: [],
      provenance: null,
    });
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it("emits stages and grounds the final answer in broker results", async () => {
    const stages: string[] = [];
    const answer = vi.fn().mockResolvedValue({
      answer: "There are 3 people groups.",
      facts: ["people_group_count: 3"],
    });
    const result = await orchestratePrivateDataChatTurn({
      identity,
      messages: [
        {
          role: "user",
          content: "How many people groups are in the current primary dataset?",
        },
      ],
      onStage: (stage) => stages.push(stage),
      dependencies: {
        gateway: {
          plan: vi.fn().mockResolvedValue({
            decision: "query",
            reason: "Count records.",
            query: {
              catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
              dataset: "primary_people_groups",
              mode: "aggregate",
              metrics: ["people_group_count"],
              dimensions: [],
              filters: [],
              sort: [],
              limit: 1,
            },
          }),
          answer,
        },
        executeQuery: vi.fn().mockResolvedValue({
          ...aggregateResult,
        }),
      },
    });

    expect(stages).toEqual([
      "interpreting",
      "validating",
      "querying",
      "explaining",
    ]);
    expect(result).toEqual({
      content:
        "People-group count: 3 people groups\n\nThere are 3 people groups.",
      facts: ["People-group count: 3 people groups"],
      provenance,
    });
    expect(answer).toHaveBeenCalledWith(
      expect.objectContaining({
        semanticContext: expect.objectContaining({
          catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
          concepts: [
            expect.objectContaining({
              key: "people_group_count",
              unit: "people groups",
            }),
          ],
        }),
      }),
    );
  });

  it("returns deterministic value ambiguity without querying or asking Qwen again", async () => {
    const plan = vi.fn().mockResolvedValue({
      decision: "query",
      reason: "Filter by country.",
      query: {
        catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
        dataset: "primary_people_groups",
        mode: "records",
        fields: ["people_id"],
        filters: [{ field: "country", operator: "eq", value: "Congo" }],
        sort: [],
        limit: 25,
      },
    });
    const executeQuery = vi.fn();
    const result = await orchestratePrivateDataChatTurn({
      identity,
      messages: [{ role: "user", content: "List groups in Congo." }],
      dependencies: {
        gateway: { plan, answer: vi.fn() },
        executeQuery,
        resolveValues: vi.fn().mockResolvedValue({
          status: "clarify",
          question: "Which approved country named Congo did you mean?",
          reason: "Country alias is ambiguous.",
        }),
      },
    });

    expect(result).toEqual({
      content: "Which approved country named Congo did you mean?",
      facts: [],
      provenance: null,
    });
    expect(plan).toHaveBeenCalledOnce();
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it("keeps a verified result when explanation inference fails", async () => {
    const result = await orchestratePrivateDataChatTurn({
      identity,
      messages: [{ role: "user", content: "Count all." }],
      dependencies: {
        gateway: {
          plan: vi.fn().mockResolvedValue({
            decision: "query",
            reason: "Count records.",
            query: {
              catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
              dataset: "primary_people_groups",
              mode: "aggregate",
              metrics: ["people_group_count"],
              dimensions: [],
              filters: [],
              sort: [],
              limit: 1,
            },
          }),
          answer: vi
            .fn()
            .mockRejectedValue(
              new PrivateQwenGatewayError("timeout", "timed out", true),
            ),
        },
        executeQuery: vi.fn().mockResolvedValue({
          ...aggregateResult,
        }),
      },
    });

    expect(result.content).toBe("People-group count: 3 people groups");
    expect(result.facts).toEqual(["People-group count: 3 people groups"]);
    expect(result.provenance).toEqual(provenance);
  });

  it("fails closed when the analytical database is offline", async () => {
    await expect(
      orchestratePrivateDataChatTurn({
        identity,
        messages: [{ role: "user", content: "Count all." }],
        dependencies: {
          gateway: {
            plan: vi.fn().mockResolvedValue({
              decision: "query",
              reason: "Count records.",
              query: {
                catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
                dataset: "primary_people_groups",
                mode: "aggregate",
                metrics: ["people_group_count"],
                dimensions: [],
                filters: [],
                sort: [],
                limit: 1,
              },
            }),
            answer: vi.fn(),
          },
          executeQuery: vi
            .fn()
            .mockRejectedValue(
              new PrivateDataChatBrokerError(
                "query_failed",
                "Database unavailable.",
              ),
            ),
        },
      }),
    ).rejects.toMatchObject({ code: "query_failed" });
  });

  it("allows one schema-constrained repair before query execution", async () => {
    const plan = vi
      .fn()
      .mockResolvedValueOnce({
        decision: "query",
        reason: "Invalid selected sort.",
        query: {
          catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
          dataset: "primary_people_groups",
          mode: "records",
          fields: ["people_id"],
          filters: [],
          sort: [{ field: "country", direction: "asc" }],
          limit: 10,
        },
      })
      .mockResolvedValueOnce({
        decision: "query",
        reason: "Use only a selected stable sort.",
        query: {
          catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
          dataset: "primary_people_groups",
          mode: "records",
          fields: ["people_id"],
          filters: [],
          sort: [{ field: "people_id", direction: "asc" }],
          limit: 10,
        },
      });
    const executeQuery = vi.fn().mockResolvedValue({
      mode: "records",
      requestedLimit: 10,
      returnedCount: 1,
      matchingCount: 1,
      hasMore: false,
      selectedConcepts: ["people_id"],
      appliedNamedFilters: [],
      rows: [{ people_id: "PG-1" }],
      provenance,
    });

    await orchestratePrivateDataChatTurn({
      identity,
      messages: [{ role: "user", content: "List ten people IDs." }],
      dependencies: {
        gateway: {
          plan,
          answer: vi.fn().mockResolvedValue({
            answer: "The returned people ID is PG-1.",
            facts: ["people_id: PG-1"],
          }),
        },
        executeQuery,
      },
    });

    expect(plan).toHaveBeenCalledTimes(2);
    expect(plan.mock.calls[1]?.[0].messages).toHaveLength(3);
    expect(executeQuery).toHaveBeenCalledOnce();
  });
});
