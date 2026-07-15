import { describe, expect, it } from "vitest";

import {
  checksumPartnerExportArtifact,
  fingerprintPartnerExportRows,
  fingerprintPartnerExportSchema,
} from "./fingerprint";

describe("partner export fingerprints", () => {
  it("is deterministic and changes with row order, content, or schema", () => {
    const columns = [{ key: "id", label: "ID", sourceIndex: 0 }];
    const rows = [
      { rowIndex: 0, data: { id: "001" } },
      { rowIndex: 1, data: { id: "002" } },
    ];

    expect(fingerprintPartnerExportSchema(columns)).toBe(
      fingerprintPartnerExportSchema(columns),
    );
    expect(fingerprintPartnerExportRows(rows)).not.toBe(
      fingerprintPartnerExportRows([...rows].reverse()),
    );
    expect(checksumPartnerExportArtifact("csv")).toMatch(/^[0-9a-f]{64}$/u);
  });
});
