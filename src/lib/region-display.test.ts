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

  it("normalizes legacy Globe and South region aliases for display", () => {
    expect(normalizeRegionDisplayName("Globe")).toBe("Global");
    expect(normalizeRegionDisplayName("South Asia")).toBe("Asia, South");
    expect(normalizeRegionDisplayName("South East Asia")).toBe("Asia, Southeast");
    expect(normalizeRegionDisplayName("North Africa")).toBe("North Africa");
  });

  it("normalizes region names for matching", () => {
    expect(normalizeRegionMatchName(" Globe ")).toBe("global");
    expect(normalizeRegionMatchName("South Asia")).toBe("asia, south");
    expect(normalizeRegionMatchName("South East Asia")).toBe("asia, southeast");
  });

  it("normalizes legacy Globe and South region aliases in product-facing copy", () => {
    expect(
      normalizeRegionDisplayText("Globe coverage across South Asia and South East Asia."),
    ).toBe("Global coverage across Asia, South and Asia, Southeast.");
  });
});
