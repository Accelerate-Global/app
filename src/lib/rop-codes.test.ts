import { describe, expect, it } from "vitest";

import {
  buildRopCodeResource,
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

describe("ROP code resource", () => {
  it("builds a complete flattened resource with source join issues flagged", () => {
    const resource = buildRopCodeResource(
      buildSourceTables(),
      "2026-05-07T00:00:00.000Z",
      minimumCounts,
    );

    expect(resource.entryCount).toBe(4);
    expect(resource.joinIssueCounts).toEqual({
      "missing-rop25": 1,
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
});
