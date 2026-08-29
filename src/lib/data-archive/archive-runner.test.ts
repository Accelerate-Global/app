import { describe, expect, it } from "vitest";

import {
  assertPostgres17Tooling,
  buildDatasetVersionPackageContent,
  buildPipelinePublicationPackageContent,
  extractProviderStorageInventory,
  managedExportSql,
  parseManagedExport,
  parsePinnedToolVersion,
} from "./archive-runner";
import { sha256Hex, type StorageInventory } from "./canonical";

describe("Samson archive runner", () => {
  it("exports managed rows as raw NDJSON without PostgreSQL COPY escaping", () => {
    const sql = managedExportSql("storage");
    expect(sql).toMatch(/^select jsonb_build_object/);
    expect(sql).not.toContain("copy (");
    expect(sql).toContain("order by source_table, source_ordinal");
  });

  it("reads pinned provider tool provenance without executing the provider CLI", () => {
    expect(parsePinnedToolVersion("restic\t0.16.4\nsupabase\t2.109.1\n", "supabase"))
      .toBe("2.109.1");
    expect(() => parsePinnedToolVersion("restic\t0.16.4\n", "supabase"))
      .toThrow("archive_toolchain_version_missing_supabase");
  });

  it("parses managed Storage metadata into stable bucket and object identities", () => {
    const rows = parseManagedExport(
      [
        JSON.stringify({
          source_table: "objects",
          source_ordinal: 2,
          row_data: {
            bucket_id: "api-connection-artifacts",
            name: "run/two.json",
            version: "v2",
            updated_at: "2026-08-27T09:00:00.000Z",
            metadata: { size: 20, mimetype: "application/json", eTag: "etag-two" },
          },
        }),
        JSON.stringify({
          source_table: "buckets",
          source_ordinal: 1,
          row_data: { id: "api-connection-artifacts" },
        }),
        JSON.stringify({
          source_table: "objects",
          source_ordinal: 1,
          row_data: {
            bucket_id: "api-connection-artifacts",
            name: "run/one.json",
            updated_at: "2026-08-27T08:00:00.000Z",
            metadata: { size: "10", mimetype: "application/json", eTag: "etag-one" },
          },
        }),
      ].join("\n"),
    );
    const inventory = extractProviderStorageInventory(rows);
    expect(inventory.buckets).toEqual(["api-connection-artifacts"]);
    expect(inventory.objects.map((object) => object.path)).toEqual([
      "run/one.json",
      "run/two.json",
    ]);
    expect(inventory.objects[0]).toMatchObject({ sizeBytes: 10, version: null });
  });

  it("rejects duplicate identities, unsafe paths, and invalid sizes", () => {
    const duplicate = JSON.stringify({
      source_table: "objects",
      source_ordinal: 1,
      row_data: {
        bucket_id: "bucket-one",
        name: "same.json",
        metadata: { size: 1 },
      },
    });
    expect(() =>
      extractProviderStorageInventory(parseManagedExport(`${duplicate}\n${duplicate}`)),
    ).toThrow("storage_metadata_duplicate_object");
    expect(() =>
      extractProviderStorageInventory(parseManagedExport(JSON.stringify({
        source_table: "objects",
        source_ordinal: 1,
        row_data: { bucket_id: "bucket-one", name: "../../escape", metadata: { size: 1 } },
      }))),
    ).toThrow("archive_storage_path_escape");
    expect(() =>
      extractProviderStorageInventory(parseManagedExport(JSON.stringify({
        source_table: "objects",
        source_ordinal: 1,
        row_data: { bucket_id: "bucket-one", name: "valid", metadata: { size: -1 } },
      }))),
    ).toThrow("storage_metadata_size_invalid");
  });

  it("requires PostgreSQL 17 server and client tooling", () => {
    expect(() => assertPostgres17Tooling({
      serverVersion: "17.6.1.104",
      clientVersion: "pg_dump (PostgreSQL) 17.11",
    })).not.toThrow();
    expect(() => assertPostgres17Tooling({
      serverVersion: "17.6.1.104",
      clientVersion: "pg_dump (PostgreSQL) 16.9",
    })).toThrow("archive_postgres_17_client_required");
  });

  it("builds stable content-addressed dataset and pipeline packages", () => {
    const datasetBody = Buffer.from("dataset-csv");
    const artifactBody = Buffer.from("pipeline-json");
    const inventory: StorageInventory = {
      schemaVersion: 1,
      capturedAt: "2026-08-27T09:00:00.000Z",
      objectCount: 3,
      totalBytes: datasetBody.byteLength * 2 + artifactBody.byteLength,
      objects: [
        {
          bucket: "datasets",
          path: "datasets/csv/version.csv",
          version: null,
          sizeBytes: datasetBody.byteLength,
          contentType: "text/csv",
          providerEtag: null,
          lastModified: "2026-06-01T00:00:00.000Z",
          localSha256: sha256Hex(datasetBody),
        },
        {
          bucket: "datasets",
          path: "datasets/csv/publication.csv",
          version: null,
          sizeBytes: datasetBody.byteLength,
          contentType: "text/csv",
          providerEtag: null,
          lastModified: "2026-06-01T00:00:00.000Z",
          localSha256: sha256Hex(datasetBody),
        },
        {
          bucket: "api-connection-artifacts",
          path: "pipeline-products/tier2/run/rows-json.json",
          version: null,
          sizeBytes: artifactBody.byteLength,
          contentType: "application/json",
          providerEtag: null,
          lastModified: "2026-06-01T00:00:00.000Z",
          localSha256: sha256Hex(artifactBody),
        },
      ],
    };
    const dataset = buildDatasetVersionPackageContent({
      candidate: {
        versionId: "version-one",
        datasetId: "dataset-one",
        sourceCreatedAt: "2026-06-01T00:00:00.000Z",
        rowCount: 2,
        fileName: "version.csv",
        blobPath: "datasets/csv/version.csv",
        action: "upload",
        status: "ready",
        columns: [{ key: "name", label: "Name", sourceIndex: 0 }],
      },
      inventory,
      datasetBucket: "datasets",
    });
    expect(dataset.packageKey).toMatch(
      /^dataset-version\/version-one\/[0-9a-f]{64}$/,
    );
    expect(dataset.members.map((member) => member.kind)).toEqual([
      "dataset-blob",
      "dataset-version-record",
      "dataset-version-rows",
    ]);

    const pipeline = buildPipelinePublicationPackageContent({
      candidate: {
        publicationId: "publication-one",
        producerKind: "tier2-merge",
        producerRunId: "run-one",
        datasetId: "dataset-two",
        sourceCreatedAt: "2026-06-01T00:00:00.000Z",
        outputChecksum: "a".repeat(64),
        rowCount: 2,
        publicationTargetKey: "tier2-pgic",
        datasetBlobPath: "datasets/csv/publication.csv",
        artifacts: [{
          kind: "rows-json",
          storagePath: "pipeline-products/tier2/run/rows-json.json",
          contentChecksum: sha256Hex(artifactBody),
          sizeBytes: artifactBody.byteLength,
        }],
      },
      inventory,
      datasetBucket: "datasets",
      artifactBucket: "api-connection-artifacts",
    });
    expect(pipeline.packageKind).toBe("tier2-publication");
    expect(pipeline.packageKey).toMatch(
      /^tier2-publication\/publication-one\/[0-9a-f]{64}$/,
    );
    expect(pipeline.objectCount).toBe(2);
  });

  it("rejects a pipeline package when artifact evidence differs from Storage", () => {
    expect(() => buildPipelinePublicationPackageContent({
      candidate: {
        publicationId: "publication-one",
        producerKind: "aggregate1",
        producerRunId: "run-one",
        datasetId: "dataset-one",
        sourceCreatedAt: "2026-06-01T00:00:00.000Z",
        outputChecksum: "a".repeat(64),
        rowCount: 1,
        publicationTargetKey: "aggregate1",
        datasetBlobPath: "datasets/csv/publication.csv",
        artifacts: [{
          kind: "rows-json",
          storagePath: "pipeline/run/rows.json",
          contentChecksum: "b".repeat(64),
          sizeBytes: 2,
        }],
      },
      inventory: {
        schemaVersion: 1,
        capturedAt: "2026-08-27T09:00:00.000Z",
        objectCount: 2,
        totalBytes: 2,
        objects: [
          {
            bucket: "datasets",
            path: "datasets/csv/publication.csv",
            version: null,
            sizeBytes: 1,
            contentType: "text/csv",
            providerEtag: null,
            lastModified: null,
            localSha256: "c".repeat(64),
          },
          {
            bucket: "api-connection-artifacts",
            path: "pipeline/run/rows.json",
            version: null,
            sizeBytes: 1,
            contentType: "application/json",
            providerEtag: null,
            lastModified: null,
            localSha256: "d".repeat(64),
          },
        ],
      },
      datasetBucket: "datasets",
      artifactBucket: "api-connection-artifacts",
    })).toThrow("archive_pipeline_artifact_mismatch");
  });
});
