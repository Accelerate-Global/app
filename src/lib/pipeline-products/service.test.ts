import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { deletePipelineDatasetBlobMock, getDbMock } = vi.hoisted(() => ({
  deletePipelineDatasetBlobMock: vi.fn(),
  getDbMock: vi.fn(),
}));

vi.mock("@/db", () => ({ getDb: getDbMock }));
vi.mock("./storage", async () => {
  const actual = await vi.importActual<typeof import("./storage")>("./storage");
  return { ...actual, deletePipelineDatasetBlob: deletePipelineDatasetBlobMock };
});

import {
  getPipelineOutputColumns,
  serializePipelineRows,
  serializePipelineRowsCsv,
} from "./artifacts";
import { getPipelineDefinition } from "./definitions";
import { PipelineProductError } from "./errors";
import {
  assertExpectedCurrentPublication,
  assertPipelineRunDefinitionCurrent,
  executeCommittedPipelinePublication,
  getPipelineProductDatasetPublicationPolicy,
  pipelinePublicationLeaseCutoff,
  publishPipelineRun,
  recoverStalePipelinePublications,
  resolvePipelineBuildExpectedCurrentPublication,
  validatePipelineArtifactManifestEvidence,
  validatePipelineOutputArtifact,
  validatePipelinePublicationArtifacts,
  validatePipelineRollbackSnapshot,
  type PipelineArtifactEvidenceRecord,
} from "./service";
import { checksumProductValue } from "@/lib/tier1-products";
import type { PipelineArtifactKind, PipelineArtifactManifest } from "./types";

describe("pipeline publication artifact validation", () => {
  const rows = [{ PGIC: "000001", Name: "One" }];
  const definition = getPipelineDefinition("aggregate1-south-asia");
  const inputs = [{
    inputKey: "aggregate1-pgac",
    publicationId: "publication-1",
    outputChecksum: "a".repeat(64),
    rowCount: 1,
    registryRevisionId: "revision-1",
  }];

  function artifactBundle(overrides?: Partial<Record<PipelineArtifactKind, string>>) {
    const columns = getPipelineOutputColumns(rows);
    const bodies = new Map<PipelineArtifactKind, string>([
      ["rows-json", serializePipelineRows(rows, columns)],
      ["rows-csv", serializePipelineRowsCsv(rows, columns)],
      ["findings-json", JSON.stringify({ schemaVersion: 1, findings: [] })],
      ["lineage-json", JSON.stringify({
        schemaVersion: 1,
        definitionKey: definition.key,
        definitionVersion: definition.version,
        definitionChecksum: definition.checksum,
        definitionIsWorkspaceVisible: definition.isWorkspaceVisible,
        definitionSemanticContract: definition.semanticContract,
        inputs,
      })],
    ]);
    for (const [kind, body] of Object.entries(overrides ?? {})) {
      if (body !== undefined) bodies.set(kind as PipelineArtifactKind, body);
    }
    const records: PipelineArtifactEvidenceRecord[] = [...bodies].map(([kind, body]) => ({
      kind,
      storagePath: `pipeline/run-1/${kind}`,
      checksum: checksumProductValue(body),
      sizeBytes: Buffer.byteLength(body, "utf8"),
      schemaVersion: 1,
    }));
    const manifest: PipelineArtifactManifest = {
      schemaVersion: 1,
      artifacts: records.map((record) => ({ ...record, schemaVersion: 1 })),
    };
    return { bodies, records, manifest };
  }

  it("returns the exact reviewed rows when row count and checksum match", () => {
    const artifact = validatePipelineOutputArtifact({
      body: serializePipelineRows(rows),
      expectedRowCount: 1,
      expectedChecksum: checksumProductValue(rows),
    });
    expect(artifact.rows).toEqual(rows);
  });

  it("blocks publication when archived rows were tampered with", () => {
    expect(() => validatePipelineOutputArtifact({
      body: serializePipelineRows([{ ...rows[0], Name: "Changed" }]),
      expectedRowCount: 1,
      expectedChecksum: checksumProductValue(rows),
    })).toThrowError(PipelineProductError);
  });

  it("blocks publication when the archived row count is incomplete", () => {
    expect(() => validatePipelineOutputArtifact({
      body: serializePipelineRows([]),
      expectedRowCount: 1,
      expectedChecksum: checksumProductValue(rows),
    })).toThrow("no longer matches its reviewed checksum");
  });

  it("requires retained publication rows and CSV to match the immutable rollback snapshot", () => {
    const columns = getPipelineOutputColumns(rows);
    const rowsBody = serializePipelineRows(rows, columns);
    const csvBody = serializePipelineRowsCsv(rows, columns);

    expect(validatePipelineRollbackSnapshot({
      rowsBody,
      csvBody,
      publicationRows: rows,
      expectedRowCount: 1,
      expectedOutputChecksum: checksumProductValue(rows),
    })).toEqual({ rows, columns });

    expect(() => validatePipelineRollbackSnapshot({
      rowsBody,
      csvBody,
      publicationRows: [{ ...rows[0], Name: "Tampered" }],
      expectedRowCount: 1,
      expectedOutputChecksum: checksumProductValue(rows),
    })).toThrow("publication rows no longer match");
  });

  it("validates the complete immutable artifact bundle", () => {
    const bundle = artifactBundle();
    expect(validatePipelinePublicationArtifacts({
      ...bundle,
      expectedRowCount: 1,
      expectedOutputChecksum: checksumProductValue(rows),
      definition,
      inputs,
      findings: [],
    })).toEqual({ rows, columns: getPipelineOutputColumns(rows) });
  });

  it("publishes approved final products into the normal workspace dataset list", () => {
    expect(getPipelineProductDatasetPublicationPolicy(definition)).toEqual({
      classification: "PGAC",
      isWorkspaceVisible: true,
    });
  });

  it("blocks publication when reviewed column metadata was tampered with", () => {
    const canonicalColumns = getPipelineOutputColumns(rows);
    const tamperedColumns = canonicalColumns.map((column) => ({
      ...column,
      label: `Tampered ${column.label}`,
    }));
    const bundle = artifactBundle({
      "rows-json": serializePipelineRows(rows, tamperedColumns),
      "rows-csv": serializePipelineRowsCsv(rows, tamperedColumns),
    });
    expect(() => validatePipelinePublicationArtifacts({
      ...bundle,
      expectedRowCount: 1,
      expectedOutputChecksum: checksumProductValue(rows),
      definition,
      inputs,
      findings: [],
    })).toThrow("columns no longer match");
  });

  it("blocks publication when any stored body diverges from immutable evidence", () => {
    const bundle = artifactBundle();
    const bodies = new Map(bundle.bodies);
    bodies.set("lineage-json", `${bodies.get("lineage-json")} `);
    expect(() => validatePipelinePublicationArtifacts({
      ...bundle,
      bodies,
      expectedRowCount: 1,
      expectedOutputChecksum: checksumProductValue(rows),
      definition,
      inputs,
      findings: [],
    })).toThrow("immutable checksum and size");
  });

  it("blocks publication when the run manifest diverges from immutable records", () => {
    const bundle = artifactBundle();
    const manifest = {
      ...bundle.manifest,
      artifacts: bundle.manifest.artifacts.map((artifact) =>
        artifact.kind === "rows-json"
          ? { ...artifact, storagePath: "pipeline/run-1/replaced-rows-json" }
          : artifact,
      ),
    };
    expect(() => validatePipelineArtifactManifestEvidence({
      manifest,
      records: bundle.records,
    })).toThrow("does not match its immutable artifact records");
  });

  it("blocks a stale run after a definition or input publication changes", () => {
    expect(() =>
      assertPipelineRunDefinitionCurrent({
        runDefinitionVersion: "v1",
        runDefinitionChecksum: "old",
        activeDefinitionVersion: "v2",
        activeDefinitionChecksum: "new",
        isOutOfDate: false,
      }),
    ).toThrowError(PipelineProductError);
    expect(() =>
      assertPipelineRunDefinitionCurrent({
        runDefinitionVersion: "v2",
        runDefinitionChecksum: "new",
        activeDefinitionVersion: "v2",
        activeDefinitionChecksum: "new",
        isOutOfDate: true,
      }),
    ).toThrow("stale");
  });
});

describe("pipeline publication safety", () => {
  beforeEach(() => vi.resetAllMocks());

  it("allows only the first of two reviewed candidates to replace the same expected target", () => {
    expect(() => assertExpectedCurrentPublication({
      expectedPublicationId: "publication-before-review",
      actualPublicationId: "publication-before-review",
    })).not.toThrow();

    expect(() => assertExpectedCurrentPublication({
      expectedPublicationId: "publication-before-review",
      actualPublicationId: "publication-from-first-candidate",
    })).toThrow("publication target changed");
  });

  it("retains a coordinator-pinned stable target instead of substituting the current pointer", () => {
    expect(resolvePipelineBuildExpectedCurrentPublication({
      pinnedPublicationId: "publication-at-launch",
      currentPublicationId: "publication-that-arrived-later",
    })).toBe("publication-at-launch");
    expect(resolvePipelineBuildExpectedCurrentPublication({
      pinnedPublicationId: null,
      currentPublicationId: "publication-that-arrived-later",
    })).toBeNull();
    expect(resolvePipelineBuildExpectedCurrentPublication({
      pinnedPublicationId: undefined,
      currentPublicationId: "current-for-uncoordinated-build",
    })).toBe("current-for-uncoordinated-build");
  });

  it("does not compensate a committed publication when detail hydration fails", async () => {
    const compensate = vi.fn();
    await expect(executeCommittedPipelinePublication({
      publish: async () => ({ publicationId: "publication-1" }),
      hydrate: async () => { throw new Error("injected hydration failure"); },
      compensate,
    })).rejects.toThrow("injected hydration failure");
    expect(compensate).not.toHaveBeenCalled();
  });

  it("compensates when the atomic dataset publication does not commit", async () => {
    const compensate = vi.fn();
    await expect(executeCommittedPipelinePublication({
      publish: async () => { throw new Error("injected commit failure"); },
      hydrate: vi.fn(),
      compensate,
    })).rejects.toThrow("injected commit failure");
    expect(compensate).toHaveBeenCalledOnce();
  });

  it("atomically recovers an expired publishing lease and removes its prepared blob", async () => {
    const execute = vi.fn().mockResolvedValue([{ id: "run-1", publication_blob_path: "datasets/csv/stale.csv" }]);
    getDbMock.mockReturnValue({ transaction: (callback: (tx: { execute: typeof execute }) => unknown) => callback({ execute }) });
    deletePipelineDatasetBlobMock.mockResolvedValue(undefined);

    const now = new Date("2026-07-23T01:00:00.000Z");
    await expect(recoverStalePipelinePublications({ runId: "85000000-0000-4000-8000-000000000030", now })).resolves.toBe(1);
    expect(pipelinePublicationLeaseCutoff(now).toISOString()).toBe("2026-07-23T00:45:00.000Z");
    expect(deletePipelineDatasetBlobMock).toHaveBeenCalledWith("datasets/csv/stale.csv");
  });

  it("returns an already-published Tier 1 run without repeating publication side effects", async () => {
    const runId = "85000000-0000-4000-8000-000000000030";
    const publicationId = "85000000-0000-4000-8000-000000000040";
    const execute = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: runId,
        definition_key: "aggregate1-south-asia",
        definition_version: "v1",
        definition_checksum: "a".repeat(64),
        release_set_id: "85000000-0000-4000-8000-000000000050",
        parent_publication_id: null,
        resource_set_id: "85000000-0000-4000-8000-000000000051",
        registry_revision_id: "85000000-0000-4000-8000-000000000052",
        status: "published",
        input_fingerprint: "b".repeat(64),
        input_row_count: 1,
        output_row_count: 1,
        warning_count: 0,
        error_count: 0,
        validation_summary: {},
        artifact_manifest: { schemaVersion: 1, artifacts: [] },
        output_checksum: "c".repeat(64),
        dataset_id: "85000000-0000-4000-8000-000000000053",
        publication_id: publicationId,
        expected_current_publication_id: null,
        publication_attempt_id: null,
        publishing_started_at: null,
        publication_blob_path: "datasets/csv/stable.csv",
        rejection_reason: null,
        publication_reason: "Original publication",
        created_at: "2026-07-23T01:00:00.000Z",
        completed_at: "2026-07-23T01:01:00.000Z",
        is_out_of_date: false,
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    getDbMock.mockReturnValue({
      transaction: (callback: (tx: { execute: typeof execute }) => unknown) =>
        callback({ execute }),
      execute,
    });

    await expect(publishPipelineRun({
      runId,
      reason: "Retry after a lost response",
      acknowledgeWarnings: false,
      expectedCurrentPublicationId: null,
      actorOwnerId: "admin-1",
      actorEmail: "admin@example.com",
    })).resolves.toMatchObject({
      id: runId,
      status: "published",
      publicationId,
    });
    expect(execute).toHaveBeenCalledTimes(4);
    expect(deletePipelineDatasetBlobMock).not.toHaveBeenCalled();
  });
});
