import { describe, expect, it } from "vitest";

import {
  MAP_PREPRODUCTION_DEFAULT_FILTERED_ROW_COUNT,
  MAP_PREPRODUCTION_FOCUSED_PEOPLE_NAME,
  MAP_PREPRODUCTION_ROW_COUNT,
  buildMapPreproductionRows,
} from "./dataset-map-preproduction-fixture";

describe("buildMapPreproductionRows", () => {
  it("builds a deterministic production-shaped fixture from the country catalog", () => {
    const first = buildMapPreproductionRows();
    const second = buildMapPreproductionRows();

    expect(first).toEqual(second);
    expect(first).toHaveLength(MAP_PREPRODUCTION_ROW_COUNT);
    expect(MAP_PREPRODUCTION_DEFAULT_FILTERED_ROW_COUNT).toBe(1_490);
    expect(new Set(first.map((row) => row.pg_peopleid1)).size).toBe(
      MAP_PREPRODUCTION_ROW_COUNT,
    );
    expect(new Set(first.map((row) => row.pg_peid)).size).toBe(
      MAP_PREPRODUCTION_ROW_COUNT,
    );
    expect(first.some((row) => row.people_name === MAP_PREPRODUCTION_FOCUSED_PEOPLE_NAME)).toBe(
      true,
    );
  });

  it("covers reviewed aliases, filter variation, and intentionally unmapped rows", () => {
    const rows = buildMapPreproductionRows();
    const countryNames = new Set(rows.map((row) => row.geo_country_name));

    expect(countryNames.size).toBeGreaterThan(200);
    for (const countryName of [
      "Bahamas",
      "Brunei Darussalam",
      "Congo",
      "Eswatini",
      "Lao",
      "Serbia",
      "Tanzania, the United Republic of",
      "Timor-Leste",
      "United Kingdom of Great Britain and Northern Ireland",
    ]) {
      expect(countryNames.has(countryName)).toBe(true);
    }

    expect(rows.some((row) => !row.geo_country_name && !row.geo_iso3)).toBe(true);
    expect(rows.some((row) => row.geo_iso3 === "XXX")).toBe(true);
    expect(new Set(rows.map((row) => row.christianity_gsec))).toEqual(
      new Set(["1", "2", "3", "4", "5"]),
    );
    expect(new Set(rows.map((row) => row.engage_global_engagement_anywhere))).toEqual(
      new Set(["true", "false"]),
    );
    expect(
      rows
        .filter((row) => row.geo_country_name === "Canada")
        .every((row) => row.christianity_gsec === "5"),
    ).toBe(true);
  });

  it("rejects invalid requested sizes", () => {
    expect(() => buildMapPreproductionRows(0)).toThrow(
      "Map pre-production row count must be a positive integer.",
    );
  });
});
