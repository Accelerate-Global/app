import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildPipelineProductMock,
  rejectPipelineReleaseSetCandidateMock,
  rejectTier2ProductRunMock,
} = vi.hoisted(() => ({
  buildPipelineProductMock: vi.fn(),
  rejectPipelineReleaseSetCandidateMock: vi.fn(),
  rejectTier2ProductRunMock: vi.fn(),
}));

vi.mock("@/lib/pipeline-products", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline-products")>(
    "@/lib/pipeline-products",
  );
  return {
    ...actual,
    buildPipelineProduct: buildPipelineProductMock,
    rejectPipelineReleaseSetCandidate: rejectPipelineReleaseSetCandidateMock,
  };
});
vi.mock("@/lib/tier2-products", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tier2-products")>(
    "@/lib/tier2-products",
  );
  return {
    ...actual,
    rejectTier2ProductRun: rejectTier2ProductRunMock,
  };
});

import {
  rejectPipelineReviewCandidate,
  runTier1ProductBuildStage,
} from "./handlers";
import type { PipelineRunDetail, PipelineStageClaim } from "./types";

function productClaim(): PipelineStageClaim {
  return {
    stageId: "stage-1",
    attemptId: "attempt-1",
    flowRunId: "10000000-0000-4000-8000-000000000001",
    definitionKey: "tier1-release",
    actorOwnerId: "admin-1",
    actorEmail: "admin@example.test",
    stageKey: "tier1-pgic-merge",
    stageKind: "merge",
    effectKey: "tier1-merge",
    exactInputs: {
      coordinator: { productKey: "tier1-pgic-merge" },
      tier1ExpectedCurrentPublicationIds: {
        "tier1-pgic-merge": "20000000-0000-4000-8000-000000000001",
      },
      upstreamOutputs: {
        "tier1-release-finalize": {
          releaseSetId: "30000000-0000-4000-8000-000000000001",
        },
      },
    },
    attemptNumber: 1,
    maxAttempts: 3,
    leaseExpiresAt: "2026-07-23T00:01:00.000Z",
  };
}

describe("pipeline release coordination", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    buildPipelineProductMock.mockResolvedValue({
      id: "40000000-0000-4000-8000-000000000001",
      status: "valid",
      outputRowCount: 4,
      warningCount: 0,
      errorCount: 0,
      publicationTargetKey: "tier1-pgic",
      expectedCurrentPublicationId:
        "20000000-0000-4000-8000-000000000001",
      outputChecksum: "a".repeat(64),
    });
  });

  it("builds a Tier 1 candidate against the stable target pinned at launch", async () => {
    await expect(runTier1ProductBuildStage({
      claim: productClaim(),
      reportProgress: vi.fn().mockResolvedValue(undefined),
    })).resolves.toMatchObject({
      outcome: "succeeded",
      output: {
        expectedCurrentPublicationId:
          "20000000-0000-4000-8000-000000000001",
      },
    });

    expect(buildPipelineProductMock).toHaveBeenCalledWith(
      expect.objectContaining({
        definitionKey: "tier1-pgic-merge",
        releaseSetId: "30000000-0000-4000-8000-000000000001",
        expectedCurrentPublicationId:
          "20000000-0000-4000-8000-000000000001",
      }),
    );
  });

  it("fails closed instead of resolving a mutable Tier 1 target during execution", async () => {
    const claim = productClaim();
    await expect(runTier1ProductBuildStage({
      claim: {
        ...claim,
        exactInputs: {
          ...claim.exactInputs,
          tier1ExpectedCurrentPublicationIds: {},
        },
      },
      reportProgress: vi.fn().mockResolvedValue(undefined),
    })).rejects.toMatchObject({
      code: "product-target-snapshot-missing",
      retryable: false,
    });
    expect(buildPipelineProductMock).not.toHaveBeenCalled();
  });

  it("cancels the durable Tier 1 release candidate before closing a rejected review", async () => {
    const run = {
      stages: [
        {
          key: "tier1-release-set",
          index: 0,
          kind: "release",
          effectKey: "release-set-build",
          output: {
            releaseSetId: "30000000-0000-4000-8000-000000000001",
          },
        },
        {
          key: "tier1-release-review",
          index: 1,
          kind: "review",
          effectKey: "manual-review",
          output: {},
        },
      ],
    } as unknown as PipelineRunDetail;
    const identity = {
      ownerId: "admin-1",
      email: "admin@example.test",
      fullName: null,
      workspaceRole: "admin" as const,
      isDatasetAdmin: true,
      mode: "supabase" as const,
    };

    await rejectPipelineReviewCandidate({
      run,
      stageKey: "tier1-release-review",
      reason: "Inputs need correction",
      identity,
    });

    expect(rejectPipelineReleaseSetCandidateMock).toHaveBeenCalledWith({
      releaseSetId: "30000000-0000-4000-8000-000000000001",
      reason: "Inputs need correction",
      actorOwnerId: "admin-1",
      actorEmail: "admin@example.test",
    });
  });

  it("records a Tier 2 release rejection on its candidate domain", async () => {
    const run = {
      stages: [
        {
          key: "tier2-release-set",
          index: 0,
          kind: "release",
          effectKey: "tier2-release-set-build",
          output: {
            tier2RunId: "50000000-0000-4000-8000-000000000001",
          },
        },
        {
          key: "tier2-release-review",
          index: 1,
          kind: "review",
          effectKey: "manual-review",
          output: {},
        },
      ],
    } as unknown as PipelineRunDetail;
    const identity = {
      ownerId: "admin-1",
      email: "admin@example.test",
      fullName: null,
      workspaceRole: "admin" as const,
      isDatasetAdmin: true,
      mode: "supabase" as const,
    };

    await rejectPipelineReviewCandidate({
      run,
      stageKey: "tier2-release-review",
      reason: "Partner release needs correction",
      identity,
    });

    expect(rejectTier2ProductRunMock).toHaveBeenCalledWith({
      runId: "50000000-0000-4000-8000-000000000001",
      reason: "Partner release needs correction",
      actorOwnerId: "admin-1",
      actorEmail: "admin@example.test",
    });
  });
});
