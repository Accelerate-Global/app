import { describe, expect, it } from "vitest";

import { normalizeHeaders } from "@/lib/csv";
import { buildAxIdentityCodes } from "@/lib/identity-registry";

import {
  extractTier2IdentityEvidence,
  formTier2PartnerRows,
} from "./forming";
import { resolveTier2PartnerSourceAlias } from "./resources";
import type {
  Tier2FormingInput,
  Tier2PartnerProfileConfig,
  Tier2PartnerResources,
} from "./types";

const profile: Tier2PartnerProfileConfig = {
  profileKey: "partner-alpha",
  partnerKey: "alpha",
  displayName: "Partner Alpha",
  apiConnectionId: "11111111-1111-4111-8111-111111111111",
  spreadsheetId: "sheet-alpha",
  sheetId: 42,
  sheetTitle: "Engagement",
  stableRowKeyColumn: "Partner row ID",
  trackingIdColumn: "Tracking ID",
  trackingIdSource: "peopleid3",
  trackingIdSourceColumn: null,
  trackingIdSourceMappings: [],
  sourceRop3Column: "Source ROP3",
  sourceCountryColumn: "Country",
  sourceIso3Column: "ISO3",
  contractVersion: "2026.1",
  contractChecksum: "a".repeat(64),
  active: true,
};

const resources: Tier2PartnerResources = {
  countries: [
    { iso3: "AAA", displayName: "Alpha Country", alternativeNames: ["Alpha"] },
    { iso3: "BBB", displayName: "Beta Country", alternativeNames: ["Beta"] },
  ],
  ropEntries: [
    {
      rop1Code: "A001",
      rop2Code: "A00101",
      rop25Code: "10001",
      rop3Code: "100001",
      status: "Active",
      joinIssue: null,
      joinIssueLabel: null,
    },
    {
      rop1Code: "A002",
      rop2Code: "A00201",
      rop25Code: "10002",
      rop3Code: "100002",
      status: "Active",
      joinIssue: null,
      joinIssueLabel: null,
    },
  ],
  peopleId3Entries: [
    {
      peopleId3: "900001",
      rop3: "100001",
      iso3: "AAA",
      active: true,
      parentStatus: "linked",
      missingParentReason: null,
    },
  ],
  peidEntries: [],
  engagementMappings: [
    {
      fieldId: "F_1",
      sourceField: "Name",
      canonicalField: "PG_Name_Main",
      displayName: "People group name",
      active: true,
      dataType: "string",
    },
    {
      fieldId: "F_2",
      sourceField: "Engaged",
      canonicalField: "Engage_Binary",
      displayName: "Engaged",
      active: true,
      dataType: "boolean",
    },
  ],
  sourceAliases: [
    {
      fieldId: "F_3",
      canonicalSourceKey: "alpha",
      displayName: "Partner Alpha",
      initials: "pa",
      aliases: ["alpha"],
      active: true,
    },
  ],
  lineage: {
    countryVersionId: "country-v1",
    countryChecksum: "1".repeat(64),
    ropVersionId: "rop-v1",
    ropChecksum: "2".repeat(64),
    sourceAliasesVersionId: "source-aliases-v1",
    sourceAliasesChecksum: "6".repeat(64),
    peopleId3VersionId: "people-v1",
    peopleId3Checksum: "3".repeat(64),
    peidVersionId: "peid-v1",
    peidChecksum: "4".repeat(64),
    engagementMappingsVersionId: "engagement-v1",
    engagementMappingsChecksum: "5".repeat(64),
  },
};

const columns = normalizeHeaders([
  "Partner row ID",
  "Tracking ID",
  "Source ROP3",
  "Country",
  "ISO3",
  "Name",
  "Engaged",
]);

function sourceRow(values: string[]) {
  return Object.fromEntries(
    columns.map((column, index) => [column.key, values[index] ?? ""]),
  );
}

function valueByLabel(
  result: ReturnType<typeof formTier2PartnerRows>,
  rowIndex: number,
  label: string,
) {
  const key = result.columns.find((column) => column.label === label)?.key;
  return key ? result.rows[rowIndex]?.[key] : undefined;
}

function form(rows: Record<string, string>[], overrides: Partial<Tier2FormingInput> = {}) {
  return formTier2PartnerRows({
    profile,
    sourceRunId: "source-run-1",
    columns,
    rows,
    resources,
    ...overrides,
  });
}

describe("Tier 2 partner forming", () => {
  it("carries a configured partner source through deterministic identity rules", () => {
    const result = formTier2PartnerRows({
      profile,
      sourceRunId: "run-alpha",
      columns,
      rows: [
        Object.fromEntries(
          columns.map((column) => [
            column.key,
            {
              "Partner row ID": "row-1",
              "Tracking ID": "900001",
              "Source ROP3": "100001",
              Country: "Alpha",
              ISO3: "AAA",
              Name: "Alpha People",
              Engaged: "true",
            }[column.label] ?? "",
          ]),
        ),
      ],
      resources,
    });
    const byLabel = new Map(
      result.columns.map((column) => [column.label, column.key]),
    );
    const row = result.rows[0]!;
    const sourceAlias = resolveTier2PartnerSourceAlias({
      partnerKey: profile.partnerKey,
      resources,
    });

    expect(
      buildAxIdentityCodes({
        source: row[byLabel.get("Data_Source")!],
        sourceAliasBinding: {
          sourceKey: sourceAlias.canonicalSourceKey,
          initials: sourceAlias.initials,
        },
        rop1: row[byLabel.get("PG_ROP1")!],
        sixDigit: row[byLabel.get("PG_ROP3")!],
        sixDigitKind: "rop3",
        iso3: row[byLabel.get("Geo_ISO3")!],
        allowedRop3: new Set(["100001"]),
        allowedIso3: new Set(["AAA"]),
      }),
    ).toMatchObject({
      pgac: "01-pa-100001",
      pgic: "01-pa-100001-AAA",
    });
  });

  it("blocks a partner whose key has no exact active pinned source alias", () => {
    expect(() =>
      form(
        [
          sourceRow([
            "row-1",
            "900001",
            "100001",
            "Alpha",
            "AAA",
            "People A",
            "yes",
          ]),
        ],
        {
          resources: {
            ...resources,
            sourceAliases: [
              {
                ...resources.sourceAliases[0]!,
                canonicalSourceKey: "different-partner",
              },
            ],
          },
        },
      ),
    ).toThrow("has no active pinned source-alias entry");
  });

  it("maps typed values and resolves one exact PeopleID3/country/ROP lineage", () => {
    const result = form([
      sourceRow(["row-1", "900001", "100001", "Alpha", "AAA", "People A", "yes"]),
    ]);

    expect(result.valid).toBe(true);
    expect(result.validation).toMatchObject({ errorCount: 0, outputRowCount: 1 });
    expect(valueByLabel(result, 0, "Dataset_Row_Key")).toBe(
      "partner-alpha:sheet-42:row-1",
    );
    expect(valueByLabel(result, 0, "PG_ROP3")).toBe("100001");
    expect(valueByLabel(result, 0, "PG_ROP1")).toBe("A001");
    expect(valueByLabel(result, 0, "Geo_Country_Name")).toBe("Alpha Country");
    expect(valueByLabel(result, 0, "Engage_Binary")).toBe("TRUE");
    expect(result.resourceLineage).toEqual(resources.lineage);
  });

  it("resolves reviewed mixed tracking types independently for every row", () => {
    const mixedColumns = normalizeHeaders([
      "Partner row ID",
      "Tracking ID",
      "Tracking source",
      "Source ROP3",
      "Country",
      "ISO3",
      "Name",
      "Engaged",
    ]);
    const mixedProfile: Tier2PartnerProfileConfig = {
      ...profile,
      trackingIdSource: null,
      trackingIdSourceColumn: "Tracking source",
      trackingIdSourceMappings: [
        {
          sourceValue: "PGID3 (Joshua Project)",
          trackingIdSource: "peopleid3",
        },
        { sourceValue: "ROP3", trackingIdSource: "rop3" },
        {
          sourceValue: "Local / Organization code",
          trackingIdSource: "provider-native",
        },
      ],
    };
    const row = (values: Record<string, string>) =>
      Object.fromEntries(
        mixedColumns.map((column) => [column.key, values[column.label] ?? ""]),
      );
    const input: Tier2FormingInput = {
      profile: mixedProfile,
      sourceRunId: "mixed-run",
      columns: mixedColumns,
      rows: [
        row({
          "Partner row ID": "row-1",
          "Tracking ID": "900001",
          "Tracking source": "PGID3 (Joshua Project)",
          "Source ROP3": "100001",
          Country: "Alpha",
          ISO3: "AAA",
          Name: "People A",
          Engaged: "yes",
        }),
        row({
          "Partner row ID": "row-2",
          "Tracking ID": "100002",
          "Tracking source": "ROP3",
          "Source ROP3": "100002",
          Country: "Beta",
          ISO3: "BBB",
          Name: "People B",
          Engaged: "yes",
        }),
        row({
          "Partner row ID": "row-3",
          "Tracking ID": "local-3",
          "Tracking source": "Local / Organization code",
          "Source ROP3": "100001",
          Country: "Alpha",
          ISO3: "AAA",
          Name: "People C",
          Engaged: "yes",
        }),
      ],
      resources,
    };
    const result = formTier2PartnerRows(input);

    expect(result.valid).toBe(true);
    expect(result.rows.map((_, index) =>
      valueByLabel(result, index, "Tier2_Tracking_ID_Source"),
    )).toEqual(["peopleid3", "rop3", "provider-native"]);
    expect(
      extractTier2IdentityEvidence(input, result).map(
        (entry) => entry.trackingIdSource,
      ),
    ).toEqual(["peopleid3", "rop3", "provider-native"]);
  });

  it("blocks an unknown row tracking source instead of using a fallback", () => {
    const mixedColumns = normalizeHeaders([
      "Partner row ID",
      "Tracking ID",
      "Tracking source",
      "Source ROP3",
      "Country",
      "ISO3",
    ]);
    const row = Object.fromEntries(
      mixedColumns.map((column) => [
        column.key,
        {
          "Partner row ID": "row-1",
          "Tracking ID": "900001",
          "Tracking source": "Unknown registry",
          "Source ROP3": "100001",
          Country: "Alpha",
          ISO3: "AAA",
        }[column.label] ?? "",
      ]),
    );
    const result = formTier2PartnerRows({
      profile: {
        ...profile,
        trackingIdSource: null,
        trackingIdSourceColumn: "Tracking source",
        trackingIdSourceMappings: [
          { sourceValue: "ROP3", trackingIdSource: "rop3" },
        ],
      },
      sourceRunId: "unknown-source-run",
      columns: mixedColumns,
      rows: [row],
      resources,
    });

    expect(result.valid).toBe(false);
    expect(result.findings.map((entry) => entry.ruleCode)).toContain(
      "unmapped-tracking-id-source",
    );
    expect(valueByLabel(result, 0, "Tier2_Tracking_ID_Source")).toBe("");
  });

  it("preserves conflicting source/crosswalk ROP evidence and blocks formation", () => {
    const result = form([
      sourceRow(["row-1", "900001", "100002", "Alpha", "AAA", "People A", "yes"]),
    ]);

    expect(result.valid).toBe(false);
    expect(valueByLabel(result, 0, "PG_ROP3")).toBe("");
    expect(valueByLabel(result, 0, "Source_PG_ROP3_Evidence")).toBe("100002");
    expect(valueByLabel(result, 0, "Crosswalk_PG_ROP3_Evidence")).toBe(
      "100001",
    );
    expect(result.findings.map((entry) => entry.ruleCode)).toContain(
      "source-crosswalk-rop3-conflict",
    );
  });

  it("blocks missing, duplicate, unknown, and ambiguous tracking identities", () => {
    const ambiguousResources: Tier2PartnerResources = {
      ...resources,
      peopleId3Entries: [
        ...resources.peopleId3Entries,
        { ...resources.peopleId3Entries[0]!, rop3: "100002" },
      ],
    };

    expect(() =>
      form([sourceRow(["row-1", "900001", "", "Alpha", "AAA", "A", "yes"])], {
        resources: ambiguousResources,
      }),
    ).toThrow("more than one active crosswalk row");

    const result = form([
      sourceRow(["same", "unknown", "", "Alpha", "AAA", "A", "yes"]),
      sourceRow(["same", "", "", "Alpha", "AAA", "B", "maybe"]),
    ]);
    expect(result.valid).toBe(false);
    expect(result.validation).toMatchObject({
      duplicateStableKeyRows: 2,
      invalidValueCount: 1,
    });
    expect(new Set(result.findings.map((entry) => entry.ruleCode))).toEqual(
      new Set([
        "unresolved-tracking-id",
        "missing-resolved-rop3",
        "missing-tracking-id",
        "invalid-mapped-value",
        "duplicate-stable-row-key",
      ]),
    );
  });
});
