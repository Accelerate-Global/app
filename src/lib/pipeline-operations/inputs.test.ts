import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/api-connections", () => ({
  listCodeManagedApiConnections: vi.fn(),
}));
vi.mock("@/lib/reference-resources", () => ({
  loadPinnedTier1PriorityRules: vi.fn(),
}));

import { getDb } from "@/db";
import { listCodeManagedApiConnections } from "@/lib/api-connections";
import { loadPinnedTier1PriorityRules } from "@/lib/reference-resources";

import { snapshotCurrentPipelineInputs } from "./inputs";

const resourceSetId = "10000000-0000-4000-8000-000000000001";
const priorityVersionId = "10000000-0000-4000-8000-000000000002";
const checksum = "a".repeat(64);
const defaultTier2Targets = [
  {
    productKind: "tier2",
    publicationTargetKey: "tier2-pgic",
    currentPublicationId: null,
    currentPublicationTargetKey: null,
    currentProducerKind: null,
    currentDatasetId: null,
    currentDatasetRecordId: null,
    currentOutputChecksum: null,
    currentPublicationRowCount: null,
    currentDatasetRowCount: null,
    currentDatasetStatus: null,
  },
  {
    productKind: "aggregate2",
    publicationTargetKey: "aggregate2-pgic",
    currentPublicationId: null,
    currentPublicationTargetKey: null,
    currentProducerKind: null,
    currentDatasetId: null,
    currentDatasetRecordId: null,
    currentOutputChecksum: null,
    currentPublicationRowCount: null,
    currentDatasetRowCount: null,
    currentDatasetStatus: null,
  },
] as const;

describe("pipeline current-input snapshot", () => {
  const execute = vi.fn();
  const transaction = vi.fn(async (
    callback: (tx: { execute: typeof execute }) => Promise<unknown>,
    options: unknown,
  ) => {
    void options;
    return callback({ execute });
  });
  function mockDatabaseSnapshot(input: {
    publications?: unknown[];
    tier2Targets?: unknown[];
  } = {}) {
    execute
      .mockResolvedValueOnce([{ id: resourceSetId, checksum }])
      .mockResolvedValueOnce([{
        resourceKey: "tier1-merge-priorities",
        versionId: priorityVersionId,
        checksum,
        versionNumber: 1,
        schemaVersion: 1,
      }])
      .mockResolvedValueOnce(input.publications ?? [])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(input.tier2Targets ?? defaultTier2Targets);
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getDb).mockReturnValue({ transaction } as never);
    vi.mocked(listCodeManagedApiConnections).mockReturnValue([
      {
        id: "20000000-0000-4000-8000-000000000001",
        method: "GET",
        url: "https://example.test/imb",
        headers: [],
        bodyTemplate: "",
        responseFormat: "json",
        responseDataPath: "features",
        importMode: "create",
        targetDatasetId: null,
        datasetName: "imb.csv",
        datasetClassification: "PGIC",
        provider: "http_api",
        providerConfig: { provider: "http_api" },
        updatedAt: "2026-07-23T00:00:00.000Z",
        sourceProfile: {
          key: "imb-people-groups",
          engineKey: "imb",
          stableKeyColumn: null,
          configurable: false,
        },
      },
    ] as never);
    vi.mocked(loadPinnedTier1PriorityRules).mockResolvedValue({
      binding: {
        resourceSetId,
        resourceSetChecksum: checksum,
        resourceId: "10000000-0000-4000-8000-000000000003",
        resourceKey: "tier1-merge-priorities",
        resourceKind: "merge-priority",
        versionId: priorityVersionId,
        versionNumber: 1,
        schemaVersion: 1,
        contentChecksum: checksum,
      },
      priorities: [
        { canonicalField: "PG_Name_Main", prioritySourceKeys: ["imb"] },
      ],
    });
    mockDatabaseSnapshot();
  });

  it("captures mutable pointers in one repeatable-read transaction and resolves immutable priorities", async () => {
    const snapshot = await snapshotCurrentPipelineInputs();

    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
    expect(loadPinnedTier1PriorityRules).toHaveBeenCalledWith({
      resourceSetId,
      resourceSetChecksum: checksum,
      expectedVersionId: priorityVersionId,
      expectedContentChecksum: checksum,
    });
    expect(snapshot).toMatchObject({
      resourceSetId,
      resourceSetChecksum: checksum,
      connectionIds: {
        "imb-people-groups": "20000000-0000-4000-8000-000000000001",
      },
      sourceExecutionBindings: {
        "imb-people-groups": {
          connectionId: "20000000-0000-4000-8000-000000000001",
          configChecksum: expect.stringMatching(/^[0-9a-f]{64}$/),
          adapterChecksum: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
      },
      formingPublicationIds: {
        "imb-people-groups": null,
      },
      tier1RuleBinding: {
        versionId: priorityVersionId,
        checksum,
        priorities: [
          { canonicalField: "PG_Name_Main", prioritySourceKeys: ["imb"] },
        ],
      },
      tier2ExpectedCurrentPublicationIds: {
        tier2: null,
        aggregate2: null,
      },
      tier1ExpectedCurrentPublicationIds: expect.objectContaining({
        "tier1-pgic-merge": null,
        "aggregate1-hotspots": null,
      }),
    });
  });

  it("pins every Tier 1 stable target from the same launch snapshot", async () => {
    execute.mockReset();
    mockDatabaseSnapshot({
      publications: [{
        producerKey: "tier1-merge",
        publicationId: "10000000-0000-4000-8000-000000000009",
        producerKind: "tier1-merge",
        sourceProfileKey: null,
        publicationTargetKey: "tier1-pgic",
        outputChecksum: "b".repeat(64),
      }],
    });

    const snapshot = await snapshotCurrentPipelineInputs();

    expect(snapshot.tier1ExpectedCurrentPublicationIds).toEqual(
      expect.objectContaining({
        "tier1-pgic-merge": "10000000-0000-4000-8000-000000000009",
        "tier1-specific-pg-merge": null,
        "aggregate1-hotspots": null,
      }),
    );
  });

  it("pins the exact prior forming publication by source-profile producer key", async () => {
    execute.mockReset();
    mockDatabaseSnapshot({
      publications: [{
        producerKey: "imb-people-groups",
        publicationId: "10000000-0000-4000-8000-000000000008",
        producerKind: "dataset-forming",
        sourceProfileKey: "imb-people-groups",
        publicationTargetKey: "imb-people-groups",
        outputChecksum: "b".repeat(64),
      }],
    });

    const snapshot = await snapshotCurrentPipelineInputs();

    expect(snapshot.formingPublicationIds).toEqual({
      "imb-people-groups": "10000000-0000-4000-8000-000000000008",
    });
  });

  it("queries the global Tier 2 targets without a nonexistent profile_id column", async () => {
    await snapshotCurrentPipelineInputs();
    const queryShape = JSON.stringify(execute.mock.calls);
    expect(queryShape).toContain("current_publication_id");
    expect(queryShape).not.toContain("profile_id as");
  });

  it("uses the authoritative target pointer after rollback instead of the newest incident publication", async () => {
    execute.mockReset();
    mockDatabaseSnapshot({
      publications: [{
        producerKey: "tier2-merge",
        publicationId: "incident-publication",
        producerKind: "tier2-merge",
        sourceProfileKey: null,
        publicationTargetKey: "tier2-pgic",
        outputChecksum: "b".repeat(64),
      }],
      tier2Targets: [
        {
          productKind: "tier2",
          publicationTargetKey: "tier2-pgic",
          currentPublicationId: "rollback-publication",
          currentPublicationTargetKey: "tier2-pgic",
          currentProducerKind: "tier2-merge",
          currentDatasetId: "stable-tier2-dataset",
          currentDatasetRecordId: "stable-tier2-dataset",
          currentOutputChecksum: "c".repeat(64),
          currentPublicationRowCount: 12,
          currentDatasetRowCount: 12,
          currentDatasetStatus: "ready",
        },
        defaultTier2Targets[1],
      ],
    });

    const snapshot = await snapshotCurrentPipelineInputs();

    expect(snapshot.productPublicationIds).toMatchObject({
      "tier2-pgic": "rollback-publication",
    });
    expect(snapshot.aggregate2Members).toEqual([{
      inputKey: "tier2",
      publicationId: "rollback-publication",
      expectedChecksum: "c".repeat(64),
    }]);
  });

  it("fails closed when the current publication pointer disagrees with its stable dataset", async () => {
    execute.mockReset();
    mockDatabaseSnapshot({
      tier2Targets: [{
        productKind: "tier2",
        publicationTargetKey: "tier2-pgic",
        currentPublicationId: "broken-publication",
        currentPublicationTargetKey: "tier2-pgic",
        currentProducerKind: "tier2-merge",
        currentDatasetId: "stable-tier2-dataset",
        currentDatasetRecordId: "stable-tier2-dataset",
        currentOutputChecksum: "d".repeat(64),
        currentPublicationRowCount: 12,
        currentDatasetRowCount: 11,
        currentDatasetStatus: "ready",
      }],
    });

    await expect(snapshotCurrentPipelineInputs()).rejects.toThrow(
      "inconsistent with its stable dataset",
    );
  });
});
