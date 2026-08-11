import { describe, expect, it } from "vitest";

import { normalizeHeaders } from "@/lib/csv";

import { buildTier2IdentityCandidate } from "./identity";
import type {
  Tier2FormingInput,
  Tier2FormingResult,
  Tier2IdentityEvidence,
  Tier2IdentityRegistryPort,
} from "./types";

const columns = normalizeHeaders([
  "Dataset_Row_Key",
  "Tier2_Tracking_ID",
  "Tier2_Tracking_ID_Source",
  "PG_PeopleID3",
  "PG_PEID",
  "PG_ROP3",
  "Geo_ISO3",
  "Provider_Native_Identity",
]);

function row(stableRowKey: string) {
  return Object.fromEntries(
    columns.map((column) => [
      column.key,
      column.label === "Dataset_Row_Key"
        ? stableRowKey
        : column.label === "Tier2_Tracking_ID"
          ? "900001"
          : column.label === "Tier2_Tracking_ID_Source"
            ? "peopleid3"
          : column.label === "PG_PeopleID3"
            ? "900001"
            : column.label === "PG_ROP3"
              ? "100001"
              : column.label === "Geo_ISO3"
                ? "AAA"
                : "",
    ]),
  );
}

const formingInput = {
  profile: {
    profileKey: "partner-alpha",
    partnerKey: "alpha",
    displayName: "Partner Alpha",
    apiConnectionId: "11111111-1111-4111-8111-111111111111",
    spreadsheetId: "sheet-alpha",
    sheetId: 42,
    sheetTitle: "Engagement",
    stableRowKeyColumn: "ID",
    trackingIdColumn: "Tracking",
    trackingIdSource: "peopleid3",
    trackingIdSourceColumn: null,
    trackingIdSourceMappings: [],
    sourceRop3Column: null,
    sourceCountryColumn: null,
    sourceIso3Column: null,
    contractVersion: "1",
    contractChecksum: "a".repeat(64),
    active: true,
  },
  sourceRunId: "run-1",
  columns: [],
  rows: [],
  resources: {} as Tier2FormingInput["resources"],
} satisfies Tier2FormingInput;

function result(stableRowKey: string): Tier2FormingResult {
  return {
    columns,
    rows: [row(stableRowKey)],
    findings: [],
    validation: {
      warningCount: 0,
      errorCount: 0,
      inputRowCount: 1,
      outputRowCount: 1,
      missingStableKeyRows: 0,
      duplicateStableKeyRows: 0,
      unresolvedTrackingRows: 0,
      ambiguousTrackingRows: 0,
      invalidSourceRop3Rows: 0,
      conflictingSourceRop3Rows: 0,
      unresolvedCountryRows: 0,
      invalidValueCount: 0,
    },
    outputChecksum: "b".repeat(64),
    valid: true,
    resourceLineage: {} as Tier2FormingResult["resourceLineage"],
  };
}

class ConcurrentRegistry implements Tier2IdentityRegistryPort {
  readonly values = new Map<string, Promise<{ identityId: string; canonicalPgic: string; registryRevisionId: string; reused: boolean }>>();
  cancellations: string[] = [];

  resolveOrReserve(evidence: Tier2IdentityEvidence) {
    const existing = this.values.get(evidence.stableRowKey);
    if (existing) return existing.then((value) => ({ ...value, reused: true }));
    const resolution = Promise.resolve({
      identityId: `identity-${this.values.size + 1}`,
      canonicalPgic: `PGIC-${this.values.size + 1}`,
      registryRevisionId: "revision-1",
      reused: false,
    });
    this.values.set(evidence.stableRowKey, resolution);
    return resolution;
  }

  async cancelReservations(reason: string) {
    this.cancellations.push(reason);
  }
}

describe("Tier 2 shared identity registry adapter", () => {
  it("reuses one stable identity under concurrent builds", async () => {
    const registry = new ConcurrentRegistry();
    const [first, second] = await Promise.all([
      buildTier2IdentityCandidate({
        formingInput,
        formingResult: result("partner-alpha:sheet-42:row-1"),
        registry,
      }),
      buildTier2IdentityCandidate({
        formingInput,
        formingResult: result("partner-alpha:sheet-42:row-1"),
        registry,
      }),
    ]);

    expect(registry.values).toHaveLength(1);
    expect(first.resolutions[0]?.identityId).toBe(second.resolutions[0]?.identityId);
    expect(first.resolutions[0]?.canonicalPgic).toBe(
      second.resolutions[0]?.canonicalPgic,
    );
  });

  it("cancels the candidate reservation set after a registry conflict", async () => {
    const registry: Tier2IdentityRegistryPort = {
      resolveOrReserve: async () => {
        throw new Error("allocated value collides with Tier 1");
      },
      cancelReservations: async (reason) => {
        expect(reason).toContain("collides with Tier 1");
      },
    };

    await expect(
      buildTier2IdentityCandidate({
        formingInput,
        formingResult: result("partner-alpha:sheet-42:row-1"),
        registry,
      }),
    ).rejects.toThrow("collides with Tier 1");
  });
});
