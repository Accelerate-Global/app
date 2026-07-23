import { describe, expect, it } from "vitest";

import {
  assertCompleteBackfillInputs,
  assertExactBackfillInputs,
  assertPipelineJsonObject,
  fingerprintPipelineInputs,
} from "./validation";
import { requirePipelineFlowDefinition } from "./registry";

describe("pipeline operation input validation", () => {
  it("fingerprints semantically identical objects deterministically", () => {
    expect(fingerprintPipelineInputs({ b: 2, a: { d: 4, c: 3 } })).toBe(
      fingerprintPipelineInputs({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });

  it("accepts exact historical UUID identifiers", () => {
    expect(() =>
      assertExactBackfillInputs({
        sourceRunId: "10000000-0000-4000-8000-000000000001",
        resourceVersionIds: ["10000000-0000-4000-8000-000000000002"],
      }),
    ).not.toThrow();
  });

  it("accepts nested Tier 2 member identities only with exact checksums", () => {
    expect(() =>
      assertExactBackfillInputs({
        tier2Members: [{
          inputKey: "partner",
          publicationId: "10000000-0000-4000-8000-000000000003",
          expectedChecksum: "a".repeat(64),
        }],
        aggregate2Members: [{
          inputKey: "tier2",
          publicationId: "10000000-0000-4000-8000-000000000004",
          expectedChecksum: "b".repeat(64),
        }],
      }),
    ).not.toThrow();
    expect(() =>
      assertExactBackfillInputs({
        tier2Members: [{
          inputKey: "partner",
          publicationId: "10000000-0000-4000-8000-000000000003",
          expectedChecksum: "not-a-checksum",
        }],
      }),
    ).toThrow("SHA-256");
  });

  it("rejects empty, current/latest, non-ID, and malformed backfill inputs", () => {
    expect(() => assertExactBackfillInputs({})).toThrow("at least one exact");
    expect(() => assertExactBackfillInputs({ resourceVersionId: "latest" })).toThrow(
      "cannot resolve",
    );
    expect(() => assertExactBackfillInputs({ resource: "10000000-0000-4000-8000-000000000001" })).toThrow(
      "identifier field",
    );
    expect(() => assertExactBackfillInputs({ sourceRunId: "not-a-uuid" })).toThrow(
      "UUID",
    );
  });

  it("requires a JSON object", () => {
    expect(() => assertPipelineJsonObject([])).toThrow("JSON object");
    expect(() => assertPipelineJsonObject({ sourceRunId: "id" })).not.toThrow();
  });

  it("requires a generic source backfill to pin the complete replay inputs", () => {
    const definition = requirePipelineFlowDefinition("source-imb-people-groups");
    const sourceRunId = "10000000-0000-4000-8000-000000000001";
    const connectionId = "10000000-0000-4000-8000-000000000002";
    const resourceSetId = "10000000-0000-4000-8000-000000000003";
    const resourceVersionId = "10000000-0000-4000-8000-000000000004";
    const exactInputs = {
      sourceRunId,
      sourceChecksum: "a".repeat(64),
      connectionIds: { "imb-people-groups": connectionId },
      sourceProfileBindings: {
        "imb-people-groups": {
          connectionId,
          checksum: "b".repeat(64),
        },
      },
      sourceExecutionBindings: {
        "imb-people-groups": {
          connectionId,
          configChecksum: "c".repeat(64),
          adapterChecksum: "d".repeat(64),
          checksum: "e".repeat(64),
        },
      },
      resourceSetId,
      resourceSetChecksum: "f".repeat(64),
      formingPublicationIds: {
        "imb-people-groups": null,
      },
      referenceVersionBindings: {
        "country-territory-codes": {
          resourceKey: "country-territory-codes",
          versionId: resourceVersionId,
          checksum: "1".repeat(64),
          versionNumber: 1,
          schemaVersion: 1,
        },
        "rop-codes": {
          resourceKey: "rop-codes",
          versionId: "10000000-0000-4000-8000-000000000005",
          checksum: "2".repeat(64),
          versionNumber: 1,
          schemaVersion: 1,
        },
        "source-aliases": {
          resourceKey: "source-aliases",
          versionId: "10000000-0000-4000-8000-000000000006",
          checksum: "3".repeat(64),
          versionNumber: 1,
          schemaVersion: 1,
        },
      },
    };

    expect(() => assertExactBackfillInputs(exactInputs)).not.toThrow();
    expect(() => assertCompleteBackfillInputs(definition, exactInputs)).not.toThrow();
    expect(() =>
      assertCompleteBackfillInputs(definition, {
        ...exactInputs,
        sourceChecksum: undefined,
      })
    ).toThrow("archived source checksum");
    expect(() =>
      assertCompleteBackfillInputs(definition, {
        ...exactInputs,
        sourceExecutionBindings: {},
      })
    ).toThrow("source execution contract");
    expect(() =>
      assertCompleteBackfillInputs(definition, {
        ...exactInputs,
        formingPublicationIds: {},
      })
    ).toThrow("prior forming publication pin");
    expect(() =>
      assertCompleteBackfillInputs(definition, {
        ...exactInputs,
        referenceVersionBindings: {
          "country-territory-codes":
            exactInputs.referenceVersionBindings["country-territory-codes"],
        },
      })
    ).toThrow("rop-codes");
    expect(() =>
      assertCompleteBackfillInputs(definition, {
        ...exactInputs,
        referenceVersionBindings: {
          ...exactInputs.referenceVersionBindings,
          "rop-codes": {
            ...exactInputs.referenceVersionBindings["rop-codes"],
            checksum: "forged",
          },
        },
      })
    ).toThrow("incomplete or malformed");
  });

  it("accepts null as an exact empty stable-target pointer", () => {
    expect(() =>
      assertExactBackfillInputs({
        tier1ExpectedCurrentPublicationIds: {
          "tier1-pgic-merge": null,
        },
      })
    ).toThrow("at least one exact historical input identifier");
    expect(() =>
      assertExactBackfillInputs({
        sourceRunId: "10000000-0000-4000-8000-000000000001",
        tier1ExpectedCurrentPublicationIds: {
          "tier1-pgic-merge": null,
        },
      })
    ).not.toThrow();
  });

  it("requires both Tier 2 launch target pins and preserves an explicit null target", () => {
    const definition = requirePipelineFlowDefinition("tier2-release");
    const launchPublicationId = "10000000-0000-4000-8000-000000000009";
    const exactInputs = {
      tier2ExpectedCurrentPublicationIds: {
        tier2: launchPublicationId,
        aggregate2: null,
      },
    };

    expect(() => assertExactBackfillInputs(exactInputs)).not.toThrow();
    expect(() =>
      assertCompleteBackfillInputs(definition, exactInputs)
    ).not.toThrow();
    expect(() =>
      assertCompleteBackfillInputs(definition, {
        tier2ExpectedCurrentPublicationIds: {
          tier2: launchPublicationId,
        },
      })
    ).toThrow("stable-target pin for aggregate2");
    expect(() =>
      assertCompleteBackfillInputs(definition, {
        tier2ExpectedCurrentPublicationIds: {
          tier2: "current",
          aggregate2: null,
        },
      })
    ).toThrow("invalid stable-target pin for tier2");
  });
});
