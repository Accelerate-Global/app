import { describe, expect, it } from "vitest";

import { getCountryFeatureStyle } from "./dataset-country-map";

describe("getCountryFeatureStyle", () => {
  it("keeps record intensity in the fill and uses a subtle teal selection stroke", () => {
    const unselected = getCountryFeatureStyle({
      count: 75,
      maximumCount: 100,
      selected: false,
    });
    const selected = getCountryFeatureStyle({
      count: 75,
      maximumCount: 100,
      selected: true,
    });

    expect(selected.fillColor).toBe(unselected.fillColor);
    expect(selected.fillOpacity).toBe(unselected.fillOpacity);
    expect(selected.color).toBe("#0f766e");
    expect(selected.color).not.toBe("#0f172a");
    expect(selected.weight).toBeLessThanOrEqual(1.5);
    expect(unselected.weight).toBeLessThan(selected.weight);
  });
});
