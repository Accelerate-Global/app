import { describe, expect, it } from "vitest";

import {
  assertArchiveRecordUsable,
  archiveStateAllowsImmediateUse,
  DataArchiveRehydrationRequiredError,
} from "./archive-state";
import type { DataArchiveSummary } from "@/lib/api-types";

const summary = (state: DataArchiveSummary["state"]): DataArchiveSummary => ({
  state,
  packageKey: "api-run/source/checksum",
  sourceChecksum: "a".repeat(64),
  rowCount: 2,
  objectCount: 2,
  sizeBytes: 200,
  integrityVerifiedAt: "2026-08-27T09:00:00.000Z",
  restoreVerifiedAt: state === "hot" ? null : "2026-08-27T10:00:00.000Z",
  rehydratedAt: null,
});

describe("hot and cold archive state", () => {
  it("allows uncataloged and hot payloads but not cold or incomplete recovery", () => {
    expect(archiveStateAllowsImmediateUse(null)).toBe(true);
    expect(archiveStateAllowsImmediateUse(summary("hot"))).toBe(true);
    expect(archiveStateAllowsImmediateUse(summary("cold"))).toBe(false);
    expect(archiveStateAllowsImmediateUse(summary("rehydrating"))).toBe(false);
    expect(archiveStateAllowsImmediateUse(summary("failed"))).toBe(false);
  });

  it("provides a stable operator-rehydration error", () => {
    const error = new DataArchiveRehydrationRequiredError();
    expect(error.status).toBe(409);
    expect(error.code).toBe("archive-rehydration-required");
    expect(error.message).toContain("operator rehydration");
  });

  it("requires a verified rehydration record for rehydrated evidence", () => {
    expect(() =>
      assertArchiveRecordUsable({ status: "rehydrated", verifiedRehydration: false }),
    ).toThrow(DataArchiveRehydrationRequiredError);
    expect(() =>
      assertArchiveRecordUsable({ status: "rehydrated", verifiedRehydration: true }),
    ).not.toThrow();
  });
});
