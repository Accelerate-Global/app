import { describe, expect, it } from "vitest";

import {
  DATASET_FORMING_ARTIFACT_KINDS,
  DATASET_FORMING_RUN_STATUSES,
  isDatasetFormingChecksum,
  isDatasetFormingRunStatus,
} from "./types";

describe("dataset forming contracts", () => {
  it("keeps the persisted lifecycle and artifact vocabulary explicit", () => {
    expect(DATASET_FORMING_RUN_STATUSES).toEqual([
      "building",
      "valid",
      "invalid",
      "rejected",
      "publishing",
      "published",
      "failed",
    ]);
    expect(DATASET_FORMING_ARTIFACT_KINDS).toEqual([
      "rows",
      "findings",
      "manifest",
      "csv",
    ]);
    expect(isDatasetFormingRunStatus("published")).toBe(true);
    expect(isDatasetFormingRunStatus("stale")).toBe(false);
  });

  it("accepts only normalized SHA-256 checksums", () => {
    expect(isDatasetFormingChecksum("a".repeat(64))).toBe(true);
    expect(isDatasetFormingChecksum("A".repeat(64))).toBe(false);
    expect(isDatasetFormingChecksum("a".repeat(63))).toBe(false);
  });
});
