import { describe, expect, it } from "vitest";

import { listRegionCountryOptions } from "@/lib/filter-settings";
import { REGION_COUNTRY_OPTIONS } from "@/lib/region-country-options";

describe("listRegionCountryOptions", () => {
  it("returns the static region picker master list", async () => {
    await expect(listRegionCountryOptions()).resolves.toEqual(
      REGION_COUNTRY_OPTIONS,
    );
  });
});
