import { z } from "zod";

import {
  TIER2_TRACKING_ID_SOURCES,
  type Tier2PartnerProfileConfig,
  type Tier2ProfileValidationIssue,
} from "./types";

const keyPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const checksumPattern = /^[a-f0-9]{64}$/u;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const tier2PartnerProfileConfigSchema = z
  .object({
    profileKey: z.string().trim().regex(keyPattern),
    partnerKey: z.string().trim().regex(keyPattern),
    displayName: z.string().trim().min(1).max(160),
    apiConnectionId: z.string().regex(uuidPattern),
    spreadsheetId: z.string().trim().min(1).max(256),
    sheetId: z.number().int().nonnegative(),
    sheetTitle: z.string().trim().min(1).max(256),
    stableRowKeyColumn: z.string().trim().min(1).max(256),
    trackingIdColumn: z.string().trim().min(1).max(256),
    trackingIdSource: z.enum(TIER2_TRACKING_ID_SOURCES),
    sourceRop3Column: z.string().trim().min(1).max(256).nullable(),
    sourceCountryColumn: z.string().trim().min(1).max(256).nullable(),
    sourceIso3Column: z.string().trim().min(1).max(256).nullable(),
    contractVersion: z.string().trim().min(1).max(96),
    contractChecksum: z.string().regex(checksumPattern),
    active: z.boolean(),
  })
  .strict();

function issue(
  field: Tier2ProfileValidationIssue["field"],
  code: string,
  message: string,
): Tier2ProfileValidationIssue {
  return { field, code, message };
}

export function validateTier2PartnerProfileConfig(value: unknown):
  | { valid: true; profile: Tier2PartnerProfileConfig; issues: [] }
  | { valid: false; profile: null; issues: Tier2ProfileValidationIssue[] } {
  const parsed = tier2PartnerProfileConfigSchema.safeParse(value);
  if (!parsed.success) {
    return {
      valid: false,
      profile: null,
      issues: parsed.error.issues.map((entry) =>
        issue(
          (entry.path[0] as Tier2ProfileValidationIssue["field"] | undefined) ??
            "profile",
          "invalid-profile-field",
          entry.message,
        ),
      ),
    };
  }

  const profile = parsed.data;
  const issues: Tier2ProfileValidationIssue[] = [];
  if (profile.stableRowKeyColumn === profile.trackingIdColumn) {
    issues.push(
      issue(
        "trackingIdColumn",
        "tracking-column-is-row-key",
        "Tracking ID and durable row key must use distinct columns.",
      ),
    );
  }
  if (
    profile.trackingIdSource === "rop3" &&
    profile.sourceRop3Column &&
    profile.sourceRop3Column !== profile.trackingIdColumn
  ) {
    issues.push(
      issue(
        "sourceRop3Column",
        "conflicting-rop3-columns",
        "ROP3 tracking profiles must use one source ROP3 column.",
      ),
    );
  }

  return issues.length > 0
    ? { valid: false, profile: null, issues }
    : { valid: true, profile, issues: [] };
}

export function validateTier2ProfileCollection(
  profiles: readonly Tier2PartnerProfileConfig[],
) {
  const issues: Tier2ProfileValidationIssue[] = [];
  const profileKeys = new Set<string>();
  const sheets = new Set<string>();

  for (const profile of profiles) {
    if (profileKeys.has(profile.profileKey)) {
      issues.push(
        issue(
          "profileKey",
          "duplicate-profile-key",
          `Profile key ${profile.profileKey} is already configured.`,
        ),
      );
    }
    const sheetKey = `${profile.spreadsheetId}:${profile.sheetId}`;
    if (sheets.has(sheetKey)) {
      issues.push(
        issue(
          "sheetId",
          "duplicate-sheet-binding",
          `Spreadsheet tab ${sheetKey} is already bound to another profile.`,
        ),
      );
    }
    profileKeys.add(profile.profileKey);
    sheets.add(sheetKey);
  }
  return issues;
}

export function refreshTier2ProfileSheetTitle(
  profile: Tier2PartnerProfileConfig,
  sheetTitle: string,
) {
  const normalized = sheetTitle.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!normalized) throw new Error("Sheet title cannot be blank.");
  return { ...profile, sheetTitle: normalized };
}
