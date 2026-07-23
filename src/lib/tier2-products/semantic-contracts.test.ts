import { describe, expect, it } from "vitest";

import {
  TIER2_FORMING_ENGINE_CHECKSUM,
  TIER2_FORMING_ENGINE_VERSION,
  TIER2_IDENTITY_TRANSFORMATION_CHECKSUM,
  TIER2_IDENTITY_TRANSFORMATION_VERSION,
  TIER2_PARTNER_FLOW_SEMANTIC_DEPENDENCIES,
} from "./semantic-contracts";

describe("Tier 2 partner semantic contracts", () => {
  it("exposes stable forming and identity dependencies for flow fingerprints", () => {
    expect(TIER2_FORMING_ENGINE_VERSION).toBe("tier2-partner-forming-v1");
    expect(TIER2_IDENTITY_TRANSFORMATION_VERSION).toBe(
      "tier2-partner-identity-v1",
    );
    expect(TIER2_FORMING_ENGINE_CHECKSUM).toMatch(/^[0-9a-f]{64}$/u);
    expect(TIER2_IDENTITY_TRANSFORMATION_CHECKSUM).toMatch(
      /^[0-9a-f]{64}$/u,
    );
    expect(TIER2_PARTNER_FLOW_SEMANTIC_DEPENDENCIES).toEqual([
      expect.objectContaining({
        kind: "source-engine",
        key: "tier2-partner-forming",
      }),
      expect.objectContaining({
        kind: "transformation-contract",
        key: "tier2-partner-identity",
      }),
    ]);
  });
});
