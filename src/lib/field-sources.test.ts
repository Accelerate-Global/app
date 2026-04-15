import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getFieldSourceTypeKey,
  parseFieldSourceMappingCsv,
} from "@/lib/field-sources";

const fieldSourceMappingCsv = readFileSync(
  path.join(
    process.cwd(),
    "src/data/field-sources/aggregate-1-field-mapping.csv",
  ),
  "utf8",
);

describe("field-sources", () => {
  it("normalizes source labels into stable source keys", () => {
    expect(getFieldSourceTypeKey("Joshua Project")).toBe("joshua_project");
    expect(getFieldSourceTypeKey("IMB (People Groups)")).toBe(
      "imb_people_groups",
    );
  });

  it("parses CSV rows into canonical field source seed rows", () => {
    const rows = parseFieldSourceMappingCsv(fieldSourceMappingCsv);
    const rop3Row = rows.find((row) => row.canonicalKey === "pg_rop3");

    expect(rop3Row).toMatchObject({
      canonicalKey: "pg_rop3",
      label: "PG_ROP3",
      mappingFieldId: "F_71",
      mappingDataType: "Integer",
      mappingIsActive: true,
      sourcePriorityKeys: [
        "joshua_project",
        "imb_people_groups",
        "accelerate",
        "etnopedia",
      ],
      sourceValues: [
        {
          sourceKey: "joshua_project",
          sourceFieldName: "ROP3",
        },
        {
          sourceKey: "imb_people_groups",
          sourceFieldName: "ROP3",
        },
        {
          sourceKey: "etnopedia",
          sourceFieldName: "rop3",
        },
        {
          sourceKey: "accelerate",
          sourceFieldName: "ROP3 (Integer)",
        },
      ],
    });
  });

  it("skips blank source cells instead of treating them as tracked sources", () => {
    const rows = parseFieldSourceMappingCsv(fieldSourceMappingCsv);
    const frontierRow = rows.find(
      (row) => row.canonicalKey === "christianity_frontier_group",
    );

    expect(frontierRow?.sourceValues).toEqual([
      {
        sourceKey: "joshua_project",
        sourceFieldName: "Frontier",
      },
    ]);
  });
});
