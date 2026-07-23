import { describe, expect, it } from "vitest";

import { buildPgacAggregate1 } from "./aggregate1";

describe("PGAC Aggregate 1", () => {
  it("sums population, weights percentages, selects the primary country, and records all sources", () => {
    const result = buildPgacAggregate1({
      rows: [
        {
          PG_ROP3: "100001",
          Geo_Country_Name: "Laos",
          PG_Population: "700",
          Christianity_Percent_All_Types: "10",
          Christianity_Percent_Evangelical: "2",
          Contributing_Sources: "JP; IMB",
          Christianity_GSEC: "2",
          src__Christianity_GSEC: "IMB",
        },
        {
          PG_ROP3: "100001",
          Geo_Country_Name: "Côte d’Ivoire",
          PG_Population: "300",
          Christianity_Percent_All_Types: "20",
          Christianity_Percent_Evangelical: "5",
          Contributing_Sources: "AX; ETNO; WCD",
          Christianity_GSEC: "3",
          src__Christianity_GSEC: "WCD",
        },
      ],
      priorities: [{ canonicalField: "Christianity_GSEC", prioritySourceKeys: ["imb", "wcd"] }],
    });

    expect(result.rows).toEqual([
      expect.objectContaining({
        PG_ROP3: "100001",
        PG_Population: "1000",
        Christianity_Percent_All_Types: "13",
        Christianity_Percent_Evangelical: "2.9",
        Geo_Country_Name: "Laos",
        alt_countries: "Côte d’Ivoire",
        Joint: "true",
        JP_Source: "true",
        IMB_Source: "true",
        AX_Source: "true",
        ETNO_Source: "true",
        WCD_Source: "true",
      }),
    ]);
  });

  it("keeps blank percentages in the total denominator and truncates to two decimals", () => {
    const result = buildPgacAggregate1({
      rows: [
        {
          PG_ROP3: "100001",
          Geo_Country_Name: "India",
          PG_Population: "2",
          Christianity_Percent_All_Types: "1.999",
          Contributing_Sources: "JP",
        },
        {
          PG_ROP3: "100001",
          Geo_Country_Name: "Nepal",
          PG_Population: "1",
          Christianity_Percent_All_Types: "",
          Contributing_Sources: "IMB",
        },
      ],
      priorities: [],
    });

    expect(result.rows[0].Christianity_Percent_All_Types).toBe("1.33");
  });

  it("uses stable parent order for a primary-country population tie", () => {
    const result = buildPgacAggregate1({
      rows: [
        { PG_ROP3: "1", Geo_Country_Name: "Nepal", PG_Population: "10", Contributing_Sources: "JP" },
        { PG_ROP3: "1", Geo_Country_Name: "India", PG_Population: "10", Contributing_Sources: "IMB" },
      ],
      priorities: [],
    });

    expect(result.rows[0].Geo_Country_Name).toBe("Nepal");
    expect(result.rows[0].alt_countries).toBe("India");
  });

  it("reports one fallback warning per aggregate field across groups", () => {
    const result = buildPgacAggregate1({
      rows: [
        { PG_ROP3: "1", PG_Population: "1", Name: "One", Contributing_Sources: "JP" },
        { PG_ROP3: "2", PG_Population: "1", Name: "Two", Contributing_Sources: "JP" },
      ],
      priorities: [],
    });
    expect(result.findings.filter((item) => item.ruleCode === "priority-fallback-used")).toHaveLength(1);
  });

  it("excludes negative population from sums and reports it", () => {
    const result = buildPgacAggregate1({
      rows: [{ PG_ROP3: "1", Geo_Country_Name: "India", PG_Population: "-2", Contributing_Sources: "JP" }],
      priorities: [],
    });

    expect(result.rows[0].PG_Population).toBe("0");
    expect(result.findings.some((item) => item.ruleCode === "aggregate1-invalid-population")).toBe(true);
  });
});
