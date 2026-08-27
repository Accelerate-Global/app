import { describe, expect, it } from "vitest";

import {
  DATASET_MAP_COUNT_FILL_COLORS,
  getCountryFeatureStyle,
} from "./dataset-country-map";

describe("getCountryFeatureStyle", () => {
  it("keeps record intensity in the fill and uses semantic selection tokens", () => {
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
    expect(selected.color).toBe("var(--dataset-map-selected)");
    expect(unselected.color).toBe("var(--dataset-map-boundary)");
    expect(selected.weight).toBeLessThanOrEqual(1.5);
    expect(unselected.weight).toBeLessThan(selected.weight);
  });

  it("uses the shared semantic ramp for every intensity bucket", () => {
    const fillColors = [10, 25, 50, 75].map(
      (count) =>
        getCountryFeatureStyle({
          count,
          maximumCount: 100,
          selected: false,
        }).fillColor,
    );

    expect(fillColors).toEqual(DATASET_MAP_COUNT_FILL_COLORS);
    expect(
      getCountryFeatureStyle({
        count: 0,
        maximumCount: 100,
        selected: false,
      }).fillColor,
    ).toBe("var(--dataset-map-empty)");
  });
});
