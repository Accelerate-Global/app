import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getFieldSourceTypeKey,
  mergeSeededFieldDisplayLabel,
  parseFieldDescriptionCsv,
  parseFieldSourceMappingCsv,
} from "@/lib/field-sources";

const fieldSourceMappingCsv = readFileSync(
  path.join(
    process.cwd(),
    "src/data/field-sources/aggregate-1-field-mapping.csv",
  ),
  "utf8",
);
const fieldDescriptionCsv = readFileSync(
  path.join(
    process.cwd(),
    "src/data/field-sources/field-description-seed.csv",
  ),
  "utf8",
);

describe("field-sources", () => {
  it("preserves existing display labels when seed data is reapplied", () => {
    expect(
      mergeSeededFieldDisplayLabel({
        existingDisplayLabel: "People Groups",
        seededDisplayLabel: "People Group",
      }),
    ).toBe("People Groups");
    expect(
      mergeSeededFieldDisplayLabel({
        existingDisplayLabel: "   ",
        seededDisplayLabel: "People Group",
      }),
    ).toBe("People Group");
  });

  it("normalizes source labels into stable source keys", () => {
    expect(getFieldSourceTypeKey("Joshua Project")).toBe("joshua_project");
    expect(getFieldSourceTypeKey("IMB (People Groups)")).toBe(
      "imb_people_groups",
    );
  });

  it("parses CSV rows into canonical field source seed rows", () => {
    const rows = parseFieldSourceMappingCsv(
      fieldSourceMappingCsv,
      parseFieldDescriptionCsv(fieldDescriptionCsv),
    );
    const rop3Row = rows.find((row) => row.canonicalKey === "pg_rop3");

    expect(rop3Row).toMatchObject({
      canonicalKey: "pg_rop3",
      label: "PG_ROP3",
      displayLabel: "People Group: 6dig Code ROP3 (PGIC)",
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

  it("aliases Add-on Fields to the Accelerate source key", () => {
    const rows = parseFieldSourceMappingCsv(fieldSourceMappingCsv);
    const dataSourceRow = rows.find((row) => row.canonicalKey === "data_source");

    expect(dataSourceRow?.sourceValues).toEqual([
      {
        sourceKey: "accelerate",
        sourceFieldName: "Data Source",
      },
    ]);
    expect(
      rows.some((row) =>
        row.sourceValues.some((sourceValue) => sourceValue.sourceKey === "add_on_fields"),
      ),
    ).toBe(false);
  });

  it("leaves fields with no populated source columns untagged", () => {
    const rows = parseFieldSourceMappingCsv(fieldSourceMappingCsv);
    const govtFreedomRow = rows.find(
      (row) => row.canonicalKey === "govt_freedom_index",
    );

    expect(govtFreedomRow?.sourceValues).toEqual([]);
  });

  it("loads only non-blank field descriptions from the spec sheet seed", () => {
    const descriptionsByFieldId = parseFieldDescriptionCsv(fieldDescriptionCsv);

    expect(descriptionsByFieldId.get("F_7")).toBe(
      "All Christian Adherents including nominal, historical, and most Christian cults, as well as evangelical.",
    );
    expect(descriptionsByFieldId.has("F_83")).toBe(false);
  });

  it("attaches matching descriptions to field source seed rows", () => {
    const rows = parseFieldSourceMappingCsv(
      fieldSourceMappingCsv,
      parseFieldDescriptionCsv(fieldDescriptionCsv),
    );

    expect(
      rows.find((row) => row.canonicalKey === "christianity_percent_all_types")
        ?.definition,
    ).toBe(
      "All Christian Adherents including nominal, historical, and most Christian cults, as well as evangelical.",
    );
    expect(
      rows.find((row) => row.canonicalKey === "christianity_percent_all_types")
        ?.displayLabel,
    ).toBe("Christianity: % Christian (All Types)");
    expect(rows.find((row) => row.canonicalKey === "data_source")?.definition).toBe(
      "",
    );
  });
});
