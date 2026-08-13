import { beforeEach, describe, expect, it, vi } from "vitest";

import { checksumIdentityValue, prepareAxIdentityArtifacts } from "./artifacts";
import {
  getAxIdentityRun,
  getAxIdentityAuthorityStatus,
  getCurrentIdentityPublication,
  listActiveIdentityBindings,
  listAxIdentityRuns,
  listIdentityRegistryRevisions,
} from "./repository";
import {
  assertExpectedIdentityPublication,
  assertFreshIdentityAuthority,
  getAxIdentityRegistryOverview,
  getAxIdentityPublicationTargetKey,
  publishAxIdentityCandidate,
  stripSourceSuppliedAxCodes,
} from "./service";

const { executeMock, publishPreparedDatasetMock, readArtifactMock, uploadDatasetBlobMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
  publishPreparedDatasetMock: vi.fn(),
  readArtifactMock: vi.fn(),
  uploadDatasetBlobMock: vi.fn(),
}));

vi.mock("@/db", () => ({ getDb: () => ({ execute: executeMock }) }));
vi.mock("@/lib/datasets", () => ({ publishPreparedDataset: publishPreparedDatasetMock }));
vi.mock("@/lib/pipeline-products/storage", () => ({
  deletePipelineDatasetBlob: vi.fn(),
  uploadPipelineDatasetBlob: uploadDatasetBlobMock,
}));
vi.mock("./storage", async () => {
  const actual = await vi.importActual<typeof import("./storage")>("./storage");
  return { ...actual, readAxIdentityArtifact: readArtifactMock };
});

vi.mock("./repository", async () => {
  const actual = await vi.importActual<typeof import("./repository")>("./repository");
  return {
    ...actual,
    getAxIdentityRun: vi.fn(),
    getAxIdentityAuthorityStatus: vi.fn(),
    getCurrentIdentityPublication: vi.fn(),
    listActiveIdentityBindings: vi.fn(),
    listAxIdentityRuns: vi.fn(),
    listIdentityRegistryRevisions: vi.fn(),
  };
});

describe("AX identity registry service", () => {
  beforeEach(() => vi.resetAllMocks());

  it("uses one stable publication target per source and rejects a stale target pin", () => {
    expect(getAxIdentityPublicationTargetKey("imb-people-groups")).toBe(
      "identity-imb-people-groups",
    );
    expect(() => assertExpectedIdentityPublication({
      expectedCurrentPublicationId: "publication-1",
      currentPublicationId: "publication-2",
    })).toThrow("A newer identity publication");
  });

  it("blocks publication when the stored CSV blob no longer matches reviewed evidence", async () => {
    const rows = [{
      sourceRowIndex: 0,
      stableRowKey: "jp:1",
      assignmentStatus: "reused" as const,
      bindingId: "binding-1",
      pgacCode: "10-jp-100001",
      pgicCode: "10-jp-100001-LAO",
      enrichedRow: { Dataset_Row_Key: "jp:1", AX_PGIC: "10-jp-100001-LAO" },
    }];
    const artifacts = prepareAxIdentityArtifacts({
      runId: "84000000-0000-4000-8000-000000000010",
      sourcePublicationId: "84000000-0000-4000-8000-000000000011",
      sourceProfileKey: "jp",
      baseRevisionId: "84000000-0000-4000-8000-000000000012",
      rulesVersion: "v1",
      rulesChecksum: "a".repeat(64),
      resourceBindings: {},
      rows,
      findings: [],
    });
    const paths = Object.fromEntries(
      (["rows", "findings", "manifest", "csv"] as const).map((kind) => [kind, `identity/${kind}`]),
    );
    vi.mocked(getAxIdentityRun).mockResolvedValue({
      id: "84000000-0000-4000-8000-000000000010",
      attemptNumber: 1,
      sourcePublicationId: "84000000-0000-4000-8000-000000000011",
      baseRevisionId: "84000000-0000-4000-8000-000000000012",
      sourceProfileKey: "jp",
      rulesVersion: "v1",
      rulesChecksum: "a".repeat(64),
      resourceBindings: {},
      inputFingerprint: "b".repeat(64),
      publicationTargetKey: "identity-jp",
      expectedCurrentPublicationId: "84000000-0000-4000-8000-000000000013",
      status: "valid",
      inputRowCount: 1,
      outputRowCount: 1,
      reusedCount: 1,
      reservedCount: 0,
      conflictCount: 0,
      unassignableCount: 0,
      warningCount: 0,
      errorCount: 0,
      outputChecksum: artifacts.outputChecksum,
      artifactManifest: paths,
      datasetId: null,
      publicationId: null,
      isCurrentPublication: false,
      registryRevisionId: null,
      rejectionReason: null,
      publicationReason: null,
      reservationExpiresAt: null,
      createdAt: "2026-07-22T00:00:00.000Z",
      completedAt: "2026-07-22T00:00:01.000Z",
      findings: [],
      rows,
      decisions: [],
    });
    const tamperedCsv = `${artifacts.csv}\r\ntampered`;
    const bodyByPath = new Map([
      [paths.rows, artifacts.rowsJson],
      [paths.findings, artifacts.findingsJson],
      [paths.manifest, artifacts.manifestJson],
      [paths.csv, tamperedCsv],
    ]);
    readArtifactMock.mockImplementation(async (path: string) => bodyByPath.get(path)!);
    executeMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { artifact_kind: "rows", storage_path: paths.rows, content_checksum: checksumIdentityValue(artifacts.rowsJson), size_bytes: Buffer.byteLength(artifacts.rowsJson) },
        { artifact_kind: "findings", storage_path: paths.findings, content_checksum: checksumIdentityValue(artifacts.findingsJson), size_bytes: Buffer.byteLength(artifacts.findingsJson) },
        { artifact_kind: "manifest", storage_path: paths.manifest, content_checksum: checksumIdentityValue(artifacts.manifestJson), size_bytes: Buffer.byteLength(artifacts.manifestJson) },
        { artifact_kind: "csv", storage_path: paths.csv, content_checksum: checksumIdentityValue(artifacts.csv), size_bytes: Buffer.byteLength(artifacts.csv) },
      ]);
    vi.mocked(getCurrentIdentityPublication).mockResolvedValue({
      id: "84000000-0000-4000-8000-000000000013",
      producerKind: "identity",
      producerRunId: "prior-run",
      datasetId: "prior-dataset",
      sourceProfileKey: "jp",
      publicationTargetKey: "identity-jp",
      registryRevisionId: "prior-revision",
      outputChecksum: "c".repeat(64),
      rowCount: 1,
      artifactManifest: {},
      createdAt: "2026-07-21T00:00:00.000Z",
    });

    await expect(publishAxIdentityCandidate({
      runId: "84000000-0000-4000-8000-000000000010",
      reason: "Publish identity",
      identity: {
        ownerId: "admin",
        email: "admin@example.com",
        fullName: "Admin",
        workspaceRole: "admin",
        isDatasetAdmin: true,
        mode: "supabase",
      },
    })).rejects.toThrow("artifact evidence");
    expect(uploadDatasetBlobMock).not.toHaveBeenCalled();
    expect(publishPreparedDatasetMock).not.toHaveBeenCalled();
    expect(getCurrentIdentityPublication).not.toHaveBeenCalled();
  });

  it("loads registry, revision, and candidate history as one admin overview", async () => {
    vi.mocked(listActiveIdentityBindings).mockResolvedValue([]);
    vi.mocked(listIdentityRegistryRevisions).mockResolvedValue([]);
    vi.mocked(listAxIdentityRuns).mockResolvedValue([]);
    vi.mocked(getAxIdentityAuthorityStatus).mockResolvedValue({
      initialized: true,
      environment: "test",
      registryRevisionId: "revision-1",
      revisionNumber: 1,
      rulesChecksum: "a".repeat(64),
      formatterChecksum: "b".repeat(64),
      activatedAt: "2026-08-12T00:00:00.000Z",
    });

    await expect(getAxIdentityRegistryOverview()).resolves.toEqual({
      authority: {
        initialized: true,
        environment: "test",
        registryRevisionId: "revision-1",
        revisionNumber: 1,
        rulesChecksum: "a".repeat(64),
        formatterChecksum: "b".repeat(64),
        activatedAt: "2026-08-12T00:00:00.000Z",
      },
      bindings: [],
      revisions: [],
      runs: [],
    });
  });

  it("blocks allocations until the fresh authority and a base revision are pinned", () => {
    expect(() =>
      assertFreshIdentityAuthority({
        initialized: false,
        authorityRevisionId: null,
        baseRevisionId: null,
      }),
    ).toThrow("fresh AX Online identity authority");
    expect(() =>
      assertFreshIdentityAuthority({
        initialized: true,
        authorityRevisionId: "revision-1",
        baseRevisionId: undefined,
      }),
    ).toThrow("exact AX Online registry revision");
    expect(() =>
      assertFreshIdentityAuthority({
        initialized: true,
        authorityRevisionId: "revision-1",
        baseRevisionId: "revision-1",
      }),
    ).not.toThrow();
  });

  it("removes source-supplied historical AX fields before forming output", () => {
    expect(stripSourceSuppliedAxCodes({
      Dataset_Row_Key: "jp:1",
      AX_CODE: "legacy-code",
      pgac: "legacy-pgac",
      AX_PGIC: "legacy-pgic",
      PeopleName: "Current name",
    })).toEqual({
      Dataset_Row_Key: "jp:1",
      PeopleName: "Current name",
    });
  });
});
