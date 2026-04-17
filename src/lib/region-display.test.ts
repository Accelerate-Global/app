import { describe, expect, it } from "vitest";

import {
  isGlobeRegionName,
  normalizeRegionDisplayName,
  normalizeRegionDisplayText,
} from "./region-display";

describe("region-display", () => {
  it("detects Globe region names case-insensitively", () => {
    expect(isGlobeRegionName(" Globe ")).toBe(true);
    expect(isGlobeRegionName("South Asia")).toBe(false);
  });

  it("normalizes South East Asia region names for display", () => {
    expect(normalizeRegionDisplayName("South East Asia")).toBe("South Asia");
    expect(normalizeRegionDisplayName("North Africa")).toBe("North Africa");
  });

  it("normalizes South East Asia in product-facing copy", () => {
    expect(
      normalizeRegionDisplayText("Countries across South East Asia."),
    ).toBe("Countries across South Asia.");
  });
});
