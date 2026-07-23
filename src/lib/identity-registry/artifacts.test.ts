import { describe, expect, it } from "vitest";

import { prepareAxIdentityArtifacts } from "./artifacts";

describe("AX identity artifacts", () => {
  it("is deterministic and protects CSV formula cells", () => {
    const input = {
      runId: "run-1",
      sourcePublicationId: "publication-1",
      sourceProfileKey: "jp",
      baseRevisionId: null,
      rulesVersion: "v1",
      rulesChecksum: "a".repeat(64),
      resourceBindings: { countryVersionId: "country-1", ropVersionId: "rop-1" },
      rows: [
        {
          sourceRowIndex: 0,
          stableRowKey: "jp:1",
          assignmentStatus: "reserved" as const,
          bindingId: "binding-1",
          pgacCode: "10-jp-100001",
          pgicCode: "10-jp-100001-LAO",
          enrichedRow: { Formula: "=1+1", AX_PGIC: "10-jp-100001-LAO" },
        },
      ],
      findings: [],
    };
    const first = prepareAxIdentityArtifacts(input);
    const second = prepareAxIdentityArtifacts(input);
    expect(first).toEqual(second);
    expect(first.outputChecksum).toMatch(/^[0-9a-f]{64}$/u);
    expect(first.csvChecksum).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.parse(first.manifestJson)).toMatchObject({
      schemaVersion: 2,
      csvChecksum: first.csvChecksum,
      outputChecksum: first.outputChecksum,
    });
    expect(first.csv).toContain("'=1+1");
  });
});
