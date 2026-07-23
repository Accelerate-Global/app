import { describe, expect, it } from "vitest";

import {
  calculateWorkersNeeded,
  mergeTier1ByCanonicalPgic,
  mergeTier1SpecificPeopleGroups,
} from "./merge";
import type { Tier1ProductInputRow } from "./types";

const priorities = [
  { canonicalField: "PG_Name_Main", prioritySourceKeys: ["jp", "imb"] },
  { canonicalField: "PG_Population", prioritySourceKeys: ["imb", "jp"] },
] as const;

function input(
  sourceKey: string,
  stableRowKey: string,
  row: Record<string, string>,
): Tier1ProductInputRow {
  return { sourceKey, stableRowKey, row };
}

describe("Tier 1 merge products", () => {
  it("merges canonical PGIC values by pinned priorities with provenance", () => {
    const rows = [
      input("jp", "jp:1", {
        PG_AX_unique_PG_ID_PGIC: "10-JP-100001-LAO",
        PG_Name_Main: "JP River People",
        PG_Population: "900",
      }),
      input("imb", "imb:1", {
        PG_AX_unique_PG_ID_PGIC: "10-JP-100001-LAO",
        PG_Name_Main: "IMB River People",
        PG_Population: "1000",
      }),
    ];

    const result = mergeTier1ByCanonicalPgic({ rows, priorities });

    expect(result.errorCount).toBe(0);
    expect(result.rows).toEqual([
      expect.objectContaining({
        PG_AX_unique_PG_ID_PGIC: "10-JP-100001-LAO",
        PG_Name_Main: "JP River People",
        src__PG_Name_Main: "JP",
        PG_Population: "1000",
        src__PG_Population: "IMB",
        Contributing_Sources: "JP; IMB",
        Needs_Workers_Needed: "1",
      }),
    ]);
  });

  it("is invariant to input permutations", () => {
    const rows = [
      input("jp", "jp:1", { PGIC: "pgic-1", Name: "One" }),
      input("imb", "imb:1", { PGIC: "pgic-1", Name: "Two" }),
    ];
    const left = mergeTier1ByCanonicalPgic({ rows, priorities: [] });
    const right = mergeTier1ByCanonicalPgic({ rows: [...rows].reverse(), priorities: [] });
    expect(right.rows).toEqual(left.rows);
    expect(right.findings).toEqual(left.findings);
  });

  it("reports a missing priority once per fallback field rather than once per group", () => {
    const result = mergeTier1ByCanonicalPgic({
      rows: [
        input("jp", "jp:1", { PGIC: "pgic-1", Name: "One" }),
        input("jp", "jp:2", { PGIC: "pgic-2", Name: "Two" }),
      ],
      priorities: [],
    });
    expect(result.findings.filter((item) => item.ruleCode === "priority-fallback-used")).toHaveLength(1);
  });

  it("blocks duplicate source rows and equal-priority ambiguity", () => {
    const result = mergeTier1ByCanonicalPgic({
      rows: [
        input("jp", "jp:1", { PGIC: "pgic-1", Name: "One" }),
        input("jp", "jp:2", { PGIC: "pgic-1", Name: "Two" }),
      ],
      priorities: [{ canonicalField: "Name", prioritySourceKeys: ["jp"] }],
    });

    expect(result.rows).toEqual([]);
    expect(result.findings.map((item) => item.ruleCode)).toEqual(
      expect.arrayContaining(["duplicate-source-binding", "equal-priority-conflict"]),
    );
  });

  it("preserves every incomplete specific-PG row independently", () => {
    const result = mergeTier1SpecificPeopleGroups({
      rows: [
        input("jp", "jp:1", { PG_ROP3: "", Geo_ISO3: "LAO", Name: "One" }),
        input("imb", "imb:1", { PG_ROP3: "", Geo_ISO3: "LAO", Name: "Two" }),
      ],
      priorities: [],
    });

    expect(result.rows).toHaveLength(2);
    expect(result.findings.filter((item) => item.ruleCode === "incomplete-specific-pg-key")).toHaveLength(2);
  });

  it.each([
    ["", ""],
    ["many", ""],
    ["-1", ""],
    ["0", "0"],
    ["50000", "1"],
    ["50001", "2"],
  ])("calculates safe workers-needed for %s", (population, expected) => {
    expect(calculateWorkersNeeded(population).value).toBe(expected);
  });
});
