import { Buffer } from "node:buffer";

import { serializeApiConnectionRowsArtifact, serializeApiConnectionRowsToCsv } from "@/lib/api-connection-output";
import type { CsvColumn } from "@/lib/api-types";
import { checksumProductValue } from "@/lib/tier1-products";

import { deletePipelineArtifacts, uploadPipelineArtifact } from "./storage";
import type {
  PipelineArtifactKind,
  PipelineArtifactManifest,
  PipelineArtifactManifestEntry,
  PipelineDefinition,
  PipelinePublicationInput,
} from "./types";
import type { PipelineProductFinding } from "@/lib/tier1-products";

export function getPipelineOutputColumns(rows: readonly Readonly<Record<string, string>>[]): CsvColumn[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))]
    .sort()
    .map((key, sourceIndex) => ({ key, label: key, sourceIndex }));
}

export function serializePipelineRows(
  rows: readonly Readonly<Record<string, string>>[],
  columns = getPipelineOutputColumns(rows),
) {
  return serializeApiConnectionRowsArtifact({ columns, rows: rows.map((row) => ({ ...row })) });
}

export function serializePipelineRowsCsv(
  rows: readonly Readonly<Record<string, string>>[],
  columns = getPipelineOutputColumns(rows),
) {
  return serializeApiConnectionRowsToCsv({ columns, rows: rows.map((row) => ({ ...row })) });
}

export async function persistPipelineArtifacts(input: {
  definition: PipelineDefinition;
  runId: string;
  inputs: readonly Omit<PipelinePublicationInput, "rows">[];
  rows: readonly Readonly<Record<string, string>>[];
  findings: readonly PipelineProductFinding[];
  comparison?: unknown;
}) {
  const columns = getPipelineOutputColumns(input.rows);
  const bodies = new Map<PipelineArtifactKind, string>([
    ["rows-json", serializePipelineRows(input.rows, columns)],
    ["rows-csv", serializePipelineRowsCsv(input.rows, columns)],
    ["findings-json", JSON.stringify({ schemaVersion: 1, findings: input.findings })],
    ["lineage-json", JSON.stringify({
      schemaVersion: 1,
      definitionKey: input.definition.key,
      definitionVersion: input.definition.version,
      definitionChecksum: input.definition.checksum,
      definitionIsWorkspaceVisible: input.definition.isWorkspaceVisible,
      definitionSemanticContract: input.definition.semanticContract,
      inputs: input.inputs,
    })],
  ]);
  if (input.comparison !== undefined) {
    bodies.set("comparison-json", JSON.stringify(input.comparison));
  }

  const created: PipelineArtifactManifestEntry[] = [];
  try {
    for (const [kind, body] of bodies) {
      const storagePath = await uploadPipelineArtifact({
        definitionKey: input.definition.key,
        runId: input.runId,
        kind,
        body,
      });
      created.push({
        kind,
        storagePath,
        checksum: checksumProductValue(body),
        sizeBytes: Buffer.byteLength(body, "utf8"),
        schemaVersion: 1,
      });
    }
  } catch (error) {
    try {
      await deletePipelineArtifacts(created.map((artifact) => artifact.storagePath));
    } catch {
      // The original persistence failure remains the actionable error.
    }
    throw error;
  }

  return {
    columns,
    manifest: { schemaVersion: 1, artifacts: created } satisfies PipelineArtifactManifest,
  };
}
