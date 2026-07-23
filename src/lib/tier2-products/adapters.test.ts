import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./partner-lifecycle", () => ({
  buildTier2PartnerFormingCandidate: vi.fn(),
  buildTier2PartnerIdentityCandidate: vi.fn(),
  publishTier2PartnerFormingCandidate: vi.fn(),
  publishTier2PartnerIdentityCandidate: vi.fn(),
}));

vi.mock("./operations", () => ({
  createTier2ProductRelease: vi.fn(),
  finalizeTier2ProductReleaseCandidate: vi.fn(),
  getTier2ProductRun: vi.fn(),
  publishTier2ProductRun: vi.fn(),
}));

import {
  buildTier2PartnerFormingCandidate,
  buildTier2PartnerIdentityCandidate,
  publishTier2PartnerFormingCandidate,
} from "./partner-lifecycle";
import {
  createTier2ProductRelease,
  finalizeTier2ProductReleaseCandidate,
  getTier2ProductRun,
  publishTier2ProductRun,
} from "./operations";
import {
  runAggregate2Stage,
  runTier2FormingPublicationStage,
  runTier2FormingStage,
  runTier2IdentityStage,
  runTier2MergeStage,
  runTier2PublishStage,
  runTier2ReleaseStage,
} from "./adapters";
import type { PipelineStageHandlerContext } from "@/lib/pipeline-operations/types";

function context(
  exactInputs: Record<string, unknown>,
  stageKey = "tier2-form",
): PipelineStageHandlerContext {
  return {
    claim: {
      stageId: "stage",
      attemptId: "attempt",
      flowRunId: "flow",
      definitionKey: "tier2-partner",
      actorOwnerId: "admin",
      actorEmail: "admin@example.test",
      stageKey,
      stageKind: "forming",
      effectKey: "tier2-forming",
      exactInputs,
      attemptNumber: 1,
      maxAttempts: 3,
      leaseExpiresAt: "2026-07-22T00:00:00.000Z",
    },
    reportProgress: vi.fn(async () => undefined),
  };
}

describe("Tier 2 coordinator adapters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds forming evidence without auto-acknowledging or publishing it", async () => {
    vi.mocked(buildTier2PartnerFormingCandidate).mockResolvedValue({
      id: "forming-run",
      sourcePublicationId: null,
      status: "valid",
      outputRowCount: 4,
      outputChecksum: "a".repeat(64),
      resourceSetId: "resource-set",
      warningCount: 1,
      errorCount: 0,
    } as never);

    const result = await runTier2FormingStage(context({
      profileId: "10000000-0000-4000-8000-000000000001",
      sourceRunId: "10000000-0000-4000-8000-000000000002",
      resourceSetId: "10000000-0000-4000-8000-000000000003",
      registryRevisionId: "10000000-0000-4000-8000-000000000007",
      registryRevision: {
        registryRevisionId: "10000000-0000-4000-8000-000000000007",
        checksum: "c".repeat(64),
      },
      tier2ProfileBindings: {
        alpha: {
          id: "10000000-0000-4000-8000-000000000001",
          contractChecksum: "b".repeat(64),
          updatedAt: "2026-07-22T00:00:00.000Z",
        },
      },
      tier2ContractVersionIds: {
        "jp-peopleid3": "10000000-0000-4000-8000-000000000004",
        peid: "10000000-0000-4000-8000-000000000005",
        "engagement-mappings": "10000000-0000-4000-8000-000000000006",
      },
    }));

    expect(result.outcome).toBe("succeeded");
    expect(result.output).toMatchObject({ formingRunId: "forming-run", sourcePublicationId: null });
    expect(buildTier2PartnerFormingCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        baseRegistryRevisionId: "10000000-0000-4000-8000-000000000007",
        baseRegistryRevisionChecksum: "c".repeat(64),
      }),
    );
    expect(publishTier2PartnerFormingCandidate).not.toHaveBeenCalled();
  });

  it("resolves identity exclusively through the exact persisted forming candidate", async () => {
    vi.mocked(buildTier2PartnerIdentityCandidate).mockResolvedValue({
      id: "identity-run",
      status: "valid",
      outputRowCount: 4,
      outputChecksum: "f".repeat(64),
      warningCount: 0,
      errorCount: 0,
      conflictCount: 0,
      unassignableCount: 0,
    } as never);

    await runTier2IdentityStage(context({
      formingRunId: "10000000-0000-4000-8000-000000000001",
      sourcePublicationId: "10000000-0000-4000-8000-000000000002",
      registryRevisionId: "a newer current revision must not be resolved here",
      referenceVersionIds: {
        "country-territory-codes": "a newer current resource must not be resolved here",
      },
    }));

    expect(buildTier2PartnerIdentityCandidate).toHaveBeenCalledWith({
      formingRunId: "10000000-0000-4000-8000-000000000001",
      sourcePublicationId: "10000000-0000-4000-8000-000000000002",
      actorOwnerId: "admin",
      actorEmail: "admin@example.test",
    });
  });

  it("uses the reviewed forming publication instead of the earlier unpublished build output", async () => {
    vi.mocked(buildTier2PartnerIdentityCandidate).mockResolvedValue({
      id: "identity-run",
      status: "valid",
      outputRowCount: 4,
      outputChecksum: "f".repeat(64),
      warningCount: 0,
      errorCount: 0,
      conflictCount: 0,
      unassignableCount: 0,
    } as never);

    await runTier2IdentityStage(context({
      upstreamOutputs: {
        "tier2-partner-form": {
          formingRunId: "forming-run",
          sourcePublicationId: null,
        },
        "tier2-partner-review": {
          approved: true,
        },
        "tier2-partner-publish": {
          formingRunId: "forming-run",
          sourcePublicationId: "forming-publication",
        },
      },
    }));

    expect(buildTier2PartnerIdentityCandidate).toHaveBeenCalledWith({
      formingRunId: "forming-run",
      sourcePublicationId: "forming-publication",
      actorOwnerId: "admin",
      actorEmail: "admin@example.test",
    });
  });

  it("publishes forming evidence only after an explicit approved review", async () => {
    vi.mocked(publishTier2PartnerFormingCandidate).mockResolvedValue({
      sourcePublicationId: "publication",
      formingRun: { outputRowCount: 4 },
    } as never);

    await expect(runTier2FormingPublicationStage(context({
      formingRunId: "10000000-0000-4000-8000-000000000001",
      reason: "reviewed",
    }))).rejects.toThrow("approved");

    await runTier2FormingPublicationStage(context({
      formingRunId: "10000000-0000-4000-8000-000000000001",
      approved: true,
      acknowledgeWarnings: true,
      reason: "reviewed",
    }));
    expect(publishTier2PartnerFormingCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        acknowledgeWarnings: true,
        reason: "reviewed",
      }),
    );
  });

  it("builds Aggregate 2 from the freshly published Tier 2 output plus pinned supplements", async () => {
    vi.mocked(createTier2ProductRelease).mockResolvedValue({
      id: "aggregate-run",
      releaseSetId: "release",
      status: "valid",
      outputRowCount: 9,
      outputChecksum: "f".repeat(64),
      warningCount: 0,
      errorCount: 0,
    } as never);

    await runAggregate2Stage(context({
      resourceSetId: "10000000-0000-4000-8000-000000000001",
      registryRevisionId: "10000000-0000-4000-8000-000000000002",
      tier2ExpectedCurrentPublicationIds: {
        tier2: "10000000-0000-4000-8000-000000000009",
        aggregate2: null,
      },
      aggregate2Members: [
        { inputKey: "tier2", publicationId: "old-tier2", expectedChecksum: "1".repeat(64) },
        { inputKey: "imb", publicationId: "imb", expectedChecksum: "2".repeat(64) },
        { inputKey: "jp", publicationId: "jp", expectedChecksum: "3".repeat(64) },
      ],
      upstreamOutputs: {
        "tier2-merge": { tier2RunId: "tier2-run", outputChecksum: "4".repeat(64) },
        "tier2-merge-publish": { publicationId: "fresh-tier2" },
      },
    }, "aggregate2"));

    expect(createTier2ProductRelease).toHaveBeenCalledWith(expect.objectContaining({
      productKind: "aggregate2",
      expectedCurrentPublicationId: null,
      members: [
        { inputKey: "tier2", publicationId: "fresh-tier2", expectedChecksum: "4".repeat(64) },
        { inputKey: "imb", publicationId: "imb", expectedChecksum: "2".repeat(64) },
        { inputKey: "jp", publicationId: "jp", expectedChecksum: "3".repeat(64) },
      ],
    }));
  });

  it("keeps the exact Tier 2 target captured at launch when the live target advances", async () => {
    vi.mocked(createTier2ProductRelease).mockResolvedValue({
      id: "tier2-run",
      releaseSetId: "release",
      status: "valid",
      outputRowCount: 4,
      outputChecksum: "f".repeat(64),
      warningCount: 0,
      errorCount: 0,
    } as never);
    const launchPublicationId = "10000000-0000-4000-8000-000000000009";

    await runTier2ReleaseStage(context({
      resourceSetId: "10000000-0000-4000-8000-000000000001",
      registryRevisionId: "10000000-0000-4000-8000-000000000002",
      tier2ExpectedCurrentPublicationIds: {
        tier2: launchPublicationId,
        aggregate2: null,
      },
      tier2Members: [
        {
          inputKey: "partner",
          publicationId: "10000000-0000-4000-8000-000000000003",
          expectedChecksum: "1".repeat(64),
        },
      ],
    }, "tier2-release-set"));

    expect(createTier2ProductRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        productKind: "tier2",
        expectedCurrentPublicationId: launchPublicationId,
      }),
    );
  });

  it("fails closed when a Tier 2 launch target pin is missing or malformed", async () => {
    const exactInputs = {
      resourceSetId: "10000000-0000-4000-8000-000000000001",
      registryRevisionId: "10000000-0000-4000-8000-000000000002",
      tier2Members: [
        {
          inputKey: "partner",
          publicationId: "10000000-0000-4000-8000-000000000003",
          expectedChecksum: "1".repeat(64),
        },
      ],
    };

    await expect(
      runTier2ReleaseStage(context(exactInputs, "tier2-release-set")),
    ).rejects.toMatchObject({ code: "publication-target-pin-missing" });
    await expect(
      runTier2ReleaseStage(context({
        ...exactInputs,
        tier2ExpectedCurrentPublicationIds: {
          tier2: "current",
          aggregate2: null,
        },
      }, "tier2-release-set")),
    ).rejects.toMatchObject({ code: "publication-target-pin-invalid" });
    expect(createTier2ProductRelease).not.toHaveBeenCalled();
  });

  it("finalizes the retained Tier 2 draft only after the exact release review is approved", async () => {
    vi.mocked(finalizeTier2ProductReleaseCandidate).mockResolvedValue({
      runId: "tier2-run",
      releaseSetId: "release",
      status: "finalized",
      canonicalChecksum: "e".repeat(64),
    });
    vi.mocked(getTier2ProductRun).mockResolvedValue({
      id: "tier2-run",
      productKind: "tier2",
      releaseSetId: "release",
      status: "valid",
      outputRowCount: 9,
      outputChecksum: "f".repeat(64),
      warningCount: 0,
      errorCount: 0,
    } as never);

    await expect(runTier2MergeStage(context({
      upstreamOutputs: {
        "tier2-release-set": { tier2RunId: "tier2-run" },
        "tier2-release-review": { approved: false, reason: "Not approved" },
      },
    }, "tier2-merge"))).rejects.toThrow("approved Tier 2 release review");
    expect(finalizeTier2ProductReleaseCandidate).not.toHaveBeenCalled();

    await runTier2MergeStage(context({
      upstreamOutputs: {
        "tier2-release-set": { tier2RunId: "tier2-run" },
        "tier2-release-review": {
          approved: true,
          reason: "Reviewed exact partner membership",
        },
      },
    }, "tier2-merge"));

    expect(finalizeTier2ProductReleaseCandidate).toHaveBeenCalledWith({
      runId: "tier2-run",
      actorOwnerId: "admin",
      actorEmail: "admin@example.test",
      reason: "Reviewed exact partner membership",
    });
  });

  it("publishes the exact stage product using the candidate-owned CAS pin and review", async () => {
    vi.mocked(publishTier2ProductRun).mockResolvedValue({
      publicationId: "aggregate-publication",
      versionNumber: 2,
      run: { outputRowCount: 9 },
    } as never);

    await runTier2PublishStage(context({
      upstreamOutputs: {
        "tier2-merge": { tier2RunId: "wrong-earlier-run" },
        "tier2-merge-review": { approved: true, reason: "wrong earlier reason" },
        aggregate2: { aggregate2RunId: "aggregate-run" },
        "aggregate2-review": {
          approved: true,
          acknowledgeWarnings: true,
          reason: "reviewed aggregate candidate",
        },
      },
    }, "aggregate2-publish"));

    expect(publishTier2ProductRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: "aggregate-run",
      acknowledgeWarnings: true,
      reason: "reviewed aggregate candidate",
    }));
  });
});
