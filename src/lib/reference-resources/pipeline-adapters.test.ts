import { describe, expect, it } from "vitest";

import engagementFixture from "./fixtures/engagement-mappings.sanitized.json";
import peopleId3Fixture from "./fixtures/jp-peopleid3.sanitized.json";
import peidFixture from "./fixtures/peid.sanitized.json";
import sourceAliasesFixture from "./fixtures/source-aliases.sanitized.json";
import prioritiesFixture from "./fixtures/tier1-merge-priorities.sanitized.json";
import {
  PIPELINE_CODE_CONTRACT_REGISTRY,
  PipelineResourceValidationError,
  canonicalizePipelineResource,
  createPipelineCodeContract,
  createPipelineCodeContractRegistry,
  preparePipelineResource,
  validatePipelineResource,
} from "./pipeline-adapters";
import {
  ENGAGEMENT_MAPPINGS_RESOURCE_KEY,
  JP_PEOPLE_ID3_RESOURCE_KEY,
  PEID_RESOURCE_KEY,
  SOURCE_ALIASES_RESOURCE_KEY,
  TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
} from "./pipeline-types";

const referenceContext = {
  knownSourceKeys: new Set(["jp", "im"]),
  activeSourceKeys: new Set(["jp", "im"]),
  knownRop3Codes: new Set(["100001", "100004"]),
  knownRop1Codes: new Set(["A013", "A010"]),
  knownIso3Codes: new Set(["AGO", "PNG"]),
};

describe("pipeline reference resource adapters", () => {
  it("prepares every sanitized resource family as a typed immutable package", () => {
    const aliases = preparePipelineResource(
      SOURCE_ALIASES_RESOURCE_KEY,
      sourceAliasesFixture,
    );
    const peopleId3 = preparePipelineResource(
      JP_PEOPLE_ID3_RESOURCE_KEY,
      peopleId3Fixture,
      referenceContext,
    );
    const peid = preparePipelineResource(
      PEID_RESOURCE_KEY,
      peidFixture,
      referenceContext,
    );
    const priorities = preparePipelineResource(
      TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
      prioritiesFixture,
      referenceContext,
    );
    const engagement = preparePipelineResource(
      ENGAGEMENT_MAPPINGS_RESOURCE_KEY,
      engagementFixture,
    );

    expect(aliases.entries.map((entry) => entry.stableKey)).toEqual([
      "source:im",
      "source:jp",
    ]);
    expect(peopleId3.entries[0]).toMatchObject({
      stableKey: "peopleid3:900001",
      rop3: "100001",
    });
    expect(peid.entries[0]).toMatchObject({
      stableKey: "peid:800001",
      rop1: "A013",
    });
    expect(priorities.entries[0].stableKey).toBe(
      "tier1-priority:Christianity_GSEC",
    );
    expect(engagement.entries[0].stableKey).toBe(
      "engagement-field:reporting_group",
    );
    for (const resource of [aliases, peopleId3, peid, priorities, engagement]) {
      expect(resource.valid).toBe(true);
      expect(resource.contentChecksum).toMatch(/^[a-f0-9]{64}$/u);
      expect(resource.entryCount).toBe(2);
      expect(Object.isFrozen(resource)).toBe(true);
      expect(Object.isFrozen(resource.entries)).toBe(true);
      expect(Object.isFrozen(resource.entries[0])).toBe(true);
      expect(resource.csv.endsWith("\n")).toBe(true);
    }
    expect({
      aliases: aliases.contentChecksum,
      peopleId3: peopleId3.contentChecksum,
      peid: peid.contentChecksum,
      priorities: priorities.contentChecksum,
      engagement: engagement.contentChecksum,
    }).toEqual({
      aliases: "0890ff62746ee4e7a2f4e64b4e942e77b0f435064917bebf66a6df77d1887a5e",
      peopleId3: "c8fd875d1229f57fe07be6528ec267a7315b15d89b6669a8225b0d8928bf2562",
      peid: "0a6d619a32682df206e50f0970a80baa4239611fdcc3cdb8a9184544df343ef2",
      priorities: "f5e95801880b7a5fabbb16e2154a845e163b0c073fec61a7c0a894f0fc00f43d",
      engagement: "bcb23dacc5c73dab0a2fa190ccb154b35a8476112b2b9e9943d560546d612355",
    });
  });

  it("produces row-order-independent checksums and deterministic CSV", () => {
    const first = preparePipelineResource(
      SOURCE_ALIASES_RESOURCE_KEY,
      sourceAliasesFixture,
    );
    const second = preparePipelineResource(SOURCE_ALIASES_RESOURCE_KEY, {
      entries: [...sourceAliasesFixture.entries].reverse(),
      sourceRetrievedAt: "2026-02-02T00:00:00.000Z",
      sourceName: "A later retrieval of identical content",
      schemaVersion: 1,
      resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
    });

    expect(second.contentChecksum).toBe(first.contentChecksum);
    expect(second.csv).toBe(first.csv);
    expect(canonicalizePipelineResource(second)).toBe(
      canonicalizePipelineResource(first),
    );
    expect(first.csv).toContain(
      "source:im,F_3,im,Example Registry Source,im,example registry; im sample,TRUE",
    );
  });

  it("rejects incompatible schemas and malformed identifiers", () => {
    const schema = validatePipelineResource(SOURCE_ALIASES_RESOURCE_KEY, {
      ...sourceAliasesFixture,
      schemaVersion: 2,
    });
    const identifier = validatePipelineResource(JP_PEOPLE_ID3_RESOURCE_KEY, {
      ...peopleId3Fixture,
      entries: [
        {
          ...peopleId3Fixture.entries[0],
          peopleId3: "not-an-id",
        },
      ],
    });

    expect(schema.valid).toBe(false);
    expect(schema.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleCode: "invalid-resource-schema" }),
      ]),
    );
    expect(identifier.valid).toBe(false);
    expect(identifier.findings[0]).toMatchObject({
      ruleCode: "invalid-resource-schema",
      fieldName: "peopleId3",
    });
    expect(() =>
      preparePipelineResource(SOURCE_ALIASES_RESOURCE_KEY, {
        ...sourceAliasesFixture,
        schemaVersion: 2,
      }),
    ).toThrow(PipelineResourceValidationError);
  });

  it("rejects duplicate canonical keys and ambiguous source aliases", () => {
    const duplicateKey = validatePipelineResource(SOURCE_ALIASES_RESOURCE_KEY, {
      ...sourceAliasesFixture,
      entries: [
        sourceAliasesFixture.entries[0],
        {
          ...sourceAliasesFixture.entries[1],
          canonicalSourceKey: "jp",
        },
      ],
    });
    const ambiguousAlias = validatePipelineResource(
      SOURCE_ALIASES_RESOURCE_KEY,
      {
        ...sourceAliasesFixture,
        entries: [
          sourceAliasesFixture.entries[0],
          {
            ...sourceAliasesFixture.entries[1],
            aliases: ["JP SAMPLE"],
          },
        ],
      },
    );
    const repeatedAlias = validatePipelineResource(
      SOURCE_ALIASES_RESOURCE_KEY,
      {
        ...sourceAliasesFixture,
        entries: [
          {
            ...sourceAliasesFixture.entries[0],
            aliases: ["Repeated", "REPEATED"],
          },
          sourceAliasesFixture.entries[1],
        ],
      },
    );

    expect(duplicateKey.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleCode: "duplicate-source-key" }),
      ]),
    );
    expect(ambiguousAlias.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleCode: "ambiguous-source-alias" }),
      ]),
    );
    expect(repeatedAlias.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleCode: "duplicate-source-alias" }),
      ]),
    );
  });

  it("rejects duplicate and unknown crosswalk relationships", () => {
    const peopleId3 = validatePipelineResource(
      JP_PEOPLE_ID3_RESOURCE_KEY,
      {
        ...peopleId3Fixture,
        entries: [
          peopleId3Fixture.entries[0],
          {
            ...peopleId3Fixture.entries[1],
            peopleId3: peopleId3Fixture.entries[0].peopleId3,
            rop3: "999999",
          },
        ],
      },
      referenceContext,
    );
    const peid = validatePipelineResource(
      PEID_RESOURCE_KEY,
      {
        ...peidFixture,
        entries: [
          {
            ...peidFixture.entries[0],
            rop1: null,
          },
        ],
      },
      referenceContext,
    );

    expect(peopleId3.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleCode: "duplicate-peopleid3" }),
        expect.objectContaining({ ruleCode: "unknown-rop3-reference" }),
      ]),
    );
    expect(peid.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleCode: "missing-rop1-cross-reference" }),
      ]),
    );
  });

  it("keeps explicitly approved bounded missing parents as warnings", () => {
    const result = validatePipelineResource(
      JP_PEOPLE_ID3_RESOURCE_KEY,
      {
        ...peopleId3Fixture,
        entries: [
          {
            ...peopleId3Fixture.entries[0],
            rop3: null,
            parentStatus: "approved-missing",
            missingParentReason: "Source publishes no matching ROP3 parent.",
          },
        ],
      },
      referenceContext,
    );

    expect(result.valid).toBe(true);
    expect(result.resource?.valid).toBe(true);
    expect(result.findings).toEqual([
      expect.objectContaining({
        severity: "warning",
        ruleCode: "approved-bounded-missing-parent",
      }),
    ]);
  });

  it("rejects unapproved or internally inconsistent missing parents", () => {
    const missing = validatePipelineResource(
      JP_PEOPLE_ID3_RESOURCE_KEY,
      {
        ...peopleId3Fixture,
        entries: [
          {
            ...peopleId3Fixture.entries[0],
            rop3: null,
          },
        ],
      },
      referenceContext,
    );
    const falselyApproved = validatePipelineResource(
      JP_PEOPLE_ID3_RESOURCE_KEY,
      {
        ...peopleId3Fixture,
        entries: [
          {
            ...peopleId3Fixture.entries[0],
            parentStatus: "approved-missing",
            missingParentReason: "Review note",
          },
        ],
      },
      referenceContext,
    );

    expect(missing.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleCode: "missing-required-parent" }),
      ]),
    );
    expect(falselyApproved.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleCode: "invalid-approved-missing-parent" }),
      ]),
    );
  });

  it("validates priority source references, activity, and ordering", () => {
    const result = validatePipelineResource(
      TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
      {
        ...prioritiesFixture,
        entries: [
          {
            ...prioritiesFixture.entries[0],
            prioritySourceKeys: ["jp", "unknown", "jp"],
          },
          {
            ...prioritiesFixture.entries[1],
            prioritySourceKeys: [],
          },
        ],
      },
      referenceContext,
    );

    expect(result.valid).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleCode: "unknown-priority-source" }),
        expect.objectContaining({ ruleCode: "duplicate-priority-source" }),
        expect.objectContaining({ ruleCode: "active-priority-has-no-sources" }),
      ]),
    );
  });

  it("validates engagement field keys and active-state invariants", () => {
    const duplicate = validatePipelineResource(
      ENGAGEMENT_MAPPINGS_RESOURCE_KEY,
      {
        ...engagementFixture,
        entries: [
          engagementFixture.entries[0],
          {
            ...engagementFixture.entries[1],
            sourceField: engagementFixture.entries[0].sourceField.toUpperCase(),
          },
        ],
      },
    );
    const inactive = validatePipelineResource(
      ENGAGEMENT_MAPPINGS_RESOURCE_KEY,
      {
        ...engagementFixture,
        entries: engagementFixture.entries.map((entry) => ({
          ...entry,
          active: false,
        })),
      },
    );

    expect(duplicate.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleCode: "duplicate-engagement-source-field",
        }),
      ]),
    );
    expect(inactive.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleCode: "resource-has-no-active-entries" }),
      ]),
    );
  });
});

describe("pipeline code-defined contracts", () => {
  it("registers reviewed field and transformation contracts with immutable checksums", () => {
    expect(PIPELINE_CODE_CONTRACT_REGISTRY.contracts.map((entry) => entry.key)).toEqual([
      "imb-field-contract",
      "imb-forming-transformation",
    ]);
    for (const contract of PIPELINE_CODE_CONTRACT_REGISTRY.contracts) {
      expect(contract.version).toBeTruthy();
      expect(contract.checksum).toMatch(/^[a-f0-9]{64}$/u);
      expect(Object.isFrozen(contract)).toBe(true);
      expect(Object.isFrozen(contract.definition)).toBe(true);
      expect(PIPELINE_CODE_CONTRACT_REGISTRY.get(contract.key)).toBe(contract);
    }
    expect(
      PIPELINE_CODE_CONTRACT_REGISTRY.contracts.map((entry) => entry.checksum),
    ).toEqual([
      "713b72993eafa9cc0cc9b3d5a409636090a35904f24348d13b616a5c69f642aa",
      "4c3c76ab0da1936ae2371cfffa88c7fce30647d8febe097039e51316036d948f",
    ]);
    expect(PIPELINE_CODE_CONTRACT_REGISTRY.get("not-registered")).toBeNull();
  });

  it("canonicalizes definitions and changes the checksum with versioned behavior", () => {
    const first = createPipelineCodeContract({
      key: "sample-field-contract",
      kind: "field-contract",
      version: "1",
      definition: { fields: ["one", "two"], source: "fixture" },
    });
    const reordered = createPipelineCodeContract({
      key: "sample-field-contract",
      kind: "field-contract",
      version: "1",
      definition: { source: "fixture", fields: ["one", "two"] },
    });
    const changed = createPipelineCodeContract({
      key: "sample-field-contract",
      kind: "field-contract",
      version: "2",
      definition: { fields: ["one", "two"], source: "fixture" },
    });

    expect(reordered.checksum).toBe(first.checksum);
    expect(changed.checksum).not.toBe(first.checksum);
    expect(() => createPipelineCodeContractRegistry([first, reordered])).toThrow(
      /registered more than once/u,
    );
  });

  it("rejects unstable keys and versions", () => {
    expect(() =>
      createPipelineCodeContract({
        key: "Not Stable",
        kind: "field-contract",
        version: "1",
        definition: {},
      }),
    ).toThrow(/key/u);
    expect(() =>
      createPipelineCodeContract({
        key: "stable-key",
        kind: "field-contract",
        version: "version with spaces",
        definition: {},
      }),
    ).toThrow(/version/u);
    expect(() =>
      createPipelineCodeContract({
        key: "stable-key",
        kind: "field-contract",
        version: "1",
        definition: {},
        checksum: "not-a-checksum",
      }),
    ).toThrow(/checksum/u);
  });
});
