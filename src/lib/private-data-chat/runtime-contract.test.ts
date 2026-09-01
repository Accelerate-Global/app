import { describe, expect, it } from "vitest";

import {
  PRIVATE_DATA_CHAT_ANSWER_SCHEMA_CHECKSUM,
  PRIVATE_DATA_CHAT_PLANNER_SCHEMA_CHECKSUM,
  PRIVATE_DATA_CHAT_RUNTIME_CONTRACT,
  PRIVATE_DATA_CHAT_RUNTIME_CONTRACT_CHECKSUM,
  hashPrivateDataChatRuntimeContractValue,
} from "@/lib/private-data-chat/runtime-contract";

describe("private data chat runtime contract", () => {
  it("pins schemas, semantic policies, resource operations, and relationships", () => {
    expect(PRIVATE_DATA_CHAT_PLANNER_SCHEMA_CHECKSUM).toBe(
      "c8ef2f4ec1a1b29067831bc7eca5a0e12bec0814760a9ba34d33fcd47c981d3b",
    );
    expect(PRIVATE_DATA_CHAT_ANSWER_SCHEMA_CHECKSUM).toBe(
      "0ca0d0870ac2b4c6b1acd80182ce3c02f4d7cbade4b80a58978c1c2debe685bf",
    );
    expect(PRIVATE_DATA_CHAT_RUNTIME_CONTRACT.resourceOperations).toEqual([
      "search",
      "list",
      "lookup",
      "count",
      "continue",
    ]);
    expect(PRIVATE_DATA_CHAT_RUNTIME_CONTRACT.relationshipKeys).toEqual([
      "people_group_to_bound_rop3",
    ]);
    expect(PRIVATE_DATA_CHAT_RUNTIME_CONTRACT_CHECKSUM).toMatch(
      /^[0-9a-f]{64}$/u,
    );
  });

  it("uses canonical key ordering and changes on authority drift", () => {
    expect(hashPrivateDataChatRuntimeContractValue({ b: 2, a: 1 })).toBe(
      hashPrivateDataChatRuntimeContractValue({ a: 1, b: 2 }),
    );
    expect(
      hashPrivateDataChatRuntimeContractValue({
        ...PRIVATE_DATA_CHAT_RUNTIME_CONTRACT,
        relationshipKeys: ["unregistered_relationship"],
      }),
    ).not.toBe(PRIVATE_DATA_CHAT_RUNTIME_CONTRACT_CHECKSUM);
  });
});
