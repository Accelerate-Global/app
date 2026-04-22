import { describe, expect, it } from "vitest";

import { REGION_COUNTRY_OPTIONS } from "@/lib/region-country-options";

import {
  CANONICAL_FILTER_REGION_DEFINITIONS,
  normalizeCompatibleRegionName,
} from "./canonical-filter-regions";

describe("canonical filter regions", () => {
  it("defines the repo-owned Joshua Project region list in display order", () => {
    expect(
      CANONICAL_FILTER_REGION_DEFINITIONS.map((region) => region.name),
    ).toEqual([
      "Global",
      "Africa, East and Southern",
      "Africa, North and Middle East",
      "Africa, West and Central",
      "America, Latin",
      "America, North and Caribbean",
      "Asia, Central",
      "Asia, Northeast",
      "Asia, South",
      "Asia, Southeast",
      "Australia and Pacific",
      "Europe, Eastern and Eurasia",
      "Europe, Western",
    ]);
  });

  it("keeps canonical region countries inside the repo country master list", () => {
    const countryOptions = new Set(REGION_COUNTRY_OPTIONS);

    for (const region of CANONICAL_FILTER_REGION_DEFINITIONS) {
      expect(region.countries.every((country) => countryOptions.has(country))).toBe(true);
    }
  });

  it("normalizes legacy saved region names to the canonical labels", () => {
    expect(normalizeCompatibleRegionName(" Globe ")).toBe("Global");
    expect(normalizeCompatibleRegionName("South Asia")).toBe("Asia, South");
    expect(normalizeCompatibleRegionName("South East Asia")).toBe(
      "Asia, Southeast",
    );
    expect(normalizeCompatibleRegionName("America, Latin")).toBe("America, Latin");
  });
});
