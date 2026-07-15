import { describe, expect, it } from "vitest";

import type { CsvColumn } from "@/lib/api-types";

import {
  buildPartnerExportPreview,
  createJoshuaProjectColumns,
  serializePartnerExportCsv,
  transformPartnerExportRows,
  validateProfileColumns,
} from "./engine";
import { JOSHUA_PROJECT_HEADERS, type PartnerExportProfileRevision } from "./types";

const sourceColumns: CsvColumn[] = [
  { key: "index", label: "index", sourceIndex: 0 },
  ...JOSHUA_PROJECT_HEADERS.map((header, index) => ({
    key: header.toLowerCase(),
    label: header,
    sourceIndex: index + 1,
  })),
  { key: "row_number", label: "Row number", sourceIndex: 14 },
];

function createJoshuaProfile(): PartnerExportProfileRevision {
  return {
    id: "profile-1",
    datasetId: "dataset-1",
    name: "Joshua Project",
    partnerKey: "joshua-project",
    fileNameStem: "joshua-project",
    revision: 1,
    columns: createJoshuaProjectColumns(sourceColumns).map((column, ordinal) => ({
      ...column,
      id: `column-${ordinal + 1}`,
      ordinal,
    })),
  };
}

function createSourceRow(overrides: Record<string, string> = {}) {
  return {
    rowIndex: 7,
    data: {
      index: "999",
      pg_peopleid3: "00123",
      pg_rop3: "456.0",
      geo_rog3: "ROG",
      geo_iso3: "IND",
      pg_name_main: " Example people ",
      pg_name_alt: "Alternate",
      pg_ax_unique_pg_id_pgic: "AX-1",
      reporting_group: "Accelerate",
      implementing_group: "Partner",
      engage_timestamp_of_last_known: "2026-07-14T20:00:00-07:00",
      engage_status_of_engagement: "Active",
      approx_evangelical_believers: "75.0",
      approx_evangelical_churches: "2",
      row_number: "8",
      ...overrides,
    },
  };
}

describe("partner export engine", () => {
  it("builds the exact Joshua Project crosswalk from source labels", () => {
    const columns = createJoshuaProjectColumns(sourceColumns);

    expect(columns.map((column) => column.outputHeader)).toEqual([
      ...JOSHUA_PROJECT_HEADERS,
    ]);
    expect(columns.flatMap((column) => column.sourceColumnKeys)).not.toContain("index");
    expect(columns.flatMap((column) => column.sourceColumnKeys)).not.toContain(
      "row_number",
    );
  });

  it("uses source keys rather than positions and preserves identifier strings", () => {
    const profile = createJoshuaProfile();
    const result = transformPartnerExportRows({
      rows: [createSourceRow()],
      profile,
      sourceColumns: [...sourceColumns].reverse(),
    });

    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        PG_PeopleID3: "00123",
        PG_ROP3: "456.0",
        PG_Name_Main: "Example people",
        approx_evangelical_believers: "75",
      }),
    );
    expect(result.rows[0]).not.toHaveProperty("index");
    expect(result.rows[0]).not.toHaveProperty("Row number");
    expect(result.validation.errorCount).toBe(0);
  });

  it("reports blocking Joshua Project identifier and geography findings", () => {
    const result = transformPartnerExportRows({
      rows: [
        createSourceRow({
          pg_peopleid3: "",
          pg_rop3: "",
          geo_rog3: "",
          geo_iso3: "",
        }),
      ],
      profile: createJoshuaProfile(),
      sourceColumns,
    });

    expect(result.validation.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "required_identifier", rowIndex: 7 }),
        expect.objectContaining({ code: "required_geography", rowIndex: 7 }),
      ]),
    );
  });

  it("rejects stale source keys and duplicate target headers", () => {
    const columns = createJoshuaProjectColumns(sourceColumns);
    columns[0] = { ...columns[0], outputHeader: columns[1].outputHeader };
    columns[2] = { ...columns[2], sourceColumnKeys: ["missing"] };

    expect(
      validateProfileColumns({
        columns,
        sourceColumns,
        partnerKey: "custom",
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("duplicated"),
        expect.stringContaining("missing source column"),
      ]),
    );
  });

  it("uses the generation engine for bounded previews without creating helper columns", () => {
    const preview = buildPartnerExportPreview({
      rows: [createSourceRow(), { ...createSourceRow(), rowIndex: 8 }],
      profile: createJoshuaProfile(),
      sourceColumns,
      previewRowLimit: 1,
    });

    expect(preview.headers).toEqual([...JOSHUA_PROJECT_HEADERS]);
    expect(preview.rows).toHaveLength(1);
    expect(preview.sourceRowCount).toBe(2);
    expect(preview.crosswalk).toHaveLength(13);
  });

  it("neutralizes formula-leading values in generated CSV", () => {
    const csv = serializePartnerExportCsv({
      headers: ["PG_Name_Main"],
      rows: [{ PG_Name_Main: "=IMPORTXML(\"https://example.com\")" }],
    });

    expect(csv).toContain("\"'=IMPORTXML(\"\"https://example.com\"\")\"");
  });

  it("rejects ambiguous numbers and dates rather than guessing", () => {
    const result = transformPartnerExportRows({
      rows: [
        createSourceRow({
          engage_timestamp_of_last_known: "07/14/2026",
          approx_evangelical_believers: "1e3",
        }),
      ],
      profile: createJoshuaProfile(),
      sourceColumns,
    });

    expect(result.validation.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_iso_timestamp" }),
        expect.objectContaining({ code: "invalid_non_negative_whole_number" }),
      ]),
    );
  });

  it("keeps aggregate severity counts when detailed findings are truncated", () => {
    const blankRows = Array.from({ length: 100 }, () =>
      createSourceRow({
        pg_peopleid3: "",
        pg_rop3: "",
        geo_rog3: "",
        geo_iso3: "",
        pg_name_main: "",
        pg_ax_unique_pg_id_pgic: "",
      }),
    ).map((row, index) => ({ ...row, rowIndex: index + 1 }));
    const result = transformPartnerExportRows({
      rows: blankRows,
      profile: createJoshuaProfile(),
      sourceColumns,
    });

    expect(result.validation.errorCount).toBe(400);
    expect(result.validation.findings).toHaveLength(250);
    expect(result.validation.truncated).toBe(true);
  });
});
