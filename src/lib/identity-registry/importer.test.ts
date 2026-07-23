import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertLegacyAxIdentityGraphManifestOverlay,
  assertLegacyImportCommitAllowed,
  buildLegacyAxIdentityGraph,
  computeLegacyAxIdentityGraphChecksum,
  inspectLegacyIdentitySnapshots,
  parseLegacyAxIdentityGraphManifest,
  type LegacyAxGraphFileKey,
  type LegacyAxIdentityGraphManifest,
} from "./importer";

function snapshot(body: string, path = "/explicit/identity-ledger.csv") {
  return {
    path,
    expectedChecksum: createHash("sha256").update(body).digest("hex"),
    body,
  };
}

describe("legacy identity snapshot importer", () => {
  it("dry-runs an explicit checksummed snapshot deterministically", () => {
    const body = [
      "source_profile_key,stable_row_key,pgac_code,pgic_code,uuid,aliases",
      'jp,jp:1,10-jp-100001,10-jp-100001-LAO,100001,"10-jp-100002;10-jp-100002-LAO"',
    ].join("\n");
    const first = inspectLegacyIdentitySnapshots({ snapshots: [snapshot(body)] });
    const second = inspectLegacyIdentitySnapshots({ snapshots: [snapshot(body)] });

    expect(first.inputFingerprint).toBe(second.inputFingerprint);
    expect(first.blocking).toBe(false);
    expect(first.rows).toHaveLength(1);
    expect(first.rows[0]?.uuid).toBe("100001");
    expect(() => assertLegacyImportCommitAllowed(first)).not.toThrow();
  });

  it("refuses checksum mismatch, duplicate keys/codes/UUIDs, malformed values, and orphans", () => {
    const body = [
      "source_profile_key,stable_row_key,pgac_code,pgic_code,uuid,aliases",
      "jp,jp:1,10-jp-100001,10-jp-100001-LAO,100001,",
      "jp,jp:1,10-jp-100001,10-jp-100001-LAO,100001,bad",
      ",,bad,bad-LAO,nope,",
    ].join("\n");
    const result = inspectLegacyIdentitySnapshots({ snapshots: [snapshot(body)] });
    const codes = new Set(result.findings.map((entry) => entry.ruleCode));

    expect(codes).toEqual(
      expect.objectContaining({
        size: expect.any(Number),
      }),
    );
    expect(codes.has("duplicate-source-key")).toBe(true);
    expect(codes.has("code-collision")).toBe(true);
    expect(codes.has("duplicate-uuid")).toBe(true);
    expect(codes.has("malformed-code")).toBe(true);
    expect(codes.has("orphan-binding")).toBe(true);
    expect(result.blocking).toBe(true);
    expect(() => assertLegacyImportCommitAllowed(result)).toThrow(/blocking/u);
  });

  it("blocks a legacy UUID that does not match its canonical PGAC suffix", () => {
    const body = [
      "source_profile_key,stable_row_key,pgac_code,pgic_code,uuid,aliases",
      "jp,jp:1,10-jp-100001,10-jp-100001-LAO,100002,",
    ].join("\n");
    const result = inspectLegacyIdentitySnapshots({ snapshots: [snapshot(body)] });

    expect(result.findings.map((entry) => entry.ruleCode)).toContain("uuid-code-mismatch");
    expect(result.blocking).toBe(true);
  });

  it("never discovers a latest file and requires explicit paths", () => {
    expect(() => inspectLegacyIdentitySnapshots({ snapshots: [] })).toThrow(/explicit/u);
    expect(() =>
      inspectLegacyIdentitySnapshots({
        snapshots: [{ path: "", expectedChecksum: "0".repeat(64), body: "" }],
      }),
    ).toThrow(/explicit path/u);
  });
});

const uuidHeaders = [
  "AX Code",
  "Dataset_Row_Key",
  "ROP1",
  "Data Source",
  "AX UUID",
  "ISO3",
  ...Array.from({ length: 20 }, (_, index) => `Alias ${index + 1}`),
];
const rop3Headers = [
  "Dataset_Row_Key",
  "AX Code",
  "PGAC",
  "PGIC",
  "ROP1",
  "ROP3",
  "Data Source",
  "ISO3",
  "Dataset",
  "Prefix",
  ...Array.from({ length: 20 }, (_, index) => `Alias ${index + 1}`),
  "AX UUID",
];

function csv(headers: readonly string[], rows: readonly Record<string, string>[]) {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => row[header] ?? "").join(",")),
  ].join("\n");
}

function graphFixture() {
  const sharedUuid = csv(uuidHeaders, [
    {
      "AX Code": "10-ax-1-LAO",
      Dataset_Row_Key: "ax:sheet-tier2:1",
      ROP1: "A010",
      "Data Source": "ax",
      "AX UUID": "1",
      ISO3: "LAO",
      "Alias 1": "10-ax-000001-LAO",
    },
    {
      "AX Code": "10-jp-000900-NPL",
      Dataset_Row_Key: "jp:tier1:2",
      ROP1: "A010",
      "Data Source": "jp",
      "AX UUID": "2",
      ISO3: "NPL",
    },
    {
      "AX Code": "10-jp-000003-IND",
      Dataset_Row_Key: "jp:tier1:3",
      ROP1: "A010",
      "Data Source": "jp",
      "AX UUID": "3",
      ISO3: "IND",
    },
  ]);
  const tier2Uuid = csv(uuidHeaders, [
    {
      "AX Code": "10-ax-1-LAO",
      Dataset_Row_Key: "ax:sheet-tier2:1",
      ROP1: "A010",
      "Data Source": "ax",
      "AX UUID": "1",
      ISO3: "LAO",
      "Alias 1": "10-ax-000001-LAO",
    },
  ]);
  const overlap = {
    Dataset_Row_Key: "jp:tier1:2",
    "AX Code": "10-jp-000900-NPL",
    PGAC: "10-jp-100001",
    PGIC: "10-jp-100001-NPL",
    ROP1: "A010",
    ROP3: "100001",
    "Data Source": "jp",
    ISO3: "NPL",
  };
  const sharedOnly = {
    Dataset_Row_Key: "im:tier1:4",
    "AX Code": "10-im-100002-LAO",
    PGAC: "10-im-100002",
    PGIC: "10-im-100002-LAO",
    ROP1: "A010",
    ROP3: "100002",
    "Data Source": "im",
    ISO3: "LAO",
    "Alias 1": "10-jp-000003-IND",
  };
  const sharedRop3 = csv(rop3Headers, [overlap, sharedOnly]);
  const tier2Rop3 = csv(rop3Headers, [
    sharedOnly,
    {
      Dataset_Row_Key: "zz:partner-one:5",
      "AX Code": "10-zz-100003-LAO",
      PGAC: "10-zz-100003",
      PGIC: "10-zz-100003-LAO",
      ROP1: "A010",
      ROP3: "100003",
      "Data Source": "zz",
      ISO3: "LAO",
      Dataset: "partner_one",
    },
  ]);
  const bodies: Record<LegacyAxGraphFileKey, Buffer> = {
    sharedUuidLedger: Buffer.from(sharedUuid),
    tier1UuidLedger: Buffer.from(sharedUuid),
    tier2UuidLedger: Buffer.from(tier2Uuid),
    sharedRop3Ledger: Buffer.from(sharedRop3),
    tier2Rop3Ledger: Buffer.from(tier2Rop3),
  };
  const manifest: LegacyAxIdentityGraphManifest = {
    schemaVersion: 1,
    namespace: "people-groups",
    files: Object.fromEntries(
      Object.entries(bodies).map(([key, body]) => [
        key,
        {
          relativePath: `fixtures/${key}.csv`,
          sha256: createHash("sha256").update(body).digest("hex"),
          rowCount:
            key === "sharedUuidLedger" || key === "tier1UuidLedger"
              ? 3
              : key === "tier2UuidLedger" || key === "tier2Rop3Ledger"
                ? key === "tier2UuidLedger"
                  ? 1
                  : 2
                : 2,
        },
      ]),
    ) as LegacyAxIdentityGraphManifest["files"],
    tier1SourceProfiles: {
      ax: "accelerate-owned-people-groups",
      im: "imb-people-groups",
      jp: "joshua-project-pgic",
    },
    tier2Components: {
      "dataset:partner_one": { expectedRowCount: 1, profileKey: "partner-one" },
      "spreadsheet:sheet-tier2": { expectedRowCount: 1, profileKey: "partner-two" },
    },
    bindingTranslation: {
      status: "blocked-pending-pinned-source-crosswalk",
      algorithmVersion: "source-forming-runtime-stable-row-key-v1",
      relativePath: null,
      sha256: null,
      rawBindingCount: 5,
      selectedActiveBindingCount: 0,
    },
    expected: {
      tier2Rop3UnionAddedRowCount: 1,
      bindingCount: 5,
      pgacCount: 5,
      pgicCount: 5,
      identityCount: 10,
      rawUnionPgacCount: 6,
      rawUnionPgicCount: 6,
      rawUnionIdentityCount: 12,
      supersededCanonicalCodeCount: 2,
      shortPrimaryNormalizationCount: 1,
      crossLedgerMismatchCount: 1,
      quarantinedAliasConflictCount: 1,
      allocationCounterFloor: 4,
    },
  };
  return { bodies, manifest };
}

describe("production legacy AX identity graph", () => {
  it("uses bytewise tuple ordering for every binding included in the graph checksum", () => {
    const binding = (sourceProfileKey: string, stableRowKey: string) => ({
      sourceProfileKey,
      stableRowKey,
      identityCanonicalCode: "10-zz-100001-LAO",
      sourcePgacCode: "10-zz-100001",
      sourcePgicCode: "10-zz-100001-LAO",
      tier2Component: null,
    });
    const expectedOrder = [
      binding("Partner", "key"),
      binding("partner", "-key"),
      binding("partner", ":key"),
      binding("partner-lao", "key"),
    ];
    const canonicalBinding = (value: ReturnType<typeof binding>) =>
      JSON.stringify({
        identityCanonicalCode: value.identityCanonicalCode,
        sourcePgacCode: value.sourcePgacCode,
        sourcePgicCode: value.sourcePgicCode,
        sourceProfileKey: value.sourceProfileKey,
        stableRowKey: value.stableRowKey,
        tier2Component: value.tier2Component,
      });
    const expectedChecksum = createHash("sha256")
      .update(
        `parents\nchildren\naliases\nbindings\n${expectedOrder
          .map(canonicalBinding)
          .join("\n")}\n`,
      )
      .digest("hex");

    expect(
      computeLegacyAxIdentityGraphChecksum({
        parents: [],
        children: [],
        aliases: [],
        bindings: [...expectedOrder].reverse(),
      }),
    ).toBe(expectedChecksum);
  });

  it("builds the deterministic parent-child-binding graph with reviewed precedence", () => {
    const fixture = graphFixture();
    const plan = buildLegacyAxIdentityGraph({
      manifest: fixture.manifest,
      files: fixture.bodies,
    });

    expect(plan.blocking).toBe(true);
    expect(plan.report.graph).toMatchObject({
      bindings: 0,
      pgacIdentities: 5,
      pgicIdentities: 5,
      identities: 10,
      allocationCounterFloor: 4,
    });
    expect(plan.report.reconciliation).toEqual({
      shortPrimaryNormalizations: 1,
      crossLedgerMismatches: 1,
      quarantinedAliasConflicts: 1,
      tier2Rop3UnionAddedRows: 1,
      rawUnionIdentities: 12,
      supersededCanonicalCodes: 2,
    });
    expect(
      plan.historicalBindings.find((binding) => binding.stableRowKey === "jp:tier1:2"),
    ).toMatchObject({
      sourceProfileKey: "joshua-project-pgic",
      identityCanonicalCode: "10-jp-100001-NPL",
    });
    expect(
      plan.parents.find((parent) => parent.canonicalCode === "10-jp-100001"),
    ).toMatchObject({ allocatedValue: null, rop3Component: "100001" });
    expect(plan.parents).not.toContainEqual(
      expect.objectContaining({ canonicalCode: "10-jp-000900" }),
    );
    expect(plan.aliases).toContainEqual(
      expect.objectContaining({
        code: "10-jp-000900-NPL",
        identityCanonicalCode: "10-jp-100001-NPL",
      }),
    );
    expect(plan.audits.map((audit) => audit.auditKind)).toEqual([
      "alias-conflict-quarantined",
      "cross-ledger-mismatch",
      "short-primary-normalized",
    ]);
  });

  it("keeps historical keys unbound until pinned source snapshots prove a runtime crosswalk", () => {
    const fixture = graphFixture();
    const plan = buildLegacyAxIdentityGraph({
      manifest: fixture.manifest,
      files: fixture.bodies,
    });

    expect(plan.report.bindingTranslation).toMatchObject({
      status: "blocked-pending-pinned-source-crosswalk",
      present: false,
      rawBindingCount: 5,
      selectedActiveBindingCount: 0,
      historicalUnboundCount: 5,
    });
    expect(plan.historicalBindings).toHaveLength(5);
    expect(plan.bindings).toHaveLength(0);
    expect(plan.blocking).toBe(true);
  });

  it("fails closed with a safe component-only report until every Tier 2 mapping is explicit", () => {
    const fixture = graphFixture();
    const manifest = {
      ...fixture.manifest,
      tier2Components: {
        ...fixture.manifest.tier2Components,
        "dataset:partner_one": {
          expectedRowCount: 1,
          profileKey: null,
        },
      },
    } satisfies LegacyAxIdentityGraphManifest;
    const plan = buildLegacyAxIdentityGraph({ manifest, files: fixture.bodies });
    const report = JSON.stringify(plan.report);

    expect(plan.blocking).toBe(true);
    expect(plan.report.tier2Components).toContainEqual(
      expect.objectContaining({ component: "dataset:partner_one", mapped: false }),
    );
    expect(report).not.toContain("jp:tier1:2");
  });

  it("requires the Tier 1 UUID copy to remain byte-identical", () => {
    const fixture = graphFixture();
    const altered = Buffer.from(
      fixture.bodies.tier1UuidLedger.toString("utf8").replace("jp:tier1:3", "jp:tier1:9"),
    );
    const manifest = {
      ...fixture.manifest,
      files: {
        ...fixture.manifest.files,
        tier1UuidLedger: {
          ...fixture.manifest.files.tier1UuidLedger,
          sha256: createHash("sha256").update(altered).digest("hex"),
        },
      },
    };

    expect(() =>
      buildLegacyAxIdentityGraph({
        manifest,
        files: { ...fixture.bodies, tier1UuidLedger: altered },
      }),
    ).toThrow(/byte-identical/u);
  });

  it("pins the repo manifest to the characterized authoritative inventory", () => {
    const manifest = parseLegacyAxIdentityGraphManifest(
      JSON.parse(
        readFileSync("config/legacy-ax-identity-import-manifest.json", "utf8"),
      ) as unknown,
    );

    expect(manifest.expected).toMatchObject({
      bindingCount: 296_297,
      pgacCount: 37_004,
      pgicCount: 52_233,
      identityCount: 89_237,
      rawUnionIdentityCount: 89_243,
      supersededCanonicalCodeCount: 6,
      allocationCounterFloor: 2_055,
    });
    expect(Object.values(manifest.tier2Components)).toHaveLength(17);
    expect(Object.values(manifest.tier2Components).every((entry) => entry.profileKey === null)).toBe(
      true,
    );
  });

  it("binds the reviewable hashed production reconciliation decisions into the report", () => {
    const manifest = parseLegacyAxIdentityGraphManifest(
      JSON.parse(
        readFileSync("config/legacy-ax-identity-import-manifest.json", "utf8"),
      ) as unknown,
    );
    const files = Object.fromEntries(
      Object.entries(manifest.files).map(([key, file]) => [
        key,
        readFileSync(resolve("../data", file.relativePath)),
      ]),
    ) as Record<LegacyAxGraphFileKey, Buffer>;
    const plan = buildLegacyAxIdentityGraph({ manifest, files });
    const mismatchDecisions = plan.report.audit.decisions.filter(
      (decision) => decision.auditKind === "cross-ledger-mismatch",
    );
    const quarantineDecisions = plan.report.audit.decisions.filter(
      (decision) => decision.auditKind === "alias-conflict-quarantined",
    );

    expect(plan.report.audit.records).toBe(570);
    expect(mismatchDecisions).toHaveLength(3);
    expect(quarantineDecisions).toHaveLength(3);
    expect(
      plan.report.audit.decisions.every((decision) =>
        /^[0-9a-f]{64}$/u.test(decision.stableRowKeyHash),
      ),
    ).toBe(true);
    expect(JSON.stringify(plan.report.audit.decisions)).not.toContain("Dataset_Row_Key");
    expect(plan.report.audit.artifactChecksum).toMatch(/^[0-9a-f]{64}$/u);
    expect(plan.report.bindingTranslation).toMatchObject({
      present: false,
      rawBindingCount: 296_297,
      selectedActiveBindingCount: 0,
      historicalUnboundCount: 296_297,
    });
    expect(plan.blocking).toBe(true);
  }, 30_000);

  it("accepts only Tier 2 profile-key edits in a reviewed manifest overlay", () => {
    const raw = JSON.parse(
      readFileSync("config/legacy-ax-identity-import-manifest.json", "utf8"),
    ) as {
      files: Record<string, { relativePath: string; sha256: string; rowCount: number }>;
      tier1SourceProfiles: Record<string, string>;
      tier2Components: Record<string, { expectedRowCount: number; profileKey: string | null }>;
      bindingTranslation: {
        status: "blocked-pending-pinned-source-crosswalk";
        algorithmVersion: "source-forming-runtime-stable-row-key-v1";
        relativePath: null;
        sha256: null;
        rawBindingCount: number;
        selectedActiveBindingCount: 0;
      };
      expected: Record<string, number>;
    };
    const canonical = parseLegacyAxIdentityGraphManifest(raw);
    const overlayRaw = structuredClone(raw);
    overlayRaw.tier2Components[Object.keys(overlayRaw.tier2Components)[0]!]!.profileKey =
      "reviewed-partner-profile";
    const overlay = parseLegacyAxIdentityGraphManifest(overlayRaw);
    expect(() =>
      assertLegacyAxIdentityGraphManifestOverlay({ canonical, overlay }),
    ).not.toThrow();

    const mutations: Array<(copy: typeof raw) => void> = [
      (copy) => {
        copy.files.sharedUuidLedger!.relativePath = "resources/replacement.csv";
      },
      (copy) => {
        copy.files.sharedUuidLedger!.sha256 = "0".repeat(64);
      },
      (copy) => {
        copy.files.sharedUuidLedger!.rowCount += 1;
      },
      (copy) => {
        copy.tier1SourceProfiles.jp = "wrong-active-profile";
      },
      (copy) => {
        const [component, mapping] = Object.entries(copy.tier2Components)[0]!;
        delete copy.tier2Components[component];
        copy.tier2Components[`${component}-replacement`] = mapping;
      },
      (copy) => {
        copy.tier2Components[Object.keys(copy.tier2Components)[0]!]!.expectedRowCount += 1;
      },
      (copy) => {
        copy.expected.pgacCount += 1;
      },
    ];

    for (const mutate of mutations) {
      const copy = structuredClone(raw);
      mutate(copy);
      expect(() =>
        assertLegacyAxIdentityGraphManifestOverlay({
          canonical,
          overlay: parseLegacyAxIdentityGraphManifest(copy),
        }),
      ).toThrow("may change only Tier 2 profileKey values");
    }

    const selfAuthorizedTranslation = structuredClone(raw) as unknown as {
      bindingTranslation: Record<string, unknown>;
    };
    selfAuthorizedTranslation.bindingTranslation.status = "verified";
    selfAuthorizedTranslation.bindingTranslation.relativePath = "unreviewed/translation.csv";
    selfAuthorizedTranslation.bindingTranslation.sha256 = "1".repeat(64);
    expect(() => parseLegacyAxIdentityGraphManifest(selfAuthorizedTranslation)).toThrow(
      "must remain blocked",
    );
  });
});
