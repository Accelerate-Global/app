import { Buffer } from "node:buffer";

import { parseApiConnectionRowsArtifact } from "@/lib/api-connection-output";
import type { CsvColumn } from "@/lib/api-types";
import {
  serializePipelineRows,
  serializePipelineRowsCsv,
} from "@/lib/pipeline-products/artifacts";
import {
  deletePipelineArtifacts,
  uploadPipelineArtifact,
} from "@/lib/pipeline-products/storage";
import { checksumSourceFormingValue } from "@/lib/source-forming/canonical";

import { Tier2ProductError } from "./errors";
import type { Tier2ProductCandidate, Tier2ReleaseFinding } from "./types";

export const TIER2_PRODUCT_ARTIFACT_KINDS = [
  "rows-json",
  "rows-csv",
  "findings-json",
  "lineage-json",
] as const;

export type Tier2ProductArtifact = Readonly<{
  kind: typeof TIER2_PRODUCT_ARTIFACT_KINDS[number];
  storagePath: string;
  checksum: string;
  sizeBytes: number;
  schemaVersion: 1;
}>;

export type Tier2ProductArtifactManifest = Readonly<{
  schemaVersion: 1;
  artifacts: readonly Tier2ProductArtifact[];
}>;

export type Tier2ProductArtifactRecord = Readonly<{
  artifactKind: string;
  storagePath: string;
  contentChecksum: string;
  sizeBytes: number;
  schemaVersion: number;
}>;

function artifactMismatch(message: string): never {
  throw new Tier2ProductError(message, 409, "artifact-checksum-mismatch");
}

export function parseTier2ProductArtifactManifest(
  value: unknown,
): Tier2ProductArtifactManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return artifactMismatch("The Tier 2 product artifact manifest is unavailable.");
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.artifacts)) {
    return artifactMismatch("The Tier 2 product artifact manifest has an unsupported shape.");
  }
  const artifacts: Tier2ProductArtifact[] = candidate.artifacts.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return artifactMismatch("The Tier 2 product artifact manifest contains an invalid entry.");
    }
    const artifact = entry as Record<string, unknown>;
    if (
      !TIER2_PRODUCT_ARTIFACT_KINDS.includes(
        artifact.kind as typeof TIER2_PRODUCT_ARTIFACT_KINDS[number],
      ) ||
      typeof artifact.storagePath !== "string" || artifact.storagePath.length === 0 ||
      typeof artifact.checksum !== "string" || !/^[0-9a-f]{64}$/u.test(artifact.checksum) ||
      !Number.isInteger(artifact.sizeBytes) || Number(artifact.sizeBytes) < 0 ||
      artifact.schemaVersion !== 1
    ) {
      return artifactMismatch("The Tier 2 product artifact manifest contains an invalid entry.");
    }
    return {
      kind: artifact.kind as Tier2ProductArtifact["kind"],
      storagePath: artifact.storagePath,
      checksum: artifact.checksum,
      sizeBytes: Number(artifact.sizeBytes),
      schemaVersion: 1,
    };
  });
  const kinds = artifacts.map((artifact) => artifact.kind);
  if (
    artifacts.length !== TIER2_PRODUCT_ARTIFACT_KINDS.length ||
    new Set(kinds).size !== TIER2_PRODUCT_ARTIFACT_KINDS.length ||
    TIER2_PRODUCT_ARTIFACT_KINDS.some((kind) => !kinds.includes(kind))
  ) {
    return artifactMismatch(
      "The Tier 2 product artifact manifest must contain each required artifact exactly once.",
    );
  }
  return { schemaVersion: 1, artifacts };
}

function parseColumns(value: unknown): CsvColumn[] {
  if (!Array.isArray(value) || value.some((column) =>
    !column || typeof column !== "object" || Array.isArray(column) ||
    typeof (column as Record<string, unknown>).key !== "string" ||
    typeof (column as Record<string, unknown>).label !== "string" ||
    !Number.isInteger((column as Record<string, unknown>).sourceIndex)
  )) {
    return artifactMismatch("The Tier 2 product candidate has no immutable column evidence.");
  }
  return value.map((column) => ({
    key: (column as Record<string, unknown>).key as string,
    label: (column as Record<string, unknown>).label as string,
    sourceIndex: Number((column as Record<string, unknown>).sourceIndex),
  }));
}

export function assertTier2ProductArtifactEnvelope(input: {
  manifest: unknown;
  immutableColumns: unknown;
  expectedColumnsChecksum: string;
  expectedManifestChecksum: string;
}) {
  const manifest = parseTier2ProductArtifactManifest(input.manifest);
  const columns = parseColumns(input.immutableColumns);
  if (
    checksumSourceFormingValue(columns) !== input.expectedColumnsChecksum ||
    checksumSourceFormingValue(manifest) !== input.expectedManifestChecksum
  ) {
    return artifactMismatch(
      "The Tier 2 product artifact columns or manifest no longer match their immutable checksum.",
    );
  }
  return { manifest, columns };
}

export function assertTier2ProductArtifactEvidence(input: {
  manifest: unknown;
  artifactRecords: readonly Tier2ProductArtifactRecord[];
  artifactBodies: Readonly<Partial<Record<Tier2ProductArtifact["kind"], string>>>;
  immutableColumns: unknown;
  storedRows: readonly Readonly<Record<string, string>>[];
  expectedRowCount: number;
  expectedOutputChecksum: string;
  expectedColumnsChecksum: string;
  expectedManifestChecksum: string;
}) {
  const { manifest, columns } = assertTier2ProductArtifactEnvelope(input);

  const records = new Map(
    input.artifactRecords.map((record) => [record.artifactKind, record]),
  );
  if (
    input.artifactRecords.length !== TIER2_PRODUCT_ARTIFACT_KINDS.length ||
    records.size !== TIER2_PRODUCT_ARTIFACT_KINDS.length
  ) {
    return artifactMismatch("The Tier 2 product artifact audit records are incomplete.");
  }
  for (const artifact of manifest.artifacts) {
    const record = records.get(artifact.kind);
    const body = input.artifactBodies[artifact.kind];
    if (
      !record || typeof body !== "string" ||
      record.storagePath !== artifact.storagePath ||
      record.contentChecksum !== artifact.checksum ||
      record.sizeBytes !== artifact.sizeBytes ||
      record.schemaVersion !== artifact.schemaVersion ||
      checksumSourceFormingValue(body) !== artifact.checksum ||
      Buffer.byteLength(body, "utf8") !== artifact.sizeBytes
    ) {
      return artifactMismatch(
        `The Tier 2 product ${artifact.kind} artifact no longer matches its immutable audit record.`,
      );
    }
  }

  const rowsBody = input.artifactBodies["rows-json"]!;
  const csvBody = input.artifactBodies["rows-csv"]!;
  let parsed: ReturnType<typeof parseApiConnectionRowsArtifact>;
  try {
    parsed = parseApiConnectionRowsArtifact(rowsBody);
  } catch {
    return artifactMismatch("The Tier 2 product row artifact cannot be parsed.");
  }
  if (
    input.storedRows.length !== input.expectedRowCount ||
    checksumSourceFormingValue(parsed.columns) !== input.expectedColumnsChecksum ||
    serializePipelineRows(input.storedRows, columns) !== rowsBody ||
    serializePipelineRowsCsv(input.storedRows, columns) !== csvBody ||
    checksumSourceFormingValue({ columns, rows: input.storedRows }) !==
      input.expectedOutputChecksum
  ) {
    return artifactMismatch(
      "The Tier 2 product artifact columns or rows no longer match the reviewed output.",
    );
  }
  return parsed;
}

export async function persistTier2ProductArtifacts(input: {
  definitionKey: string;
  definitionVersion: string;
  definitionChecksum: string;
  runId: string;
  candidate: Tier2ProductCandidate;
  members: readonly Readonly<{
    inputKey: string;
    publicationId: string;
    outputChecksum: string;
  }>[];
  findings: readonly Tier2ReleaseFinding[];
}) {
  const columns = input.candidate.columns.map((column) => ({ ...column }));
  const bodies = [
    ["rows-json", serializePipelineRows(input.candidate.rows, columns)],
    ["rows-csv", serializePipelineRowsCsv(input.candidate.rows, columns)],
    ["findings-json", JSON.stringify({ schemaVersion: 1, findings: input.findings })],
    ["lineage-json", JSON.stringify({
      schemaVersion: 1,
      definitionKey: input.definitionKey,
      definitionVersion: input.definitionVersion,
      definitionChecksum: input.definitionChecksum,
      members: input.members,
    })],
  ] as const;
  const artifacts: Tier2ProductArtifact[] = [];

  try {
    for (const [kind, body] of bodies) {
      const storagePath = await uploadPipelineArtifact({
        definitionKey: input.definitionKey,
        runId: input.runId,
        kind,
        body,
      });
      artifacts.push({
        kind,
        storagePath,
        checksum: checksumSourceFormingValue(body),
        sizeBytes: Buffer.byteLength(body, "utf8"),
        schemaVersion: 1,
      });
    }
  } catch (error) {
    await deletePipelineArtifacts(artifacts.map((artifact) => artifact.storagePath))
      .catch(() => undefined);
    throw error;
  }

  return {
    columns,
    manifest: { schemaVersion: 1, artifacts } satisfies Tier2ProductArtifactManifest,
  };
}
