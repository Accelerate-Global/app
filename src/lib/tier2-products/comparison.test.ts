import fixture from "../../../tests/fixtures/tier2-products/comparison.json";
import { describe, expect, it } from "vitest";

import { normalizeHeaders } from "@/lib/csv";

import { compareTier2CandidateWithLegacy } from "./comparison";

const columns = normalizeHeaders([
  "PG_AX_unique_PG_ID_PGIC",
  "PG_Name_Main",
]);

function rows(input: typeof fixture.legacy) {
  return input.map((entry) =>
    Object.fromEntries(
      columns.map((column) => [
        column.key,
        column.label === "PG_AX_unique_PG_ID_PGIC"
          ? entry.canonicalPgic
          : entry.name,
      ]),
    ),
  );
}

describe("Tier 2 legacy comparison", () => {
  it("explains retained, dropped, added, and conflicting identities", () => {
    const report = compareTier2CandidateWithLegacy({
      legacy: { columns, rows: rows(fixture.legacy) },
      candidate: { columns, rows: rows(fixture.candidate) },
    });

    expect(report.counts).toEqual({
      retained: 1,
      dropped: 1,
      added: 1,
      conflicting: 1,
    });
    expect(report.differences.every((entry) => entry.explanation.length > 0)).toBe(
      true,
    );
    expect(report.schemaVersion).toBe(1);
    expect(report.legacyChecksum).toMatch(/^[0-9a-f]{64}$/u);
    expect(report.candidateChecksum).toMatch(/^[0-9a-f]{64}$/u);
    expect(
      report.differences.find((entry) => entry.canonicalPgic === "PGIC-3"),
    ).toMatchObject({
      outcome: "conflicting",
      legacyRows: [expect.any(Object)],
      candidateRows: [expect.any(Object)],
    });
  });
});
