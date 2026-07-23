import { describe, expect, it } from "vitest";

import { IMB_API_CONNECTION_ID } from "@/lib/api-connections";

import {
  assertDatasetFormingPublicationTargetCurrent,
  assertEligibleImbSource,
  assertPublishableImbCandidate,
  FORMING_PUBLICATION_STALE_AFTER_MS,
  FORMING_STALE_AFTER_MS,
  isStaleImbBuild,
  isStaleImbPublication,
} from "./policy";

describe("IMB forming lifecycle policy", () => {
  it("accepts only successful checksummed IMB ingestion runs", () => {
    expect(() =>
      assertEligibleImbSource({
        connectionId: IMB_API_CONNECTION_ID,
        status: "success",
        mode: "import",
        rowsChecksum: "a".repeat(64),
        rawChecksum: "b".repeat(64),
      }),
    ).not.toThrow();
    expect(() =>
      assertEligibleImbSource({
        connectionId: IMB_API_CONNECTION_ID,
        status: "success",
        mode: "test",
        rowsChecksum: "a".repeat(64),
        rawChecksum: "b".repeat(64),
      }),
    ).toThrow("successful IMB ingestion");
    expect(() =>
      assertEligibleImbSource({
        connectionId: IMB_API_CONNECTION_ID,
        status: "success",
        mode: "import",
        rowsChecksum: null,
        rawChecksum: null,
      }),
    ).toThrow("predates immutable artifact checksums");
  });

  it("keeps the legacy IMB wrapper scoped even when the shared registry supports other engines", () => {
    expect(() =>
      assertEligibleImbSource({
        connectionId: "etnopedia",
        status: "success",
        mode: "import",
        rowsChecksum: "a".repeat(64),
        rawChecksum: "b".repeat(64),
      }),
    ).toThrow("currently available only for IMB");
  });

  it("requires explicit warning acknowledgement before publication", () => {
    expect(() =>
      assertPublishableImbCandidate({
        status: "valid",
        warningCount: 2,
        decision: { reason: "Reviewed" },
      }),
    ).toThrow("Acknowledge");
    expect(() =>
      assertPublishableImbCandidate({
        status: "valid",
        warningCount: 2,
        decision: { reason: "Reviewed", warningsAcknowledged: true },
      }),
    ).not.toThrow();
  });

  it("keeps non-valid candidates out of publication", () => {
    for (const status of ["building", "invalid", "rejected", "failed", "published"] as const) {
      expect(() =>
        assertPublishableImbCandidate({
          status,
          warningCount: 0,
          decision: { reason: "Reviewed" },
        }),
      ).toThrow("Only a valid candidate");
    }
  });

  it("supersedes only builds older than the stale threshold", () => {
    const now = Date.parse("2026-07-21T20:00:00.000Z");
    expect(
      isStaleImbBuild(new Date(now - FORMING_STALE_AFTER_MS), now),
    ).toBe(true);
    expect(
      isStaleImbBuild(new Date(now - FORMING_STALE_AFTER_MS + 1), now),
    ).toBe(false);
  });

  it("recovers only expired publication claims, including legacy claims without a timestamp", () => {
    const now = Date.parse("2026-07-21T20:00:00.000Z");
    expect(isStaleImbPublication(null, now)).toBe(true);
    expect(
      isStaleImbPublication(
        new Date(now - FORMING_PUBLICATION_STALE_AFTER_MS),
        now,
      ),
    ).toBe(true);
    expect(
      isStaleImbPublication(
        new Date(now - FORMING_PUBLICATION_STALE_AFTER_MS + 1),
        now,
      ),
    ).toBe(false);
  });

  it("fails closed when the formed publication target changed after candidate creation", () => {
    expect(() =>
      assertDatasetFormingPublicationTargetCurrent({
        expectedCurrentPublicationId: null,
        currentPublicationId: null,
      }),
    ).not.toThrow();
    expect(() =>
      assertDatasetFormingPublicationTargetCurrent({
        expectedCurrentPublicationId: "publication-a",
        currentPublicationId: "publication-a",
      }),
    ).not.toThrow();
    expect(() =>
      assertDatasetFormingPublicationTargetCurrent({
        expectedCurrentPublicationId: "publication-a",
        currentPublicationId: "publication-b",
      }),
    ).toThrow("A newer formed dataset was published");
  });
});
