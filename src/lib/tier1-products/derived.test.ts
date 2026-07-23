import { describe, expect, it } from "vitest";

import {
  buildBaselineUupg,
  buildHotspots,
  buildSelfEngaged,
  buildSouthAsia,
  buildWatchlist,
  SOUTH_ASIA_SCOPE_V1,
} from "./derived";

describe("Aggregate 1 named products", () => {
  it("honors Self-Engaged exact thresholds and AX phase availability", () => {
    const rows = [
      {
        id: "percent-boundary",
        PG_Population: "100000",
        Percent_Evangelical_PGAC: "1",
        Christianity_GSEC: "2",
        Christianity_Frontier_Group: "false",
        Engage_8_Phases_of_Engagement: "",
        AX_Source: "false",
      },
      {
        id: "below-boundary",
        PG_Population: "100000",
        Percent_Evangelical_PGAC: "0.999",
        Christianity_GSEC: "2",
        Christianity_Frontier_Group: "false",
        Engage_8_Phases_of_Engagement: "7",
        AX_Source: "false",
      },
    ];
    expect(buildSelfEngaged(rows).rows.map((row) => row.id)).toEqual(["percent-boundary"]);
  });

  it("honors Watchlist provenance gates and the one-percent boundary", () => {
    const base = {
      PG_Population: "100000",
      Christianity_GSEC: "2",
      src__Christianity_GSEC: "IMB",
      Christianity_Frontier_Group: "true",
      src__Christianity_Frontier_Group: "JP",
    };
    expect(buildWatchlist([{ ...base, id: "below", Percent_Evangelical_PGAC: "0.01" }]).rows).toHaveLength(1);
    expect(buildWatchlist([{ ...base, id: "boundary", Percent_Evangelical_PGAC: "1" }]).rows).toHaveLength(0);
    expect(buildWatchlist([{ ...base, id: "non-jp", Percent_Evangelical_PGAC: "0.01", src__Christianity_Frontier_Group: "AX", Christianity_Frontier_Group: "false" }]).rows).toHaveLength(1);
  });

  describe("Self-Engaged exact boundary contract", () => {
    const base = {
      PG_Population: "100000",
      Percent_Evangelical_PGAC: "1",
      Christianity_GSEC: "2",
      Christianity_Frontier_Group: "false",
      Engage_8_Phases_of_Engagement: "6",
      AX_Source: "true",
    };

    it.each([
      ["includes the GSEC maximum", { Christianity_GSEC: "2" }, true],
      ["excludes a GSEC value above the maximum", { Christianity_GSEC: "2.000001" }, false],
      ["includes exactly 50 evangelical believers", { PG_Population: "5000" }, true],
      ["excludes a population producing fewer than 50 evangelical believers", { PG_Population: "4999.999" }, false],
      [
        "includes the evangelical-proportion minimum",
        { PG_Population: "500000", Percent_Evangelical_PGAC: "0.05" },
        true,
      ],
      [
        "excludes a proportion below the minimum when the alternate believer gate is not met",
        { PG_Population: "500000", Percent_Evangelical_PGAC: "0.049999" },
        false,
      ],
      [
        "includes exactly 500 believers through the alternate believer gate",
        { PG_Population: "1250000", Percent_Evangelical_PGAC: "0.04" },
        true,
      ],
      [
        "excludes a value just below the alternate believer gate",
        { PG_Population: "1249999", Percent_Evangelical_PGAC: "0.04" },
        false,
      ],
      ["includes the engagement-phase minimum", { Percent_Evangelical_PGAC: "0.5", Engage_8_Phases_of_Engagement: "6" }, true],
      ["excludes a phase below the minimum", { Percent_Evangelical_PGAC: "0.5", Engage_8_Phases_of_Engagement: "5.999" }, false],
      [
        "includes the independent one-percent boundary without an AX phase",
        { Engage_8_Phases_of_Engagement: "", AX_Source: "false", Percent_Evangelical_PGAC: "1" },
        true,
      ],
      [
        "excludes just below one percent without an AX phase",
        { Engage_8_Phases_of_Engagement: "", AX_Source: "false", Percent_Evangelical_PGAC: "0.999999" },
        false,
      ],
    ])("%s", (_label, overrides, expected) => {
      expect(buildSelfEngaged([{ ...base, ...overrides }]).rows).toHaveLength(expected ? 1 : 0);
    });
  });

  describe("Watchlist exact boundary contract", () => {
    const base = {
      PG_Population: "1000",
      Percent_Evangelical_PGAC: "0.5",
      Christianity_GSEC: "2",
      src__Christianity_GSEC: "IMB",
      Christianity_Frontier_Group: "true",
      src__Christianity_Frontier_Group: "JP",
    };

    it.each([
      ["includes the IMB GSEC maximum", { Christianity_GSEC: "2" }, true],
      ["excludes an IMB GSEC value above the maximum", { Christianity_GSEC: "2.000001" }, false],
      [
        "includes a population producing fewer than 50 evangelical believers",
        { PG_Population: "124999", Percent_Evangelical_PGAC: "0.04" },
        true,
      ],
      [
        "excludes exactly 50 evangelical believers",
        { PG_Population: "125000", Percent_Evangelical_PGAC: "0.04" },
        false,
      ],
      ["includes a proportion just below one percent", { Percent_Evangelical_PGAC: "0.999999" }, true],
      ["excludes the one-percent evangelical boundary", { Percent_Evangelical_PGAC: "1" }, false],
    ])("%s", (_label, overrides, expected) => {
      expect(buildWatchlist([{ ...base, ...overrides }]).rows).toHaveLength(expected ? 1 : 0);
    });
  });

  it("builds Baseline from explicitly unengaged rows and JP frontier provenance", () => {
    expect(buildBaselineUupg([
      { id: "keep", Engage_Global_Engagement_Anywhere: "false", Christianity_Frontier_Group: "true", src__Christianity_Frontier_Group: "JP" },
      { id: "engaged", Engage_Global_Engagement_Anywhere: "true", Christianity_Frontier_Group: "true", src__Christianity_Frontier_Group: "JP" },
      { id: "wrong-frontier", Engage_Global_Engagement_Anywhere: "false", Christianity_Frontier_Group: "false", src__Christianity_Frontier_Group: "JP" },
    ]).rows.map((row) => row.id)).toEqual(["keep"]);
  });

  it("returns exactly ten hotspot countries ordered by total then name", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      id: String(index),
      Geo_Country_Name: `Country ${String.fromCharCode(65 + index)}`,
      PG_Population: String(index === 10 || index === 11 ? 1 : 100 - index),
    }));
    const result = buildHotspots(rows);
    expect(new Set(result.rows.map((row) => row.Geo_Country_Name))).toHaveLength(10);
    expect(result.rows.some((row) => row.Primary_Country_Hotspot_Rank === "1")).toBe(true);
  });

  it("uses the pinned South Asia scope and reviewed aliases", () => {
    const result = buildSouthAsia([
      { id: "india", Geo_Country_Name: "India" },
      { id: "typo", Geo_Country_Name: "Pankistan" },
      { id: "outside", Geo_Country_Name: "Thailand" },
    ]);
    expect(result.rows.map((row) => row.id)).toEqual(["india", "typo"]);
    expect(SOUTH_ASIA_SCOPE_V1.checksum).toMatch(/^[0-9a-f]{64}$/u);
  });
});
