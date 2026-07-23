import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  serializePipelineRows,
  serializePipelineRowsCsv,
} from "@/lib/pipeline-products/artifacts";
import { checksumSourceFormingValue } from "@/lib/source-forming/canonical";

import {
  assertTier2ProductArtifactEvidence,
  TIER2_PRODUCT_ARTIFACT_KINDS,
  type Tier2ProductArtifactManifest,
} from "./artifacts";

const columns = [{ key: "AX_PGIC", label: "AX_PGIC", sourceIndex: 0 }];
const rows = [{ AX_PGIC: "10-jp-100001-LAO" }];

function evidence(input?: {
  rowsColumns?: typeof columns;
  mutateManifest?: (manifest: Tier2ProductArtifactManifest) => unknown;
  mutateBodies?: (bodies: Record<string, string>) => Record<string, string>;
}) {
  const artifactColumns = input?.rowsColumns ?? columns;
  const bodies: Record<string, string> = {
    "rows-json": serializePipelineRows(rows, artifactColumns),
    "rows-csv": serializePipelineRowsCsv(rows, artifactColumns),
    "findings-json": JSON.stringify({ schemaVersion: 1, findings: [] }),
    "lineage-json": JSON.stringify({ schemaVersion: 1, members: [] }),
  };
  const effectiveBodies = input?.mutateBodies?.(bodies) ?? bodies;
  const manifest: Tier2ProductArtifactManifest = {
    schemaVersion: 1,
    artifacts: TIER2_PRODUCT_ARTIFACT_KINDS.map((kind) => ({
      kind,
      storagePath: `tier2/${kind}`,
      checksum: checksumSourceFormingValue(effectiveBodies[kind]),
      sizeBytes: Buffer.byteLength(effectiveBodies[kind], "utf8"),
      schemaVersion: 1,
    })),
  };
  const effectiveManifest = input?.mutateManifest?.(manifest) ?? manifest;
  return {
    manifest: effectiveManifest,
    artifactRecords: manifest.artifacts.map((artifact) => ({
      artifactKind: artifact.kind,
      storagePath: artifact.storagePath,
      contentChecksum: artifact.checksum,
      sizeBytes: artifact.sizeBytes,
      schemaVersion: artifact.schemaVersion,
    })),
    artifactBodies: effectiveBodies,
    immutableColumns: columns,
    storedRows: rows,
    expectedRowCount: 1,
    expectedOutputChecksum: checksumSourceFormingValue({ columns, rows }),
    expectedColumnsChecksum: checksumSourceFormingValue(columns),
    expectedManifestChecksum: checksumSourceFormingValue(manifest),
  };
}

describe("Tier 2 product artifact evidence", () => {
  it("accepts the complete immutable columns, rows, manifest, and artifact checksums", () => {
    expect(() => assertTier2ProductArtifactEvidence(evidence())).not.toThrow();
  });

  it("rejects column tampering even when the altered body and per-artifact checksums agree", () => {
    const tampered = evidence({
      rowsColumns: [{ key: "AX_PGIC", label: "Tampered label", sourceIndex: 0 }],
    });
    tampered.expectedManifestChecksum = checksumSourceFormingValue(tampered.manifest);

    expect(() => assertTier2ProductArtifactEvidence(tampered)).toThrow(
      "artifact columns or rows",
    );
  });

  it("rejects a manifest whose immutable top-level checksum changed", () => {
    const original = evidence();
    const tamperedManifest = {
      ...original.manifest as Tier2ProductArtifactManifest,
      artifacts: [
        {
          ...(original.manifest as Tier2ProductArtifactManifest).artifacts[0]!,
          checksum: "0".repeat(64),
        },
        ...(original.manifest as Tier2ProductArtifactManifest).artifacts.slice(1),
      ],
    };

    expect(() => assertTier2ProductArtifactEvidence({
      ...original,
      manifest: tamperedManifest,
    })).toThrow("columns or manifest");
  });

  it("rejects rows that no longer match the reviewed artifact and output checksum", () => {
    const original = evidence();

    expect(() => assertTier2ProductArtifactEvidence({
      ...original,
      storedRows: [{ AX_PGIC: "tampered" }],
    })).toThrow("columns or rows");
  });

  it("rejects tampering in every checksummed non-row artifact", () => {
    const tampered = evidence({
      mutateBodies: (bodies) => ({
        ...bodies,
        "findings-json": `${bodies["findings-json"]} `,
      }),
    });
    const original = evidence();

    expect(() => assertTier2ProductArtifactEvidence({
      ...tampered,
      manifest: original.manifest,
      artifactRecords: original.artifactRecords,
      expectedManifestChecksum: original.expectedManifestChecksum,
    })).toThrow("findings-json artifact");
  });
});
