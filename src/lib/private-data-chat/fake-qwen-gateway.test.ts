import { describe, expect, it } from "vitest";

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
      result: {
        rows: [],
        provenance: {
          queryId: "8a000001-1337-403d-8eb5-b7c44a1be131",
          catalogVersion: "primary-people-groups-v1",
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
});
