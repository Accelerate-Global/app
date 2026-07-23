import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/identity-registry", () => ({
  buildAxIdentityCandidate: vi.fn(),
  publishAxIdentityCandidate: vi.fn(),
  rejectAxIdentityCandidate: vi.fn(),
}));
vi.mock("@/lib/pipeline-products/storage", () => ({
  deletePipelineDatasetBlob: vi.fn(),
  uploadPipelineDatasetBlob: vi.fn(),
}));

import { getDb } from "@/db";
import { buildAxIdentityCandidate } from "@/lib/identity-registry";
import { deletePipelineDatasetBlob } from "@/lib/pipeline-products/storage";

import {
  assertTier2FormingPublicationTargetCurrent,
  assertTier2ProfileEngagementContract,
  buildTier2PartnerIdentityCandidate,
  createTier2IdentityInputSnapshot,
  recoverStaleTier2FormingPublications,
  summarizeTier2FormingResult,
  tier2FormingRunLockKey,
  tier2FormingPublicationLockKey,
  TIER2_FORMING_BUILD_STALE_AFTER_MINUTES,
  TIER2_FORMING_ENGINE_CHECKSUM,
  TIER2_FORMING_ENGINE_VERSION,
  TIER2_FORMING_PUBLICATION_LEASE_MS,
} from "./partner-lifecycle";

describe("Tier 2 durable partner lifecycle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pins a stable checked-in forming engine contract", () => {
    expect(TIER2_FORMING_ENGINE_VERSION).toBe("tier2-partner-forming-v1");
    expect(TIER2_FORMING_ENGINE_CHECKSUM).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("fails closed unless the profile contract is the exact engagement mapping executed", () => {
    const binding = {
      version_number: 7,
      content_checksum: "a".repeat(64),
    };
    expect(() => assertTier2ProfileEngagementContract({
      profile: {
        contractVersion: "7",
        contractChecksum: "a".repeat(64),
      },
      engagementBinding: binding,
    })).not.toThrow();
    expect(() => assertTier2ProfileEngagementContract({
      profile: {
        contractVersion: "6",
        contractChecksum: "a".repeat(64),
      },
      engagementBinding: binding,
    })).toThrow("exact engagement-mappings version");
    expect(() => assertTier2ProfileEngagementContract({
      profile: {
        contractVersion: "7",
        contractChecksum: "b".repeat(64),
      },
      engagementBinding: binding,
    })).toThrow("exact engagement-mappings version");
  });

  it("uses a deterministic per-input run lock and a bounded stale-build window", () => {
    expect(tier2FormingRunLockKey("profile-1", "a".repeat(64))).toBe(
      `tier2-forming-run:profile-1:${"a".repeat(64)}`,
    );
    expect(TIER2_FORMING_BUILD_STALE_AFTER_MINUTES).toBe(30);
    expect(TIER2_FORMING_PUBLICATION_LEASE_MS).toBe(15 * 60 * 1_000);
    expect(tier2FormingPublicationLockKey("tier2-partner-alpha")).toBe(
      "tier2-forming-publication:tier2-partner-alpha",
    );
  });

  it("recovers expired publication leases and deletes their attempt-owned blobs", async () => {
    const execute = vi.fn().mockResolvedValue([{
      id: "stale-forming-run",
      publication_blob_path: "datasets/csv/stale-tier2-attempt.csv",
    }]);
    vi.mocked(getDb).mockReturnValue({ execute } as never);
    vi.mocked(deletePipelineDatasetBlob).mockResolvedValue(undefined);

    await expect(recoverStaleTier2FormingPublications({
      now: new Date("2026-07-22T19:00:00.000Z"),
    })).resolves.toBe(1);

    expect(execute).toHaveBeenCalledOnce();
    expect(deletePipelineDatasetBlob).toHaveBeenCalledWith(
      "datasets/csv/stale-tier2-attempt.csv",
    );
  });

  it("passes the forming snapshot's exact identity inputs after current resources advance", async () => {
    const pinned = createTier2IdentityInputSnapshot({
      countryVersionId: "11000000-0000-4000-8000-000000000001",
      countryChecksum: "a".repeat(64),
      ropVersionId: "11000000-0000-4000-8000-000000000002",
      ropChecksum: "b".repeat(64),
      sourceAliasesVersionId: "11000000-0000-4000-8000-000000000004",
      sourceAliasesChecksum: "d".repeat(64),
      sourceAliasKey: "alpha",
      sourceInitials: "pa",
      baseRegistryRevisionId: "11000000-0000-4000-8000-000000000003",
      baseRegistryRevisionChecksum: "c".repeat(64),
    });
    const advancedCurrentInputs = {
      countryVersionId: "22000000-0000-4000-8000-000000000001",
      ropVersionId: "22000000-0000-4000-8000-000000000002",
      sourceAliasesVersionId: "22000000-0000-4000-8000-000000000004",
      baseRegistryRevisionId: "22000000-0000-4000-8000-000000000003",
    };
    const execute = vi.fn()
      .mockResolvedValueOnce([{
        id: "forming-run",
        connection_id: "connection",
        source_run_id: "source-run",
        source_profile_key: "partner-alpha",
        status: "published",
        input_fingerprint: "d".repeat(64),
        resource_set_id: "resource-set",
        input_row_count: 1,
        output_row_count: 1,
        warning_count: 0,
        error_count: 0,
        validation_summary: {},
        artifact_manifest: {},
        output_checksum: "e".repeat(64),
        dataset_id: "dataset",
        rejection_reason: null,
        publication_reason: "reviewed",
        error_message: null,
        created_at: "2026-07-22T00:00:00.000Z",
        completed_at: "2026-07-22T00:01:00.000Z",
        profile_id: "profile",
        profile_snapshot: { identityInputs: pinned },
        source_publication_id: "source-publication",
        identity_run_id: null,
        publication_target_key: "tier2-partner-alpha",
        expected_current_publication_id: null,
        publication_id: "source-publication",
        publishing_started_at: null,
      }])
      .mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue({ execute } as never);
    vi.mocked(buildAxIdentityCandidate).mockResolvedValue({ id: "identity-run" } as never);

    await buildTier2PartnerIdentityCandidate({
      formingRunId: "forming-run",
      sourcePublicationId: "source-publication",
      actorOwnerId: "admin",
      actorEmail: "admin@example.test",
    });

    expect(advancedCurrentInputs.countryVersionId).not.toBe(pinned.countryVersionId);
    expect(buildAxIdentityCandidate).toHaveBeenCalledWith(expect.objectContaining({
      sourcePublicationId: "source-publication",
      countryVersionId: pinned.countryVersionId,
      countryChecksum: pinned.countryChecksum,
      ropVersionId: pinned.ropVersionId,
      ropChecksum: pinned.ropChecksum,
      sourceAliasesVersionId: pinned.sourceAliasesVersionId,
      sourceAliasesChecksum: pinned.sourceAliasesChecksum,
      sourceAliasKey: pinned.sourceAliasKey,
      sourceInitials: pinned.sourceInitials,
      baseRevisionId: pinned.baseRegistryRevisionId,
      baseRevisionChecksum: pinned.baseRegistryRevisionChecksum,
    }));
  });

  it("rejects a competing formed-source publication that advanced the target", () => {
    expect(() => assertTier2FormingPublicationTargetCurrent({
      expectedCurrentPublicationId: "publication-a",
      currentPublicationId: "publication-b",
    })).toThrow("newer Tier 2 formed source");
    expect(() => assertTier2FormingPublicationTargetCurrent({
      expectedCurrentPublicationId: "publication-a",
      currentPublicationId: "publication-a",
    })).not.toThrow();
  });

  it("reports blocking results without hiding retained rows", () => {
    expect(summarizeTier2FormingResult({
      valid: false,
      rows: [{ row: "retained" }],
      columns: [],
      findings: [],
      outputChecksum: "a".repeat(64),
      resourceLineage: {} as never,
      validation: { warningCount: 1, errorCount: 1 } as never,
    })).toEqual({
      valid: false,
      rowCount: 1,
      warningCount: 1,
      errorCount: 1,
      outputChecksum: "a".repeat(64),
    });
  });
});
