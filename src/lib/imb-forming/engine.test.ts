import { describe, expect, it } from "vitest";

import { normalizeHeaders } from "@/lib/csv";

import { formImbRows, type ImbCountryReference, type ImbRopReference } from "./engine";

const countries: ImbCountryReference[] = [
  { iso3: "USA", displayName: "United States", alternativeNames: ["United States of America", "US"] },
  { iso3: "CAN", displayName: "Canada", alternativeNames: [] },
];

const ropEntries: ImbRopReference[] = [
  {
    rop1Code: "A001",
    rop2Code: "C0001",
    rop25Code: "300001",
    rop3Code: "100001",
    status: "Active",
    joinIssue: null,
    joinIssueLabel: null,
  },
];

function source(overrides: Record<string, string> = {}) {
  return {
    OBJECTID: "7",
    PEID: "42",
    Name: "People",
    ISOalpha3: "USA",
    Ctry: "United States of America",
    Regn: "Americas",
    RegnSub: "Northern America",
    ROG: "USA",
    Aff: "Affinity",
    Pop: "1,234",
    PopCls: "1,000-9,999",
    EngStat: "Engaged",
    GSEC: "3",
    SPI: "2",
    SPIdesc: "Engaged",
    ROL: "eng",
    Lang: "English",
    Rlgn: "Christianity",
    ROP3: "100001",
    PplNm: "Alt",
    ROP25: "399999",
    ROP2: "C9999",
    PplClstr: "Cluster",
    ROP1: "A999",
    Affbloc: "Bloc",
    Jesus: "Available",
    Radio: "Not Available",
    Gospel: "Yes",
    Audio: "No",
    Bible: "Available",
    Indigenous: "Indigenous",
    Latitude: "12.5",
    Longitude: "-45.25",
    ...overrides,
  };
}

function run(rows: Record<string, string>[]) {
  const labels = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const columns = normalizeHeaders(labels);
  const keyedRows = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column.key, row[column.label] ?? ""])),
  );
  return formImbRows({
    connectionId: "connection-1",
    sourceRunId: "source-run-1",
    columns,
    rows: keyedRows,
    countries,
    ropEntries,
  });
}

function value(result: ReturnType<typeof run>, label: string, row = 0) {
  const key = result.columns.find((column) => column.label === label)!.key;
  return result.rows[row][key];
}

describe("formImbRows", () => {
  it("forms canonical fields, lineage, country, ROP parents, types, and scripture", () => {
    const result = run([source()]);

    expect(result.valid).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(value(result, "Geo_Country_Name")).toBe("United States");
    expect(value(result, "PG_ROP1")).toBe("A001");
    expect(value(result, "PG_ROP2")).toBe("C0001");
    expect(value(result, "PG_ROP25")).toBe("300001");
    expect(value(result, "PG_Population")).toBe("1234");
    expect(value(result, "Resources_Written_Scripture")).toBe("TRUE");
    expect(value(result, "Dataset_ID")).toBe("source-run-1");
    expect(value(result, "Dataset_Row_ID")).toBe("7");
    expect(value(result, "Dataset_Row_Key")).toBe("im:connection-1:7");
    expect(result.validation.ropParentConflictRows).toBe(1);
  });

  it("uses aliases only to fill blank ISO3 and keeps valid ISO3 on conflict", () => {
    const result = run([
      source({ OBJECTID: "1", ISOalpha3: "", Ctry: "US" }),
      source({ OBJECTID: "2", ISOalpha3: "USA", Ctry: "Canada" }),
    ]);

    expect(value(result, "Geo_ISO3", 0)).toBe("USA");
    expect(value(result, "Geo_Country_Name", 0)).toBe("United States");
    expect(value(result, "Geo_ISO3", 1)).toBe("USA");
    expect(result.validation.countryConflictRows).toBe(1);
  });

  it("preserves unresolved rows while withholding canonical ROP parents", () => {
    const result = run([source({ ROP3: "999999" })]);

    expect(result.valid).toBe(true);
    expect(value(result, "PG_ROP3")).toBe("999999");
    expect(value(result, "PG_ROP1")).toBe("");
    expect(value(result, "PG_ROP2")).toBe("");
    expect(value(result, "PG_ROP25")).toBe("");
    expect(result.validation.unresolvedRopRows).toBe(1);
  });

  it("preserves unresolved country values and blank ROP3 rows", () => {
    const result = run([
      source({ ISOalpha3: "ZZZ", Ctry: "Unknown Place", ROP3: "" }),
    ]);

    expect(result.valid).toBe(true);
    expect(value(result, "Geo_ISO3")).toBe("ZZZ");
    expect(value(result, "Geo_Country_Name")).toBe("Unknown Place");
    expect(value(result, "PG_ROP3")).toBe("");
    expect(result.validation.unresolvedCountryRows).toBe(1);
    expect(result.validation.unresolvedRopRows).toBe(1);
  });

  it("records invalid optional values and schema drift without dropping rows", () => {
    const result = run([source({ Pop: "many", NewField: "raw only" })]);

    expect(result.valid).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(value(result, "PG_Population")).toBe("");
    expect(result.validation.invalidValueCount).toBe(1);
    expect(result.validation.schemaDriftFields).toEqual(["NewField"]);
  });

  it("blocks missing and duplicate object identifiers", () => {
    const result = run([
      source({ OBJECTID: "" }),
      source({ OBJECTID: "8" }),
      source({ OBJECTID: "8" }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.validation.errorCount).toBe(2);
    expect(result.rows).toHaveLength(3);
  });

  it("blocks a source artifact that omits required contract columns", () => {
    const row: Record<string, string> = source();
    delete row.ROP3;
    const result = run([row]);

    expect(result.valid).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        severity: "error",
        ruleCode: "missing-required-source-field",
        fieldName: "ROP3",
      }),
    );
  });

  it("is deterministic for identical pinned input", () => {
    const first = run([source()]);
    const second = run([source()]);
    expect(first.outputChecksum).toBe(second.outputChecksum);
    expect(first.findings).toEqual(second.findings);
  });
});
