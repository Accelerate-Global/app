import { describe, expect, it } from "vitest";

import {
  evaluateUupgFilter,
  type UupgFilterInputValue,
} from "@/lib/uupg-filter";

const values: readonly UupgFilterInputValue[] = [
  true,
  false,
  null,
  "invalid",
];

describe("UUPG filter", () => {
  it("preserves the complete null-aware two-criterion truth table", () => {
    for (const globallyEngaged of values) {
      for (const frontierGroup of values) {
        expect(
          evaluateUupgFilter(
            {
              globalEngagementAnywhereEnabled: true,
              frontierGroupEnabled: true,
            },
            { globallyEngaged, frontierGroup },
          ),
          `${String(globallyEngaged)} / ${String(frontierGroup)}`,
        ).toBe(
          (globallyEngaged === false || globallyEngaged === null) &&
            (frontierGroup === true || frontierGroup === null),
        );
      }
    }
  });

  it("supports the global-engagement criterion independently", () => {
    expect(
      evaluateUupgFilter(
        {
          globalEngagementAnywhereEnabled: true,
          frontierGroupEnabled: false,
        },
        { globallyEngaged: null, frontierGroup: false },
      ),
    ).toBe(true);
    expect(
      evaluateUupgFilter(
        {
          globalEngagementAnywhereEnabled: true,
          frontierGroupEnabled: false,
        },
        { globallyEngaged: true, frontierGroup: true },
      ),
    ).toBe(false);
  });

  it("supports the frontier-group criterion independently", () => {
    expect(
      evaluateUupgFilter(
        {
          globalEngagementAnywhereEnabled: false,
          frontierGroupEnabled: true,
        },
        { globallyEngaged: true, frontierGroup: null },
      ),
    ).toBe(true);
    expect(
      evaluateUupgFilter(
        {
          globalEngagementAnywhereEnabled: false,
          frontierGroupEnabled: true,
        },
        { globallyEngaged: false, frontierGroup: false },
      ),
    ).toBe(false);
  });

  it("rejects a selection with every criterion disabled", () => {
    expect(() =>
      evaluateUupgFilter(
        {
          globalEngagementAnywhereEnabled: false,
          frontierGroupEnabled: false,
        },
        { globallyEngaged: null, frontierGroup: null },
      ),
    ).toThrow("At least one UUPG criterion must be enabled");
  });
});
