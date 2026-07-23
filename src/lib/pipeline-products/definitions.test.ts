import { describe, expect, it } from "vitest";

import {
  checksumPipelineProductDefinition,
  getPipelineDefinition,
  listPipelineDefinitions,
  runPipelineDefinition,
} from "./definitions";

const EXPECTED_DEFINITION_CHECKSUMS = {
  "tier1-pgic-merge": "732a52ce030ead236c08c2a6810dd54129fb31b2fe0253072fa5177b22097b38",
  "tier1-specific-pg-merge": "8e7dd1be61ff2071e69ba6c5cf30b9a277ee39f25ed3a7b5351a6311eff2fe62",
  "aggregate1-pgac": "a00034897ce331f06ca97ff548fdf68e77cf04ce3add01cdcd67303be1da4091",
  "aggregate1-self-engaged": "6fd44c3c6dbcdbd8b244c7a2257acf15e27a23b77cee02006820df29d8666c01",
  "aggregate1-watchlist": "d00121d043431fe0554a9d825ab50076e67f55977e9b3cb2227ad0c2d7524c63",
  "aggregate1-baseline-uupg": "db0c9db072c5758f812973493f698b1df84f7c5250206c174112a13000862182",
  "aggregate1-hotspots": "f55f6692f1c15347165a0e2bf63a480d923719741de319674a8985e76b1d5b71",
  "aggregate1-south-asia": "f638957b5fbaefde243198f2389325c25a322931ef85331516c44e7bde828d59",
} as const;

describe("pipeline product definitions", () => {
  it("registers every Tier 1 and Aggregate 1 product with immutable checksums", () => {
    const definitions = listPipelineDefinitions();
    expect(definitions.map((definition) => definition.key)).toEqual([
      "tier1-pgic-merge",
      "tier1-specific-pg-merge",
      "aggregate1-pgac",
      "aggregate1-self-engaged",
      "aggregate1-watchlist",
      "aggregate1-baseline-uupg",
      "aggregate1-hotspots",
      "aggregate1-south-asia",
    ]);
    expect(definitions.every((definition) => /^[0-9a-f]{64}$/u.test(definition.checksum))).toBe(true);
    expect(definitions.every((definition) => definition.isWorkspaceVisible)).toBe(true);
    expect(Object.fromEntries(definitions.map((definition) => [definition.key, definition.checksum])))
      .toEqual(EXPECTED_DEFINITION_CHECKSUMS);
    expect(Object.isFrozen(definitions[0])).toBe(true);
  });

  it("changes the definition checksum when an executable semantic rule changes", () => {
    const definition = getPipelineDefinition("aggregate1-hotspots");
    const changed = checksumPipelineProductDefinition({
      ...definition,
      semanticContract: {
        ...definition.semanticContract,
        countryLimit: 11,
      },
    });
    expect(definition.semanticContract).toMatchObject({
      version: "aggregate1-hotspots-semantics-v1",
      countryLimit: 10,
      externalBindings: ["aggregate1-baseline-uupg"],
    });
    expect(changed).not.toBe(definition.checksum);
  });

  it("changes the definition checksum when consumer visibility changes", () => {
    const definition = getPipelineDefinition("aggregate1-pgac");
    expect(checksumPipelineProductDefinition({
      ...definition,
      isWorkspaceVisible: false,
    })).not.toBe(definition.checksum);
  });

  it("fails closed for an unknown definition", () => {
    expect(() => getPipelineDefinition("unknown")).toThrow("Unknown pipeline definition");
  });

  it("requires the complete Tier 1 input shape at the lifecycle boundary", () => {
    expect(getPipelineDefinition("tier1-pgic-merge").requiredInputKeys).toEqual(["ax", "etno", "imb", "jp", "wcd"]);
  });

  it("executes a named child from one exact parent", () => {
    const result = runPipelineDefinition("aggregate1-south-asia", {
      inputs: [{
        inputKey: "aggregate1-pgac",
        publicationId: "pub-1",
        outputChecksum: "a".repeat(64),
        rowCount: 2,
        registryRevisionId: "revision-1",
        rows: [{ Geo_Country_Name: "India" }, { Geo_Country_Name: "Thailand" }],
      }],
      priorities: [],
    });
    expect(result.rows).toEqual([{ Geo_Country_Name: "India" }]);
  });
});
