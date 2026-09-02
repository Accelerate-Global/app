import { describe, expect, it } from "vitest";

import {
  compilePrivateDataChatNamedFilterExpression,
  evaluatePrivateDataChatNamedFilter,
  getPrivateDataChatNamedFilterExpression,
  PRIVATE_DATA_CHAT_NAMED_FILTER_CHECKSUM,
  PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
  type PrivateDataChatNamedFilterInputValue,
} from "@/lib/private-data-chat/named-filters";

const selection = {
  key: "uupg",
  version: 1,
  options: {
    globalEngagementAnywhereEnabled: true,
    frontierGroupEnabled: true,
  },
} as const;

const states: readonly PrivateDataChatNamedFilterInputValue[] = [
  true,
  false,
  null,
  "invalid",
];

describe("private data chat named filters", () => {
  it("freezes a checksum-bound registry version", () => {
    expect(PRIVATE_DATA_CHAT_NAMED_FILTER_CHECKSUM).toMatch(/^[0-9a-f]{64}$/);
    expect(PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION).toBe(
      `named-filters-v1.${PRIVATE_DATA_CHAT_NAMED_FILTER_CHECKSUM.slice(0, 12)}`,
    );
  });

  it("evaluates the complete true/false/blank/invalid UUPG truth table", () => {
    for (const globallyEngaged of states) {
      for (const frontierGroup of states) {
        const expected =
          (globallyEngaged === false || globallyEngaged === null) &&
          (frontierGroup === true || frontierGroup === null);
        expect(
          evaluatePrivateDataChatNamedFilter(selection, {
            globally_engaged: globallyEngaged,
            frontier_group: frontierGroup,
          }),
          `${String(globallyEngaged)} / ${String(frontierGroup)}`,
        ).toBe(expected);
      }
    }
  });

  it("supports either independently enabled criterion", () => {
    expect(
      evaluatePrivateDataChatNamedFilter(
        {
          ...selection,
          options: {
            globalEngagementAnywhereEnabled: false,
            frontierGroupEnabled: true,
          },
        },
        { globally_engaged: true, frontier_group: null },
      ),
    ).toBe(true);
    expect(
      evaluatePrivateDataChatNamedFilter(
        {
          ...selection,
          options: {
            globalEngagementAnywhereEnabled: true,
            frontierGroupEnabled: false,
          },
        },
        { globally_engaged: null, frontier_group: false },
      ),
    ).toBe(true);
  });

  it("compiles only trusted expressions and positional boolean parameters", () => {
    const parameters: Array<string | number | boolean | null> = [];
    const sql = compilePrivateDataChatNamedFilterExpression({
      expression: getPrivateDataChatNamedFilterExpression(selection),
      fields: {
        globally_engaged: {
          valueExpression: 'p."globally_engaged"',
          missingExpression: 'p."globally_engaged_is_missing" = true',
        },
        frontier_group: {
          valueExpression: 'p."frontier_group"',
          missingExpression: 'p."frontier_group_is_missing" = true',
        },
      },
      parameters,
    });

    expect(sql).toContain('p."globally_engaged" = $1::boolean');
    expect(sql).toContain('p."globally_engaged_is_missing" = true');
    expect(sql).toContain('p."frontier_group" = $2::boolean');
    expect(sql).toContain('p."frontier_group_is_missing" = true');
    expect(parameters).toEqual([false, true]);
  });

  it("rejects a selection that disables every criterion", () => {
    expect(() =>
      getPrivateDataChatNamedFilterExpression({
        ...selection,
        options: {
          globalEngagementAnywhereEnabled: false,
          frontierGroupEnabled: false,
        },
      }),
    ).toThrow("not approved");
  });
});
