import { describe, expect, it } from "vitest";

import {
  isGlobalRegionName,
  isGlobeRegionName,
  normalizeRegionMatchName,
  normalizeRegionDisplayName,
  normalizeRegionDisplayText,
} from "./region-display";

describe("region-display", () => {
  it("detects Global region aliases case-insensitively", () => {
    expect(isGlobalRegionName(" Global ")).toBe(true);
    expect(isGlobeRegionName(" Globe ")).toBe(true);
    expect(isGlobeRegionName("South Asia")).toBe(false);
  });

  it("normalizes legacy Globe and South East Asia region names for display", () => {
    expect(normalizeRegionDisplayName("Globe")).toBe("Global");
    expect(normalizeRegionDisplayName("South East Asia")).toBe("South Asia");
    expect(normalizeRegionDisplayName("North Africa")).toBe("North Africa");
  });

  it("normalizes region names for matching", () => {
    expect(normalizeRegionMatchName(" Globe ")).toBe("global");
    expect(normalizeRegionMatchName("South East Asia")).toBe("south asia");
  });

  it("normalizes legacy Globe and South East Asia in product-facing copy", () => {
    expect(
      normalizeRegionDisplayText("Globe coverage across South East Asia."),
    ).toBe("Global coverage across South Asia.");
  });
});
