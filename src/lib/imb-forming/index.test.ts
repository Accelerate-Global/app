import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  serializeApiConnectionRowsArtifact,
  serializeApiConnectionRowsToCsv,
} from "@/lib/api-connection-output";
import { checksumSourceFormingValue } from "@/lib/source-forming";

const storageMocks = vi.hoisted(() => ({
  readArtifact: vi.fn(),
}));

vi.mock("@/lib/dataset-forming/storage", () => ({
  deleteDatasetFormingArtifacts: vi.fn(),
  readDatasetFormingArtifact: storageMocks.readArtifact,
  uploadDatasetFormingArtifact: vi.fn(),
}));

import {
  getDatasetFormingEngineLabel,
  verifyDatasetFormingCandidateArtifacts,
} from "./index";
import type {
  ImbFormingArtifactManifest,
  ImbFormingLineageManifest,
} from "./types";

function createFixture() {
  const columns = [{ key: "people", label: "People", sourceIndex: 0 }];
  const rows = [{ people: "Example" }];
  const findings = [
    {
      severity: "warning" as const,
      ruleCode: "review-example",
      sourceRowIndex: 0,
      stableRowKey: "example",
      fieldName: "people",
      sourceValue: "Example",
      canonicalValue: "Example",
      message: "Review this row.",
      details: {},
    },
  ];
  const validation = {
    warningCount: 1,
    errorCount: 0,
    unresolvedCountryRows: 0,
    unresolvedRopRows: 0,
    countryConflictRows: 0,
    ropParentConflictRows: 0,
    invalidValueCount: 0,
    schemaDriftFields: [],
  };
  const outputChecksum = checksumSourceFormingValue({ columns, rows });
  const result = {
    columns,
    rows,
    findings,
    validation,
    outputChecksum,
    valid: true,
  };
  const lineage: ImbFormingLineageManifest = {
    schemaVersion: 1,
    connectionId: "connection-1",
    sourceRunId: "source-run-1",
    sourceRowsChecksum: "a".repeat(64),
    sourceRawChecksum: "b".repeat(64),
    resourceBinding: {
      resourceSetId: "resource-set-1",
      resourceSetChecksum: "c".repeat(64),
      countryVersionId: "country-version-1",
      ropVersionId: "rop-version-1",
    },
    fieldContractVersion: 1,
    fieldContractChecksum: "d".repeat(64),
    transformationVersion: "v1",
    transformationChecksum: "e".repeat(64),
    inputRowCount: 1,
    outputRowCount: 1,
    outputChecksum,
    columns,
    validation,
  };
  const manifest: Required<ImbFormingArtifactManifest> = {
    rows: "candidate/rows.json",
    csv: "candidate/rows.csv",
    findings: "candidate/findings.json",
    manifest: "candidate/manifest.json",
  };
  const artifacts: Record<string, string> = {
    [manifest.rows]: serializeApiConnectionRowsArtifact({ columns, rows }),
    [manifest.csv]: serializeApiConnectionRowsToCsv({ columns, rows }),
    [manifest.findings]: JSON.stringify(findings, null, 2),
    [manifest.manifest]: JSON.stringify(lineage, null, 2),
  };

  return { artifacts, lineage, manifest, result };
}

function serveArtifacts(artifacts: Record<string, string>) {
  storageMocks.readArtifact.mockImplementation(async (path: string) => {
    const artifact = artifacts[path];
    if (artifact === undefined) throw new Error("missing artifact");
    return artifact;
  });
}

describe("dataset forming candidate finalization verification", () => {
  beforeEach(() => {
    storageMocks.readArtifact.mockReset();
  });

  it("reads back and independently verifies the complete artifact package", async () => {
    const fixture = createFixture();
    serveArtifacts(fixture.artifacts);

    await expect(
      verifyDatasetFormingCandidateArtifacts({
        engineKey: "accelerate",
        result: fixture.result,
        lineage: fixture.lineage,
        manifest: fixture.manifest,
      }),
    ).resolves.toEqual({
      outputSizeBytes: Buffer.byteLength(fixture.artifacts[fixture.manifest.rows]),
    });
    expect(storageMocks.readArtifact).toHaveBeenCalledTimes(4);
  });

  it("rejects stored rows whose independently calculated checksum differs", async () => {
    const fixture = createFixture();
    fixture.artifacts[fixture.manifest.rows] =
      serializeApiConnectionRowsArtifact({
        columns: fixture.result.columns,
        rows: [{ people: "Tampered" }],
      });
    serveArtifacts(fixture.artifacts);

    await expect(
      verifyDatasetFormingCandidateArtifacts({
        engineKey: "accelerate",
        result: fixture.result,
        lineage: fixture.lineage,
        manifest: fixture.manifest,
      }),
    ).rejects.toThrow(
      "uploaded candidate output checksum does not match the engine result",
    );
  });

  it("rejects findings whose counts disagree with validation", async () => {
    const fixture = createFixture();
    const result = {
      ...fixture.result,
      validation: {
        ...fixture.result.validation,
        warningCount: 0,
      },
    };
    serveArtifacts(fixture.artifacts);

    await expect(
      verifyDatasetFormingCandidateArtifacts({
        engineKey: "accelerate",
        result,
        lineage: fixture.lineage,
        manifest: fixture.manifest,
      }),
    ).rejects.toThrow(
      "candidate findings do not match the validation summary",
    );
  });

  it("rejects a valid flag that disagrees with error findings", async () => {
    const fixture = createFixture();
    const errorFinding = {
      ...fixture.result.findings[0],
      severity: "error" as const,
    };
    const result = {
      ...fixture.result,
      findings: [errorFinding],
      validation: {
        ...fixture.result.validation,
        warningCount: 0,
        errorCount: 1,
      },
      valid: true,
    };
    fixture.artifacts[fixture.manifest.findings] = JSON.stringify(
      result.findings,
      null,
      2,
    );
    serveArtifacts(fixture.artifacts);

    await expect(
      verifyDatasetFormingCandidateArtifacts({
        engineKey: "accelerate",
        result,
        lineage: fixture.lineage,
        manifest: fixture.manifest,
      }),
    ).rejects.toThrow(
      "candidate validity does not match its validation findings",
    );
  });

  it("rejects lineage that does not match the engine result", async () => {
    const fixture = createFixture();
    fixture.artifacts[fixture.manifest.manifest] = JSON.stringify({
      ...fixture.lineage,
      sourceRunId: "different-source-run",
    });
    serveArtifacts(fixture.artifacts);

    await expect(
      verifyDatasetFormingCandidateArtifacts({
        engineKey: "accelerate",
        result: fixture.result,
        lineage: fixture.lineage,
        manifest: fixture.manifest,
      }),
    ).rejects.toThrow(
      "uploaded candidate lineage artifact does not match the engine result",
    );
  });

  it("reports an inspectable failure when uploaded evidence cannot be read", async () => {
    const fixture = createFixture();
    storageMocks.readArtifact.mockImplementation(async (path: string) => {
      if (path === fixture.manifest.csv) throw new Error("storage unavailable");
      return fixture.artifacts[path];
    });

    await expect(
      verifyDatasetFormingCandidateArtifacts({
        engineKey: "accelerate",
        result: fixture.result,
        lineage: fixture.lineage,
        manifest: fixture.manifest,
      }),
    ).rejects.toThrow("Could not verify the uploaded candidate csv artifact");
  });
});

describe("dataset forming candidate hydration metadata", () => {
  it("uses registered friendly engine labels without exposing raw keys", () => {
    expect(getDatasetFormingEngineLabel("etnopedia")).toBe(
      "Etnopedia forming",
    );
    expect(getDatasetFormingEngineLabel("removed-engine-key")).toBe(
      "Unavailable forming engine",
    );
  });
});
