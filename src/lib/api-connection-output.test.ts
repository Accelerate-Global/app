import { describe, expect, it } from "vitest";

import {
  parseApiConnectionRowsArtifact,
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
];

describe("API connection output helpers", () => {
  it("serializes normalized rows as UTF-8 BOM CSV with CRLF rows", () => {
    expect(serializeApiConnectionRowsToCsv({ columns, rows })).toBe(
      `${UTF8_BOM}Name,Notes\r\nAlpha,Line one\r\nBeta,"Line ""two""\nwrapped"\r\n`,
    );
  });

  it("round-trips normalized rows artifacts", () => {
    const artifact = serializeApiConnectionRowsArtifact({ columns, rows });

    expect(parseApiConnectionRowsArtifact(artifact)).toEqual({ columns, rows });
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
});
