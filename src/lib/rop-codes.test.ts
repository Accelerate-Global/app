import { describe, expect, it } from "vitest";

import {
  buildRopCodeResource,
  HIS_ROP_MINIMUM_COUNTS,
  type RopSourceTables,
} from "@/lib/rop-codes";

const minimumCounts = {
  rop1: 0,
  rop2: 0,
  rop25: 0,
  rop3: 0,
  geoIndex: 0,
};

function buildSourceTables(): RopSourceTables {
  return {
    rop1: [
      {
        code: "A001",
        status: 1,
        name: "Affinity One",
        description: "Affinity description",
      },
    ],
    rop2: [
      {
        code: "C0001",
        status: 1,
        name: "Cluster One",
        description: "Cluster description",
        rop1: "A001",
      },
      {
        code: "C0002",
        status: 1,
        name: "Cluster Two",
        description: "Second cluster",
        rop1: "A001",
      },
    ],
    rop25: [
      {
        code: "300001",
        status: 1,
        name: "Kinship One",
        description: "Kinship description",
        rop2: "C0001",
      },
      {
        code: "300002",
        status: 1,
        name: "Kinship Two",
        description: "Second kinship",
        rop2: "C0002",
      },
      {
        code: "300003",
        status: 1,
        name: "Parent Only",
        description: "No child",
        rop2: "C0001",
      },
    ],
    rop3: [
      {
        code: "100001",
        status: 1,
        name: "People One",
        description: "People description",
        source: "HIS",
        rop25: "300001",
        rop2: "C0001",
        ethnicId: "E1",
        place: "India",
        language: "Hindi",
      },
      {
        code: "100002",
        status: 1,
        name: "Missing Kinship",
        description: null,
        source: null,
        rop25: "399999",
        rop2: "C0001",
        ethnicId: null,
        place: null,
        language: null,
      },
      {
        code: "100003",
        status: 1,
        name: "Conflicting Cluster",
        description: null,
        source: null,
        rop25: "300002",
        rop2: "C0001",
        ethnicId: null,
        place: null,
        language: null,
      },
    ],
    geoIndex: [
      {
        geoId: 1,
        rop3: "100001",
        rog: "IN",
        geoName: "India",
        peopleName: "People One",
        peopleId3: "1",
        isoAlpha3: "IND",
        status: "Active",
      },
    ],
  };
}

function buildBoundedMissingRop2Tables(): RopSourceTables {
  const tables = buildSourceTables();
  tables.rop25 = Array.from({ length: 1001 }, (_, index) => ({
    code: String(300000 + index),
    status: 1,
    name: `Kinship ${index}`,
    description: null,
    rop2: index === 1000 ? "C0999" : "C0001",
  }));
  tables.rop3 = [
    {
      code: "100004",
      status: 1,
      name: "Orphaned Parent People",
      description: null,
      source: "HIS",
      rop25: "301000",
      rop2: "C0999",
      ethnicId: null,
      place: "India",
      language: null,
    },
  ];
  tables.geoIndex = [
    {
      geoId: 4,
      rop3: "100004",
      rog: "IN",
      geoName: "India",
      peopleName: "Orphaned Parent People",
      peopleId3: "4",
      isoAlpha3: "IND",
      status: "Active",
    },
  ];
  return tables;
}

describe("ROP code resource", () => {
  it("accepts the current complete HIS ROP25 layer within the safety buffer", () => {
    expect(HIS_ROP_MINIMUM_COUNTS.rop25).toBeLessThanOrEqual(8991);
    expect(HIS_ROP_MINIMUM_COUNTS.rop25).toBeGreaterThan(8000);
  });

  it("builds a complete flattened resource with source join issues flagged", () => {
    const resource = buildRopCodeResource(
      buildSourceTables(),
      "2026-05-07T00:00:00.000Z",
      minimumCounts,
    );

    expect(resource.entryCount).toBe(4);
    expect(resource.joinIssueCounts).toEqual({
      "missing-rop25": 1,
      "missing-rop2": 0,
      "parent-only-rop25": 1,
      "rop2-conflict": 1,
    });
    expect(resource.entries.map((entry) => entry.id)).toContain("rop25-300003");
    expect(resource.entries.find((entry) => entry.id === "rop3-100001")).toMatchObject({
      rop1: { display: "A001 - Affinity One" },
      rop2: { display: "C0001 - Cluster One" },
      rop25: { display: "300001 - Kinship One" },
      rop3: { display: "100001 - People One" },
      joinIssue: null,
    });
    expect(resource.entries.find((entry) => entry.id === "rop3-100002")).toMatchObject({
      rop25: { display: "399999 - Not listed" },
      joinIssue: "missing-rop25",
    });
    expect(resource.entries.find((entry) => entry.id === "rop3-100003")).toMatchObject({
      rop2: { display: "C0002 - Cluster Two" },
      directRop2: "C0001",
      joinIssue: "rop2-conflict",
    });
    expect(resource.geoIndexByRop3["100001"]).toHaveLength(1);
    expect(resource.rop3DetailsByCode["100001"].description).toBe(
      "People description",
    );
  });

  it("rejects duplicate official codes", () => {
    const tables = buildSourceTables();
    tables.rop3.push({ ...tables.rop3[0] });

    expect(() =>
      buildRopCodeResource(tables, "2026-05-07T00:00:00.000Z", minimumCounts),
    ).toThrow("Duplicate ROP3: 100001.");
  });

  it("preserves a bounded missing ROP2 parent as an unresolved join issue", () => {
    const resource = buildRopCodeResource(
      buildBoundedMissingRop2Tables(),
      "2026-07-21T00:00:00.000Z",
      minimumCounts,
    );

    expect(resource.entryCount).toBe(1001);
    expect(resource.joinIssueCounts["missing-rop2"]).toBe(1);
    expect(resource.entries.find((entry) => entry.id === "rop3-100004")).toMatchObject({
      rop1: null,
      rop2: { code: "C0999", name: null, display: "C0999 - Not listed" },
      rop25: { code: "301000" },
      rop3: { code: "100004" },
      joinIssue: "missing-rop2",
      joinIssueLabel: "ROP2 code is not listed in the ROP2 table",
    });
    expect(resource.geoIndexByRop3["100004"]).toHaveLength(1);
  });

  it("rejects missing ROP2 parents above the count or ratio tolerance", () => {
    const excessiveCount = buildBoundedMissingRop2Tables();
    excessiveCount.rop25 = excessiveCount.rop25.map((row, index) =>
      index >= excessiveCount.rop25.length - 11 ? { ...row, rop2: "C0999" } : row,
    );
    expect(() =>
      buildRopCodeResource(
        excessiveCount,
        "2026-07-21T00:00:00.000Z",
        minimumCounts,
      ),
    ).toThrow(/11 missing ROP2 parent relationships/u);

    const excessiveRatio = buildBoundedMissingRop2Tables();
    excessiveRatio.rop25[999] = { ...excessiveRatio.rop25[999], rop2: "C0999" };
    expect(() =>
      buildRopCodeResource(
        excessiveRatio,
        "2026-07-21T00:00:00.000Z",
        minimumCounts,
      ),
    ).toThrow(/2 missing ROP2 parent relationships/u);
  });

  it("keeps a missing ROP1 parent fatal", () => {
    const tables = buildSourceTables();
    tables.rop2[0] = { ...tables.rop2[0], rop1: "A999" };

    expect(() =>
      buildRopCodeResource(tables, "2026-07-21T00:00:00.000Z", minimumCounts),
    ).toThrow("ROP2 C0001 references missing ROP1 A999.");
  });
});
