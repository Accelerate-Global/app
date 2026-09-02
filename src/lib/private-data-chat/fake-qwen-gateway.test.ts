import { describe, expect, it } from "vitest";

import {
  PRIVATE_DATA_CHAT_CATALOG_VERSION,
  getPrivateDataChatAnswerSemanticContext,
} from "@/lib/private-data-chat/catalog";
import { FakePrivateQwenGateway } from "@/lib/private-data-chat/fake-qwen-gateway";

describe("fake private Qwen gateway", () => {
  it("returns the sanitized expected plan for a known case", async () => {
    const gateway = new FakePrivateQwenGateway();
    const plan = await gateway.plan({
      messages: [
        {
          role: "user",
          content: "How many people groups are in the current primary dataset?",
        },
      ],
    });

    expect(plan).toMatchObject({
      decision: "query",
      query: { mode: "aggregate", metrics: ["people_group_count"] },
    });
  });

  it("keeps empty results explicit", async () => {
    const gateway = new FakePrivateQwenGateway();
    const answer = await gateway.answer({
      question: "Anything in Antarctica?",
      semanticContext: getPrivateDataChatAnswerSemanticContext(["people_id"]),
      result: {
        mode: "records",
        requestedLimit: 25,
        returnedCount: 0,
        matchingCount: 0,
        hasMore: false,
        selectedConcepts: ["people_id"],
        appliedNamedFilters: [],
        rows: [],
        provenance: {
          queryId: "8a000001-1337-403d-8eb5-b7c44a1be131",
          catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
          dataset: "primary_people_groups",
          datasetId: null,
          datasetVersionCreatedAt: null,
          rowCount: 0,
          filters: [{ field: "country", operator: "eq" }],
        },
      },
    });

    expect(answer.answer).toContain("No matching records");
    expect(answer.facts).toEqual([]);
  });

  it("matches a bounded multi-turn golden conversation", async () => {
    const gateway = new FakePrivateQwenGateway();
    const plan = await gateway.plan({
      messages: [
        { role: "user", content: "Which are the largest people groups?" },
        {
          role: "assistant",
          content:
            "Should largest mean highest recorded population, and how many people groups should I return?",
        },
        { role: "user", content: "By population. Five." },
      ],
    });

    expect(plan).toMatchObject({
      decision: "query",
      query: {
        catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
        fields: ["people_name", "population"],
        sort: [{ field: "population", direction: "desc" }],
        limit: 5,
      },
    });
  });
});
