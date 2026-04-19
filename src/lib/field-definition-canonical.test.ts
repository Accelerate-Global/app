import { describe, expect, it } from "vitest";

import {
  getFieldDefinitionCanonicalKeyFromLabel,
  getFieldDefinitionCanonicalKeyLookupKeys,
  resolveFieldDefinitionCanonicalKey,
} from "./field-definition-canonical";

describe("field-definition canonical keys", () => {
  it("resolves frontier group aliases to the canonical key", () => {
    expect(resolveFieldDefinitionCanonicalKey("frontier_group")).toBe(
      "christianity_frontier_group",
    );
    expect(
      resolveFieldDefinitionCanonicalKey("christianity_frontier_group"),
    ).toBe("christianity_frontier_group");
  });

  it("derives the same canonical key from both frontier labels", () => {
    expect(
      getFieldDefinitionCanonicalKeyFromLabel("Frontier_Group", 0),
    ).toBe("christianity_frontier_group");
    expect(
      getFieldDefinitionCanonicalKeyFromLabel(
        "Christianity_Frontier_Group",
        4,
      ),
    ).toBe("christianity_frontier_group");
  });

  it("returns lookup keys for the canonical frontier field", () => {
    expect(
      getFieldDefinitionCanonicalKeyLookupKeys(
        "christianity_frontier_group",
      ),
    ).toEqual(["christianity_frontier_group", "frontier_group"]);
  });
});
