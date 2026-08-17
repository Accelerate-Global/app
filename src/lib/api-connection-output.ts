import { createHash } from "node:crypto";

import type { ApiConnectionRunMode, CsvColumn } from "@/lib/api-types";
import { escapeCsvCell } from "@/lib/csv";

export const UTF8_BOM = "\uFEFF";

export type ApiConnectionRowsArtifact = {
  columns: CsvColumn[];
  rows: Record<string, string>[];
  sourceAdapter?: {
    name: string;
    version: string;
    checksum: string;
  };
};

export type ApiConnectionRawResponseArtifact = {
  runId: string;
  connectionId: string;
  mode: ApiConnectionRunMode;
  responseFormat: "json" | "csv";
  responseDataPath: string;
  httpStatus: number | null;
  rowCount: number;
  rawResponse: string;
};

export type ApiConnectionArtifactChunk = {
  page: number;
  path: string;
  sizeBytes: number;
  checksum: string;
  rowCount: number;
};

export type ApiConnectionRowsChunkManifest = {
  schemaVersion: 1;
  kind: "api-connection-rows-chunks";
  columns: CsvColumn[];
  rowCount: number;
  chunks: ApiConnectionArtifactChunk[];
};

export type ApiConnectionRawChunkManifest = {
  schemaVersion: 1;
  kind: "api-connection-raw-chunks";
  runId: string;
  connectionId: string;
  mode: ApiConnectionRunMode;
  responseFormat: "json" | "csv";
  responseDataPath: string;
  httpStatus: number | null;
  rowCount: number;
  chunks: ApiConnectionArtifactChunk[];
};

export function checksumApiConnectionArtifact(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function serializeApiConnectionRowsToCsv(input: ApiConnectionRowsArtifact) {
  const lines = [
    input.columns.map((column) => escapeCsvCell(column.label)).join(","),
    ...input.rows.map((row) =>
      input.columns
        .map((column) => escapeCsvCell(row[column.key] ?? ""))
        .join(","),
    ),
  ];

  return `${UTF8_BOM}${lines.join("\r\n")}\r\n`;
}

export function serializeApiConnectionRowsArtifact(
  input: ApiConnectionRowsArtifact,
) {
  return JSON.stringify(input, null, 2);
}

export function serializeApiConnectionRawResponseArtifact(
  input: ApiConnectionRawResponseArtifact,
) {
  return JSON.stringify(input, null, 2);
}

export function parseApiConnectionRowsArtifact(value: string) {
  const parsed = JSON.parse(value) as Partial<ApiConnectionRowsArtifact>;

  return {
    columns: Array.isArray(parsed.columns) ? parsed.columns : [],
    rows: Array.isArray(parsed.rows) ? parsed.rows : [],
    ...(parsed.sourceAdapter ? { sourceAdapter: parsed.sourceAdapter } : {}),
  };
}

export function parseApiConnectionRowsChunkManifest(value: string) {
  const parsed = JSON.parse(value) as Partial<ApiConnectionRowsChunkManifest>;

  return parsed.schemaVersion === 1 &&
    parsed.kind === "api-connection-rows-chunks" &&
    Array.isArray(parsed.columns) &&
    Array.isArray(parsed.chunks)
    ? (parsed as ApiConnectionRowsChunkManifest)
    : null;
}

export function parseApiConnectionRawChunkManifest(value: string) {
  const parsed = JSON.parse(value) as Partial<ApiConnectionRawChunkManifest>;

  return parsed.schemaVersion === 1 &&
    parsed.kind === "api-connection-raw-chunks" &&
    Array.isArray(parsed.chunks)
    ? (parsed as ApiConnectionRawChunkManifest)
    : null;
}
