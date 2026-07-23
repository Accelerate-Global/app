import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  deletePipelineDatasetBlobMock,
  getDbMock,
  publishPreparedDatasetMock,
  readPipelineArtifactMock,
  uploadPipelineDatasetBlobMock,
} = vi.hoisted(() => ({
  deletePipelineDatasetBlobMock: vi.fn(),
  getDbMock: vi.fn(),
  publishPreparedDatasetMock: vi.fn(),
  readPipelineArtifactMock: vi.fn(),
  uploadPipelineDatasetBlobMock: vi.fn(),
}));

vi.mock("@/db", () => ({ getDb: getDbMock }));
vi.mock("@/lib/datasets", async () => {
  const actual = await vi.importActual<typeof import("@/lib/datasets")>("@/lib/datasets");
  return { ...actual, publishPreparedDataset: publishPreparedDatasetMock };
});
vi.mock("./storage", async () => {
  const actual = await vi.importActual<typeof import("./storage")>("./storage");
  return {
    ...actual,
    deletePipelineDatasetBlob: deletePipelineDatasetBlobMock,
    readPipelineArtifact: readPipelineArtifactMock,
    uploadPipelineDatasetBlob: uploadPipelineDatasetBlobMock,
  };
});

import {
  getPipelineOutputColumns,
  serializePipelineRows,
  serializePipelineRowsCsv,
} from "./artifacts";
import { rollbackPipelineProductTarget } from "./service";
import { checksumProductValue } from "@/lib/tier1-products";
import type {
  PipelineArtifactKind,
  PipelineArtifactManifest,
} from "./types";

const currentPublicationId = "85000000-0000-4000-8000-000000000040";
const retainedPublicationId = "85000000-0000-4000-8000-000000000041";
const retainedRunId = "85000000-0000-4000-8000-000000000042";
const datasetId = "85000000-0000-4000-8000-000000000043";
const releaseSetId = "85000000-0000-4000-8000-000000000044";
const resourceSetId = "85000000-0000-4000-8000-000000000045";
const registryRevisionId = "85000000-0000-4000-8000-000000000046";
const rows = [{ PGIC: "000001", Name: "One" }];
const columns = getPipelineOutputColumns(rows);
const outputChecksum = checksumProductValue(rows);

function retainedEvidence() {
  const bodies = new Map<PipelineArtifactKind, string>([
    ["rows-json", serializePipelineRows(rows, columns)],
    ["rows-csv", serializePipelineRowsCsv(rows, columns)],
    ["findings-json", JSON.stringify({ schemaVersion: 1, findings: [] })],
    ["lineage-json", JSON.stringify({ schemaVersion: 1, retained: true })],
  ]);
  const artifacts = [...bodies].map(([kind, body]) => ({
    kind,
    storagePath: `pipeline/${retainedRunId}/${kind}`,
    checksum: checksumProductValue(body),
    sizeBytes: Buffer.byteLength(body, "utf8"),
    schemaVersion: 1 as const,
  }));
  const manifest: PipelineArtifactManifest = { schemaVersion: 1, artifacts };
  return { bodies, artifacts, manifest };
}

function retainedRun(manifest: PipelineArtifactManifest) {
  return {
    id: retainedRunId,
    definition_key: "aggregate1-south-asia",
    definition_version: "v1",
    definition_checksum: "a".repeat(64),
    release_set_id: releaseSetId,
    parent_publication_id: null,
    resource_set_id: resourceSetId,
    registry_revision_id: registryRevisionId,
    status: "published",
    input_fingerprint: "b".repeat(64),
    input_row_count: 1,
    output_row_count: 1,
    warning_count: 0,
    error_count: 0,
    validation_summary: {},
    artifact_manifest: manifest,
    output_checksum: outputChecksum,
    dataset_id: datasetId,
    publication_id: retainedPublicationId,
    expected_current_publication_id: null,
    publication_attempt_id: null,
    publishing_started_at: null,
    publication_blob_path: "datasets/csv/retained.csv",
    rejection_reason: null,
    publication_reason: "Original publication",
    created_at: "2026-07-23T01:00:00.000Z",
    completed_at: "2026-07-23T01:01:00.000Z",
    is_out_of_date: true,
  };
}

function retainedPublication(manifest: PipelineArtifactManifest) {
  return {
    id: retainedPublicationId,
    producer_kind: "aggregate1",
    producer_run_id: retainedRunId,
    dataset_id: datasetId,
    source_profile_key: null,
    registry_revision_id: registryRevisionId,
    output_checksum: outputChecksum,
    row_count: 1,
    artifact_manifest: manifest,
    publication_target_key: "aggregate1-south-asia",
    producer_definition_key: "aggregate1-south-asia",
    release_set_id: releaseSetId,
    definition_key: "aggregate1-south-asia",
    created_at: "2026-07-23T01:00:00.000Z",
  };
}

function arrangePreflight(options?: {
  currentAtPreflight?: string;
  currentAtCommit?: string;
  tamperPublicationManifest?: boolean;
}) {
  const evidence = retainedEvidence();
  const execute = vi.fn()
    .mockResolvedValueOnce([{
      current_publication_id: options?.currentAtPreflight ?? currentPublicationId,
      dataset_id: datasetId,
      is_workspace_visible: true,
      dataset_status: "ready",
    }])
    .mockResolvedValueOnce([retainedPublication(
      options?.tamperPublicationManifest
        ? { schemaVersion: 1, artifacts: [] }
        : evidence.manifest,
    )])
    .mockResolvedValueOnce([retainedRun(evidence.manifest)])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(evidence.artifacts.map((artifact) => ({
      artifact_kind: artifact.kind,
      storage_path: artifact.storagePath,
      content_checksum: artifact.checksum,
      size_bytes: artifact.sizeBytes,
      schema_version: artifact.schemaVersion,
    })))
    .mockResolvedValueOnce([{ row_index: 0, data: rows[0] }]);
  getDbMock.mockReturnValue({ execute });
  readPipelineArtifactMock.mockImplementation(async (path: string) => {
    const entry = evidence.artifacts.find((artifact) => artifact.storagePath === path);
    return evidence.bodies.get(entry?.kind ?? "rows-json");
  });
  uploadPipelineDatasetBlobMock.mockResolvedValue("datasets/csv/rollback.csv");

  const transactionExecute = vi.fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{
      id: options?.currentAtCommit ?? currentPublicationId,
    }])
    .mockResolvedValueOnce([{ id: retainedPublicationId }])
    .mockResolvedValue([]);
  publishPreparedDatasetMock.mockImplementation(async (input: {
    finalize?: (context: {
      executor: { execute: typeof transactionExecute };
      datasetId: string;
      created: boolean;
      archivedVersionId: string | null;
    }) => Promise<void>;
  }) => {
    await input.finalize?.({
      executor: { execute: transactionExecute },
      datasetId,
      created: false,
      archivedVersionId: "85000000-0000-4000-8000-000000000047",
    });
    return { dataset: { id: datasetId }, created: false, archivedVersionId: null };
  });
  return { execute, transactionExecute };
}

describe("pipeline publication target rollback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    deletePipelineDatasetBlobMock.mockResolvedValue(undefined);
  });

  it("restores exact retained rows and appends a new publication under target CAS", async () => {
    const { transactionExecute } = arrangePreflight();

    await expect(rollbackPipelineProductTarget({
      publicationTargetKey: "aggregate1-south-asia",
      publicationId: retainedPublicationId,
      expectedCurrentPublicationId: currentPublicationId,
      actorOwnerId: "admin-1",
      actorEmail: "admin@example.com",
      reason: "Restore the last reviewed publication",
    })).resolves.toMatchObject({
      definitionKey: "aggregate1-south-asia",
      publicationTargetKey: "aggregate1-south-asia",
      restoredFromPublicationId: retainedPublicationId,
      datasetId,
    });

    expect(uploadPipelineDatasetBlobMock).toHaveBeenCalledWith(expect.objectContaining({
      csv: serializePipelineRowsCsv(rows, columns),
    }));
    expect(publishPreparedDatasetMock).toHaveBeenCalledWith(expect.objectContaining({
      targetDatasetId: datasetId,
      rows,
      columns,
      classification: "PGAC",
      isWorkspaceVisible: true,
    }));
    expect(transactionExecute).toHaveBeenCalledTimes(10);
    expect(deletePipelineDatasetBlobMock).not.toHaveBeenCalled();
  });

  it("rejects a stale rollback review before replacing the stable dataset", async () => {
    arrangePreflight({
      currentAtPreflight: "85000000-0000-4000-8000-000000000099",
    });

    await expect(rollbackPipelineProductTarget({
      publicationTargetKey: "aggregate1-south-asia",
      publicationId: retainedPublicationId,
      expectedCurrentPublicationId: currentPublicationId,
      actorOwnerId: "admin-1",
      actorEmail: "admin@example.com",
      reason: "Restore the last reviewed publication",
    })).rejects.toMatchObject({ code: "rollback-conflict" });
    expect(uploadPipelineDatasetBlobMock).not.toHaveBeenCalled();
    expect(publishPreparedDatasetMock).not.toHaveBeenCalled();
  });

  it("cleans up the prepared blob when the target changes before atomic commit", async () => {
    arrangePreflight({
      currentAtCommit: "85000000-0000-4000-8000-000000000099",
    });

    await expect(rollbackPipelineProductTarget({
      publicationTargetKey: "aggregate1-south-asia",
      publicationId: retainedPublicationId,
      expectedCurrentPublicationId: currentPublicationId,
      actorOwnerId: "admin-1",
      actorEmail: "admin@example.com",
      reason: "Restore the last reviewed publication",
    })).rejects.toMatchObject({ code: "publication-target-changed" });
    expect(deletePipelineDatasetBlobMock).toHaveBeenCalledWith(
      "datasets/csv/rollback.csv",
    );
  });

  it("rejects retained publication evidence that no longer matches its published run", async () => {
    arrangePreflight({ tamperPublicationManifest: true });

    await expect(rollbackPipelineProductTarget({
      publicationTargetKey: "aggregate1-south-asia",
      publicationId: retainedPublicationId,
      expectedCurrentPublicationId: currentPublicationId,
      actorOwnerId: "admin-1",
      actorEmail: "admin@example.com",
      reason: "Restore the last reviewed publication",
    })).rejects.toMatchObject({ code: "rollback-publication-evidence-missing" });
    expect(uploadPipelineDatasetBlobMock).not.toHaveBeenCalled();
    expect(publishPreparedDatasetMock).not.toHaveBeenCalled();
  });
});
