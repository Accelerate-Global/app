import { describe, expect, it } from "vitest";

import { REGION_COUNTRY_OPTIONS } from "@/lib/region-country-options";

describe("REGION_COUNTRY_OPTIONS", () => {
  it("contains the full normalized master list", () => {
    expect(REGION_COUNTRY_OPTIONS).toHaveLength(273);
    expect(REGION_COUNTRY_OPTIONS[0]).toBe("Afghanistan");
    expect(REGION_COUNTRY_OPTIONS.at(-1)).toBe("Zimbabwe");
  });

  it("is unique and sorted", () => {
    expect(new Set(REGION_COUNTRY_OPTIONS).size).toBe(
      REGION_COUNTRY_OPTIONS.length,
    );
    expect(REGION_COUNTRY_OPTIONS).toEqual(
      [...REGION_COUNTRY_OPTIONS].sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: "base" }),
      ),
    );
  });
});
