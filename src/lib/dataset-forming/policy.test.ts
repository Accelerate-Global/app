import { describe, expect, it } from "vitest";

import {
  assertEligibleDatasetFormingSource,
  assertPublishableDatasetFormingCandidate,
  assertRejectableDatasetFormingCandidate,
  DATASET_FORMING_STALE_AFTER_MS,
  isStaleDatasetFormingBuild,
} from "./policy";
import { createDatasetFormingEngineRegistry } from "./registry";
import type { DatasetFormingEngine } from "./types";

const registeredEngine: DatasetFormingEngine<Record<never, never>> = {
  engineKey: "engine",
  displayName: "Engine",
  sourceProfileKeys: ["profile"],
  version: "engine-v1",
  checksum: "a".repeat(64),
  artifactSchemaVersion: 1,
  publicationTargetKey: "dataset",
  resourceRequirements: [],
  form() {
    return {
      columns: [],
      rows: [],
      findings: [],
      validation: { warningCount: 0, errorCount: 0 },
      outputChecksum: "b".repeat(64),
      valid: true,
    };
  },
};
const registry = createDatasetFormingEngineRegistry([registeredEngine]);

describe("dataset forming lifecycle policy", () => {
  it("allows only supported successful checksummed import snapshots", () => {
    expect(
      assertEligibleDatasetFormingSource({
        sourceProfileKey: "profile",
        status: "success",
        mode: "import",
        rowsChecksum: "a".repeat(64),
        rawChecksum: "b".repeat(64),
        registry,
      }),
    ).toBe(registeredEngine);

    expect(() =>
      assertEligibleDatasetFormingSource({
        sourceProfileKey: "unknown",
        status: "success",
        mode: "import",
        rowsChecksum: "a".repeat(64),
        rawChecksum: "b".repeat(64),
        registry,
      }),
    ).toThrow("No dataset forming engine");
    expect(() =>
      assertEligibleDatasetFormingSource({
        sourceProfileKey: "profile",
        status: "success",
        mode: "test",
        rowsChecksum: "a".repeat(64),
        rawChecksum: "b".repeat(64),
        registry,
      }),
    ).toThrow("successful import snapshot");
    expect(() =>
      assertEligibleDatasetFormingSource({
        sourceProfileKey: "profile",
        status: "success",
        mode: "import",
        rowsChecksum: null,
        rawChecksum: null,
        registry,
      }),
    ).toThrow("predates immutable artifact checksums");
  });

  it("rejects every non-valid, stale, or undecided publication", () => {
    for (const status of [
      "building",
      "invalid",
      "rejected",
      "publishing",
      "published",
      "failed",
    ] as const) {
      expect(() =>
        assertPublishableDatasetFormingCandidate({
          status,
          warningCount: 0,
          decision: { reason: "Reviewed" },
        }),
      ).toThrow("Only a valid");
    }
    expect(() =>
      assertPublishableDatasetFormingCandidate({
        status: "valid",
        warningCount: 0,
        integrity: "stale",
        decision: { reason: "Reviewed" },
      }),
    ).toThrow("must be rebuilt");
    expect(() =>
      assertPublishableDatasetFormingCandidate({
        status: "valid",
        warningCount: 1,
        decision: { reason: "Reviewed" },
      }),
    ).toThrow("Acknowledge");
    expect(() =>
      assertPublishableDatasetFormingCandidate({
        status: "valid",
        warningCount: 1,
        decision: { reason: "Reviewed", warningsAcknowledged: true },
      }),
    ).not.toThrow();
  });

  it("permits rejection only for completed undecided candidates with a reason", () => {
    expect(() =>
      assertRejectableDatasetFormingCandidate({
        status: "invalid",
        decision: { reason: "Rejected after review" },
      }),
    ).not.toThrow();
    expect(() =>
      assertRejectableDatasetFormingCandidate({
        status: "published",
        decision: { reason: "Too late" },
      }),
    ).toThrow("completed undecided");
    expect(() =>
      assertRejectableDatasetFormingCandidate({
        status: "valid",
        decision: { reason: " " },
      }),
    ).toThrow("rejection reason");
  });

  it("uses the shared stale-build threshold", () => {
    const now = Date.parse("2026-07-22T12:00:00.000Z");
    expect(
      isStaleDatasetFormingBuild(
        new Date(now - DATASET_FORMING_STALE_AFTER_MS),
        now,
      ),
    ).toBe(true);
    expect(
      isStaleDatasetFormingBuild(
        new Date(now - DATASET_FORMING_STALE_AFTER_MS + 1),
        now,
      ),
    ).toBe(false);
  });
});
