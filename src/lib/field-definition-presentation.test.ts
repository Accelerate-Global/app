import { describe, expect, it } from "vitest";

import { getFieldDefinitionEffectiveLabel } from "@/lib/field-definition-presentation";

describe("getFieldDefinitionEffectiveLabel", () => {
  it("prefers the saved display label", () => {
    expect(
      getFieldDefinitionEffectiveLabel({
        label: "Geo_country_name",
        displayLabel: "Country Name",
      } as never),
    ).toBe("Country Name");
  });

  it("falls back to the raw label when no display label is saved", () => {
    expect(
      getFieldDefinitionEffectiveLabel({
        label: "Geo_country_name",
        displayLabel: "   ",
      } as never),
    ).toBe("Geo_country_name");
  });
});
