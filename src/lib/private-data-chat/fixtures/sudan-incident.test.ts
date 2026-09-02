import { describe, expect, it } from "vitest";

import {
  matchesIncidentUupg,
  PRIVATE_DATA_CHAT_SUDAN_INCIDENT_FIXTURE,
} from "@/lib/private-data-chat/fixtures/sudan-incident";

describe("private data chat Sudan incident fixture", () => {
  it("freezes the sanitized 100/103/104 regression counts", () => {
    const { expected, recordLimit, rows } =
      PRIVATE_DATA_CHAT_SUDAN_INCIDENT_FIXTURE;

    expect(rows).toHaveLength(expected.totalRows);
    expect(rows.filter((row) => row.frontierGroup === true)).toHaveLength(
      expected.explicitFrontierMatches,
    );
    expect(
      rows.filter(
        (row) =>
          row.globallyEngaged === false && row.frontierGroup === true,
      ),
    ).toHaveLength(expected.explicitDualCriterionMatches);
    expect(rows.filter(matchesIncidentUupg)).toHaveLength(
      expected.authoritativeUupgMatches,
    );
    expect(recordLimit).toBe(100);
    expect(expected.authoritativeUupgMatches).toBeGreaterThan(recordLimit);
  });

  it("contains only generated identifiers and no production row payload", () => {
    expect(
      PRIVATE_DATA_CHAT_SUDAN_INCIDENT_FIXTURE.rows.every((row, index) =>
        row.peopleId.endsWith(String(index + 1).padStart(3, "0")),
      ),
    ).toBe(true);
  });
});
