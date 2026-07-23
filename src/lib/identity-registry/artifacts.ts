import { createHash } from "node:crypto";

import type { CsvColumn } from "@/lib/api-types";
import { escapeCsvCell } from "@/lib/csv";

import type {
  AxIdentityCandidateRow,
  AxIdentityFinding,
  AxIdentityPreparedArtifacts,
} from "./types";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function canonicalIdentityJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function checksumIdentityValue(value: unknown) {
  return createHash("sha256").update(canonicalIdentityJson(value)).digest("hex");
}

function columnsForRows(rows: readonly AxIdentityCandidateRow[]): CsvColumn[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.enrichedRow)) keys.add(key);
  }
  return [...keys].sort().map((key, sourceIndex) => ({ key, label: key, sourceIndex }));
}

export function prepareAxIdentityArtifacts(input: {
  runId: string;
  sourcePublicationId: string;
  sourceProfileKey: string;
  baseRevisionId: string | null;
  rulesVersion: string;
  rulesChecksum: string;
  resourceBindings: Readonly<Record<string, string>>;
  rows: readonly AxIdentityCandidateRow[];
  findings: readonly AxIdentityFinding[];
}): AxIdentityPreparedArtifacts {
  const columns = columnsForRows(input.rows);
  const rowsJson = canonicalIdentityJson(input.rows);
  const findingsJson = canonicalIdentityJson(input.findings);
  const outputChecksum = checksumIdentityValue(
    input.rows.map((row) => ({ sourceRowIndex: row.sourceRowIndex, data: row.enrichedRow })),
  );
  const csv = [
    columns.map((column) => escapeCsvCell(column.label)).join(","),
    ...input.rows.map((row) =>
      columns.map((column) => escapeCsvCell(row.enrichedRow[column.key] ?? "")).join(","),
    ),
  ].join("\r\n");
  const csvChecksum = checksumIdentityValue(csv);
  const manifestJson = canonicalIdentityJson({
    schemaVersion: 2,
    runId: input.runId,
    sourcePublicationId: input.sourcePublicationId,
    sourceProfileKey: input.sourceProfileKey,
    baseRevisionId: input.baseRevisionId,
    rulesVersion: input.rulesVersion,
    rulesChecksum: input.rulesChecksum,
    resourceBindings: input.resourceBindings,
    rowCount: input.rows.length,
    findingCount: input.findings.length,
    rowsChecksum: checksumIdentityValue(input.rows),
    findingsChecksum: checksumIdentityValue(input.findings),
    csvChecksum,
    outputChecksum,
  });

  return {
    rowsJson,
    findingsJson,
    manifestJson,
    csv,
    csvChecksum,
    outputChecksum,
    columns,
  };
}
