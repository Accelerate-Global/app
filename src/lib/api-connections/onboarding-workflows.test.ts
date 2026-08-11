import { describe, expect, it } from "vitest";

import {
  buildTier2WorkflowOwnerOptions,
  normalizeWorkflowKey,
  validateGoogleSheetsWorkflowAssignments,
} from "./onboarding-workflows";

describe("Google Sheets onboarding workflow assignments", () => {
  it("normalizes durable feed keys without guessing workflow type", () => {
    expect(normalizeWorkflowKey("Final-58 / Laos")).toBe("final-58-laos");
    expect(normalizeWorkflowKey("---")).toBe("");
  });

  it("offers only active Tier 2 owners", () => {
    expect(buildTier2WorkflowOwnerOptions([
      { canonicalSourceKey: "ax", displayName: "Accelerate", active: true },
      { canonicalSourceKey: "old", displayName: "Old", active: false },
    ])).toEqual([{ key: "ax", label: "Accelerate" }]);
  });

  it("fills unlinked tabs and validates reviewed workflow columns", () => {
    const assignments = validateGoogleSheetsWorkflowAssignments({
      assignments: [{
        sheetId: 1,
        kind: "tier1",
        sourceProfileKey: "accelerate-owned-people-groups",
        stableKeyColumn: "Source ID",
      }],
      selectedSheetIds: [1, 2],
      headersBySheetId: new Map([
        [1, ["Source ID", "Name"]],
        [2, ["Partner row", "PeopleID3"]],
      ]),
    });
    expect(assignments.get(1)?.kind).toBe("tier1");
    expect(assignments.get(2)).toEqual({ sheetId: 2, kind: "none" });
  });

  it("rejects unreviewed columns and ambiguous Tier 2 identity", () => {
    expect(() => validateGoogleSheetsWorkflowAssignments({
      assignments: [{
        sheetId: 1,
        kind: "tier2",
        ownerKey: "ax",
        feedKey: "final-58",
        feedName: "Final-58",
        stableRowKeyColumn: "Missing",
        trackingIdColumn: "PeopleID3",
        trackingIdSource: "peopleid3",
        trackingIdSourceColumn: null,
        trackingIdSourceMappings: [],
        sourceRop3Column: null,
        sourceCountryColumn: null,
        sourceIso3Column: null,
      }],
      selectedSheetIds: [1],
      headersBySheetId: new Map([[1, ["Row ID", "PeopleID3"]]]),
    })).toThrow(/not in the reviewed Sheet headers/u);
  });

  it("validates a row-specific Tier 2 tracking map without a fallback", () => {
    const assignment = {
      sheetId: 1,
      kind: "tier2" as const,
      ownerKey: "accelerate",
      feedKey: "final-58",
      feedName: "Final-58",
      stableRowKeyColumn: "Accelerate source row ID",
      trackingIdColumn: "Tracking ID# (any)",
      trackingIdSource: null,
      trackingIdSourceColumn: "Tracking # Source (from dropdown)",
      trackingIdSourceMappings: [
        {
          sourceValue: "PGID3 (Joshua Project)",
          trackingIdSource: "peopleid3" as const,
        },
        { sourceValue: "ROP3", trackingIdSource: "rop3" as const },
        {
          sourceValue: "Local / Organization code",
          trackingIdSource: "provider-native" as const,
        },
      ],
      sourceRop3Column: "People Group: 6dig Code ROP3 (PGIC)",
      sourceCountryColumn: "Country (engagement took place)",
      sourceIso3Column: null,
    };
    const result = validateGoogleSheetsWorkflowAssignments({
      assignments: [assignment],
      selectedSheetIds: [1],
      headersBySheetId: new Map([[1, [
        assignment.stableRowKeyColumn,
        assignment.trackingIdColumn,
        assignment.trackingIdSourceColumn,
        assignment.sourceRop3Column,
        assignment.sourceCountryColumn,
      ]]]),
    });

    expect(result.get(1)).toEqual(assignment);
  });
});
