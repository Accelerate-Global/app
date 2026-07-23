import { describe, expect, it } from "vitest";

import {
  requireDatasetFormingResourceBindings,
  resolveDatasetFormingResourceBindings,
  type DatasetFormingCatalogResource,
} from "./resources";
import type { DatasetFormingResourceRequirement } from "./types";

const requirements: DatasetFormingResourceRequirement[] = [
  {
    bindingType: "catalog",
    key: "countries",
    expectedKind: "country-geography",
    compatibleSchemaVersions: [1],
    required: true,
  },
  {
    bindingType: "code",
    key: "field-contract",
    contractType: "field-contract",
    schemaVersion: 1,
    version: "1",
    checksum: "b".repeat(64),
    required: true,
  },
];

const countryResource: DatasetFormingCatalogResource = {
  key: "countries",
  kind: "country-geography",
  resourceId: "country-resource",
  versionId: "country-version-2",
  version: 2,
  schemaVersion: 1,
  checksum: "a".repeat(64),
  lifecycleState: "valid",
};

const resourceSet = { id: "resource-set-2", checksum: "c".repeat(64) };

describe("dataset forming resource bindings", () => {
  it("resolves catalog and code bindings in declaration order", () => {
    const resolution = resolveDatasetFormingResourceBindings({
      requirements,
      resourceSet,
      catalogResources: [countryResource],
    });

    expect(resolution).toEqual({
      valid: true,
      issues: [],
      bindings: [
        {
          position: 0,
          key: "countries",
          bindingType: "catalog",
          required: true,
          kind: "country-geography",
          schemaVersion: 1,
          version: "2",
          checksum: "a".repeat(64),
          resourceSetId: "resource-set-2",
          resourceSetChecksum: "c".repeat(64),
          resourceId: "country-resource",
          resourceVersionId: "country-version-2",
        },
        {
          position: 1,
          key: "field-contract",
          bindingType: "code",
          required: true,
          kind: "field-contract",
          schemaVersion: 1,
          version: "1",
          checksum: "b".repeat(64),
          resourceSetId: null,
          resourceSetChecksum: null,
          resourceId: null,
          resourceVersionId: null,
        },
      ],
    });
  });

  it("fails closed for missing and ambiguous catalog dependencies", () => {
    const missing = resolveDatasetFormingResourceBindings({
      requirements,
      resourceSet,
      catalogResources: [],
    });
    expect(missing.valid).toBe(false);
    expect(missing.issues).toContainEqual(
      expect.objectContaining({ code: "missing-resource", key: "countries" }),
    );

    const ambiguous = resolveDatasetFormingResourceBindings({
      requirements,
      resourceSet,
      catalogResources: [
        countryResource,
        { ...countryResource, versionId: "country-version-3", version: 3 },
      ],
    });
    expect(ambiguous.valid).toBe(false);
    expect(ambiguous.issues).toContainEqual(
      expect.objectContaining({ code: "ambiguous-resource", key: "countries" }),
    );
  });

  it.each([
    [
      "invalid-resource",
      { ...countryResource, lifecycleState: "invalid" },
    ],
    [
      "incompatible-resource-kind",
      { ...countryResource, kind: "other" },
    ],
    [
      "incompatible-resource-schema",
      { ...countryResource, schemaVersion: 2 },
    ],
    [
      "invalid-resource-checksum",
      { ...countryResource, checksum: null },
    ],
  ])("reports %s without substituting another version", (code, resource) => {
    const resolution = resolveDatasetFormingResourceBindings({
      requirements,
      resourceSet,
      catalogResources: [resource],
    });
    expect(resolution.valid).toBe(false);
    expect(resolution.issues).toContainEqual(
      expect.objectContaining({ code, key: "countries" }),
    );
  });

  it("rejects invalid code contracts and exposes structured issues", () => {
    const invalidRequirements: DatasetFormingResourceRequirement[] = [
      {
        bindingType: "code",
        key: "field-contract",
        contractType: "field-contract",
        schemaVersion: 1,
        version: "1",
        checksum: "missing",
        required: true,
      },
    ];
    const resolution = resolveDatasetFormingResourceBindings({
      requirements: invalidRequirements,
      resourceSet: null,
      catalogResources: [],
    });
    expect(resolution.valid).toBe(false);
    expect(resolution.issues[0]).toEqual(
      expect.objectContaining({ code: "invalid-code-contract" }),
    );
    expect(() =>
      requireDatasetFormingResourceBindings({
        requirements: invalidRequirements,
        resourceSet: null,
        catalogResources: [],
      }),
    ).toThrow("does not satisfy");
  });
});
