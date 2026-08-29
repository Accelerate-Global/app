import { describe, expect, it } from "vitest";

import { sha256Hex, type ArchivePackageContent } from "./canonical";
import { buildApiRunRehydratedUploads } from "./rehydration";

function packageContent(): { content: ArchivePackageContent; bodies: Map<string, Uint8Array> } {
  const chunkBody = Buffer.from('{"schemaVersion":1,"columns":[],"rows":[]}');
  const rawChunkBody = Buffer.from("[]");
  const rowsManifest = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    kind: "api-connection-rows-chunks",
    columns: [],
    rowCount: 0,
    chunks: [{
      page: 1,
      path: "runs/one/rows-1.json",
      sizeBytes: chunkBody.byteLength,
      checksum: sha256Hex(chunkBody),
      rowCount: 0,
    }],
  }));
  const rawManifest = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    kind: "api-connection-raw-chunks",
    runId: "run-one",
    connectionId: "connection-one",
    mode: "test",
    responseFormat: "json",
    responseDataPath: "data",
    httpStatus: 200,
    rowCount: 0,
    chunks: [{
      page: 1,
      path: "runs/one/raw-1.json",
      sizeBytes: rawChunkBody.byteLength,
      checksum: sha256Hex(rawChunkBody),
      rowCount: 0,
    }],
  }));
  const source = [
    ["rows-manifest", "runs/one/rows.json", rowsManifest],
    ["raw-manifest", "runs/one/raw.json", rawManifest],
    ["rows-chunk", "runs/one/rows-1.json", chunkBody],
    ["raw-chunk", "runs/one/raw-1.json", rawChunkBody],
  ] as const;
  const members = source.map(([kind, path, body]) => ({
    kind,
    sourceTable: null,
    sourceIdentifier: "run-one",
    storageBucket: "api-connection-artifacts",
    storageObjectPath: path,
    contentType: "application/json",
    sha256: sha256Hex(body),
    sizeBytes: body.byteLength,
  }));
  return {
    content: {
      schemaVersion: 1,
      packageKey: `api-run/run-one/${"a".repeat(64)}`,
      packageKind: "api-run",
      sourceIdentifier: "run-one",
      sourceCreatedAt: "2026-06-01T00:00:00.000Z",
      sourceSha256: "a".repeat(64),
      members,
      rowCount: 0,
      objectCount: members.length,
      sizeBytes: members.reduce((total, member) => total + member.sizeBytes, 0),
    },
    bodies: new Map(source.map(([, path, body]) => [
      `api-connection-artifacts\u0000${path}`,
      body,
    ])),
  };
}

describe("archive package rehydration", () => {
  it("uses collision-free paths and rewrites chunk manifests without changing chunks", () => {
    const fixture = packageContent();
    const prepared = buildApiRunRehydratedUploads({
      packageContent: fixture.content,
      bodies: fixture.bodies,
      requestKey: "rehydrate:run-one:001",
    });
    expect(prepared.uploads.every((upload) =>
      upload.targetPath.startsWith("rehydrated/rehydrate_run-one_001/"),
    )).toBe(true);
    const rowsManifest = JSON.parse(Buffer.from(prepared.rows.body).toString("utf8"));
    expect(rowsManifest.chunks[0].path).toBe(
      "rehydrated/rehydrate_run-one_001/runs/one/rows-1.json",
    );
    const chunk = prepared.uploads.find((upload) => upload.memberKind === "rows-chunk")!;
    expect(chunk.sha256).toBe(fixture.content.members.find((member) => member.kind === "rows-chunk")?.sha256);
  });

  it("fails before upload when any restored member is missing or altered", () => {
    const fixture = packageContent();
    fixture.bodies.delete("api-connection-artifacts\u0000runs/one/raw-1.json");
    expect(() => buildApiRunRehydratedUploads({
      packageContent: fixture.content,
      bodies: fixture.bodies,
      requestKey: "rehydrate:run-one:001",
    })).toThrow("archive_rehydration_member_checksum_mismatch");
  });
});
