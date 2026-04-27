import type { ApiConnectionRunMode, CsvColumn } from "@/lib/api-types";

export const UTF8_BOM = "\uFEFF";

export type ApiConnectionRowsArtifact = {
  columns: CsvColumn[];
  rows: Record<string, string>[];
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

function escapeCsvCell(value: string) {
  return /[",\r\n]/u.test(value) ? `"${value.replace(/"/g, "\"\"")}"` : value;
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
  };
}
