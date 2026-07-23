import { describe, expect, it } from "vitest";

import { checksumProductValue } from "@/lib/tier1-products";

import {
  inferTier1ReleaseInputKey,
  validateFinalizePipelineReleaseInput,
} from "./release-sets";
import type { FinalizePipelineReleaseInput } from "./types";

const priorities = [{ canonicalField: "PG_Name", prioritySourceKeys: ["jp", "imb"] }];

function input(overrides: Partial<FinalizePipelineReleaseInput> = {}): FinalizePipelineReleaseInput {
  return {
    releaseKey: "tier1-2026-07-22",
    resourceSetId: "11111111-1111-4111-8111-111111111111",
    registryRevisionId: "22222222-2222-4222-8222-222222222222",
    ruleVersion: "v1",
    ruleChecksum: checksumProductValue(priorities),
    priorities,
    members: (["ax", "etno", "imb", "jp", "wcd"] as const).map((inputKey, index) => ({
      inputKey,
      publicationId: `${index + 3}3333333-3333-4333-8333-333333333333`.slice(-36),
      expectedChecksum: `${index + 1}`.repeat(64),
    })),
    actorOwnerId: "admin-1",
    actorEmail: "admin@example.com",
    reason: "Approved source release",
    ...overrides,
  };
}

describe("pipeline release finalization validation", () => {
  it("maps only the five canonical Tier 1 source profiles", () => {
    expect(inferTier1ReleaseInputKey("accelerate-owned-people-groups")).toBe("ax");
    expect(inferTier1ReleaseInputKey("etnopedia-people-groups")).toBe("etno");
    expect(inferTier1ReleaseInputKey("imb-people-groups")).toBe("imb");
    expect(inferTier1ReleaseInputKey("joshua-project-pgic")).toBe("jp");
    expect(inferTier1ReleaseInputKey("wcd-people-groups")).toBe("wcd");
  });

  it("does not let near-match partner profiles satisfy a Tier 1 slot", () => {
    expect(inferTier1ReleaseInputKey("imb-partner")).toBeNull();
    expect(inferTier1ReleaseInputKey("accelerate-owned-people-groups-copy")).toBeNull();
    expect(inferTier1ReleaseInputKey("world-christian-partner")).toBeNull();
  });

  it("accepts exactly one immutable publication per Tier 1 source", () => {
    expect(() => validateFinalizePipelineReleaseInput(input())).not.toThrow();
  });

  it("rejects an incomplete release before any transaction begins", () => {
    const value = input();
    expect(() => validateFinalizePipelineReleaseInput({ ...value, members: value.members.slice(0, 4) }))
      .toThrow("requires exactly ax, etno, imb, jp, wcd");
  });

  it("rejects stale rule contents", () => {
    expect(() => validateFinalizePipelineReleaseInput(input({ ruleChecksum: "f".repeat(64) })))
      .toThrow("checksum no longer matches");
  });

  it("requires an auditable finalization reason", () => {
    expect(() => validateFinalizePipelineReleaseInput(input({ reason: "  " })))
      .toThrow("reason is required");
  });
});
