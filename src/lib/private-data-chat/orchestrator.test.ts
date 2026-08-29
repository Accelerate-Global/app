import { describe, expect, it, vi } from "vitest";

import type { CurrentIdentity } from "@/lib/auth";
import { orchestratePrivateDataChatTurn } from "@/lib/private-data-chat/orchestrator";
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

describe("private data chat orchestrator", () => {
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
          rows: [{ people_group_count: "3" }],
          provenance,
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
      content: "There are 3 people groups.",
      facts: ["people_group_count: 3"],
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
          rows: [{ people_group_count: "3" }],
          provenance,
        }),
      },
    });

    expect(result.content).toContain("verified values");
    expect(result.facts).toEqual(["people_group_count: 3"]);
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
