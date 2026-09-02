import { describe, expect, it } from "vitest";

import {
  PRIVATE_DATA_CHAT_RELATIONSHIP_REGISTRY,
  PRIVATE_DATA_CHAT_RESOURCE_OPERATION_REGISTRY,
  PRIVATE_DATA_CHAT_ROP_QUERYABLE_FIELD_KEYS,
  PRIVATE_DATA_CHAT_SEMANTIC_AUTHORITY_CHECKSUM,
} from "@/lib/private-data-chat/semantic-authority";

describe("private data chat semantic authority", () => {
  it("freezes complete read-only ROP operations and no lifecycle mutations", () => {
    expect(
      PRIVATE_DATA_CHAT_RESOURCE_OPERATION_REGISTRY.resources["rop-codes"]
        .operations,
    ).toEqual(["search", "list", "lookup", "count", "continue"]);
    expect(
      PRIVATE_DATA_CHAT_RESOURCE_OPERATION_REGISTRY.resources["rop-codes"]
        .maxPageSize,
    ).toBe(25);
    expect(
      PRIVATE_DATA_CHAT_RESOURCE_OPERATION_REGISTRY.resources["rop-codes"]
        .lifecycleMutations,
    ).toBe(false);
  });

  it("allows only the version-bound null-preserving ROP3 relationship", () => {
    expect(
      PRIVATE_DATA_CHAT_RELATIONSHIP_REGISTRY.relationships
        .people_group_to_bound_rop3,
    ).toMatchObject({
      cardinality: "many-to-one",
      joinBehavior: "left-null-preserving",
      versionPolicy: "dataset-production-lineage",
      modelMaySelectPhysicalKeys: false,
    });
    expect(PRIVATE_DATA_CHAT_ROP_QUERYABLE_FIELD_KEYS).toContain("rop3_code");
    expect(PRIVATE_DATA_CHAT_ROP_QUERYABLE_FIELD_KEYS).toContain(
      "rop_match_status",
    );
    expect(PRIVATE_DATA_CHAT_SEMANTIC_AUTHORITY_CHECKSUM).toMatch(
      /^[0-9a-f]{64}$/u,
    );
  });
});
