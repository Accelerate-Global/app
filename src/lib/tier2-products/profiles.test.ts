import { describe, expect, it } from "vitest";

import {
  refreshTier2ProfileSheetTitle,
  validateTier2PartnerProfileConfig,
  validateTier2ProfileCollection,
} from "./profiles";
import type { Tier2PartnerProfileConfig } from "./types";

const profile: Tier2PartnerProfileConfig = {
  profileKey: "partner-alpha",
  partnerKey: "alpha",
  displayName: "Partner Alpha",
  apiConnectionId: "11111111-1111-4111-8111-111111111111",
  spreadsheetId: "sheet-alpha",
  sheetId: 42,
  sheetTitle: "Engagement",
  stableRowKeyColumn: "Partner row ID",
  trackingIdColumn: "PeopleID3",
  trackingIdSource: "peopleid3",
  sourceRop3Column: "ROP3",
  sourceCountryColumn: "Country",
  sourceIso3Column: "ISO3",
  contractVersion: "2026.1",
  contractChecksum: "a".repeat(64),
  active: true,
};

describe("Tier 2 partner profiles", () => {
  it("accepts stable Sheet/tab and typed tracking configuration", () => {
    expect(validateTier2PartnerProfileConfig(profile)).toEqual({
      valid: true,
      profile,
      issues: [],
    });
  });

  it("rejects positional identity and ambiguous ROP3 configuration", () => {
    const invalid = validateTier2PartnerProfileConfig({
      ...profile,
      stableRowKeyColumn: "PeopleID3",
      trackingIdSource: "rop3",
      sourceRop3Column: "Other ROP3",
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.issues.map((entry) => entry.code)).toEqual([
      "tracking-column-is-row-key",
      "conflicting-rop3-columns",
    ]);
  });

  it("enforces unique profile, partner, and spreadsheet-tab bindings", () => {
    const issues = validateTier2ProfileCollection([
      profile,
      { ...profile, displayName: "Duplicate" },
    ]);

    expect(issues.map((entry) => entry.code)).toEqual([
      "duplicate-profile-key",
      "duplicate-partner-key",
      "duplicate-sheet-binding",
    ]);
  });

  it("refreshes display metadata without changing bound sheet identity", () => {
    expect(refreshTier2ProfileSheetTitle(profile, "  Renamed   Tab  ")).toEqual({
      ...profile,
      sheetTitle: "Renamed Tab",
    });
  });
});
