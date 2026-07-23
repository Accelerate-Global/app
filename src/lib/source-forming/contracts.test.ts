import { describe, expect, it } from "vitest";

import { createDatasetFormingEngineRegistry } from "@/lib/dataset-forming/registry";

import {
  ACCELERATE_FORMING_ENGINE,
  ETNOPEDIA_FORMING_ENGINE,
  JOSHUA_PROJECT_FORMING_ENGINE,
  TIER1_SOURCE_FORMING_ENGINES,
  WCD_FORMING_ENGINE,
} from "./adapters";
import {
  ACCELERATE_SOURCE_CONTRACT,
  ETNOPEDIA_SOURCE_CONTRACT,
  JOSHUA_PROJECT_SOURCE_CONTRACT,
  SOURCE_FORMING_CONTRACTS,
  TIER1_SOURCE_CODE_CONTRACTS,
  WCD_SOURCE_CONTRACT,
} from "./contracts";
import {
  SOURCE_FORMING_COUNTRIES,
  SOURCE_FORMING_JP_CROSSWALK,
  SOURCE_FORMING_ROP_ENTRIES,
  sourceRows,
} from "./fixtures";

describe("versioned Tier 1 source contracts", () => {
  it("locks reviewed field, type, and transformation checksums for all five sources", () => {
    expect(TIER1_SOURCE_CODE_CONTRACTS).toEqual({
      etnopedia: {
        fieldContractChecksum:
          "b00229b56e35ac28bda6b16bb01080dea55564f72031d169b473b631a04d3ef2",
        typeContractChecksum:
          "6fa9e55c230900e8aa0229aca24a35a9f11e43202f43f7b2b1d7b6cd577f9591",
        transformationChecksum:
          "95689059195fef0a0b5b6b8a08abda05b5717dd353fdeae89557d2e438638f16",
      },
      joshuaProject: {
        fieldContractChecksum:
          "a997497bb0030b6edbee0ea11deaaaf455fc1f34e07e07fbe0b80750525814f4",
        typeContractChecksum:
          "da87c8aff0ae4d5e10fb1c03314f6a9513a2e9e92ff44745f4ce436052893d15",
        transformationChecksum:
          "0ce63656b7081ce8b0a8a1e54ad256d5dbb380c1cffd1357eefd864f9bf235f3",
      },
      wcd: {
        fieldContractChecksum:
          "41a6106f31bdccbf7fe7c641584d709a438d44834d2590225445bff27726a930",
        typeContractChecksum:
          "a70a70969e27962d873aa9d85e67b505eabb63e6315799f372baf47f2fee21ce",
        transformationChecksum:
          "f80e4fb4fd0415de92d42501bb8b61ed68e17a32f1d1e27d61ce0e65f8d02676",
      },
      accelerate: {
        fieldContractChecksum:
          "66cd0f7e8b35ececb31bbd8e6119a9b6fc662a088bfead0a6c20c29ec2382ac4",
        typeContractChecksum:
          "ef13f9c5f8ecdc05fccd59878e446c7d38f1a126bec2a0365d21c99be0b8062a",
        transformationChecksum:
          "31b12ca8c748249966ed4094d487989272c16dab850d50a50b7b307f8dd5e656",
      },
      imb: {
        fieldContractVersion: "2",
        transformationVersion: "imb-forming-v2",
        fieldContractChecksum:
          "713b72993eafa9cc0cc9b3d5a409636090a35904f24348d13b616a5c69f642aa",
        typeContractChecksum:
          "c72241f1c2103b57c81ec3a37dd08f990271b856dfcb04139064fbc4ea7ea63e",
        transformationChecksum:
          "4c3c76ab0da1936ae2371cfffa88c7fce30647d8febe097039e51316036d948f",
      },
    });
  });

  it("keeps contracts recursively immutable and output fields unique", () => {
    expect(Object.isFrozen(SOURCE_FORMING_CONTRACTS)).toBe(true);
    for (const contract of SOURCE_FORMING_CONTRACTS) {
      expect(Object.isFrozen(contract)).toBe(true);
      expect(Object.isFrozen(contract.fields)).toBe(true);
      expect(new Set(contract.fields.map((field) => field.outputField)).size).toBe(
        contract.fields.length,
      );
    }
  });

  it("copies active legacy mappings and keeps source AX identity non-authoritative", () => {
    expect(
      ETNOPEDIA_SOURCE_CONTRACT.fields.find(
        (field) => field.sourceField === "title",
      )?.outputField,
    ).toBe("PG_Name_Main");
    expect(
      JOSHUA_PROJECT_SOURCE_CONTRACT.fields.find(
        (field) => field.sourceField === "PeopleID3",
      )?.outputField,
    ).toBe("PG_PeopleID3");
    expect(
      WCD_SOURCE_CONTRACT.fields.find(
        (field) => field.sourceField === "ROP People code",
      )?.outputField,
    ).toBe("PG_ROP3");
    expect(
      ACCELERATE_SOURCE_CONTRACT.fields.find(
        (field) => field.sourceField === "In-country Engagement Timestamp (DateTime)",
      ),
    ).toMatchObject({
      outputField: "Engage_Timestamp_of_Changes",
      type: "datetime",
    });
    expect(
      ACCELERATE_SOURCE_CONTRACT.fields.filter((field) =>
        ["Data_Source", "Dataset_ID", "Dataset_Row_ID", "Dataset_Row_Key"].includes(
          field.outputField,
        ),
      ),
    ).toEqual([
      { sourceField: null, outputField: "Data_Source", type: "identifier", requiredSourceColumn: false },
      { sourceField: null, outputField: "Dataset_ID", type: "identifier", requiredSourceColumn: false },
      { sourceField: null, outputField: "Dataset_Row_ID", type: "identifier", requiredSourceColumn: false },
      { sourceField: null, outputField: "Dataset_Row_Key", type: "identifier", requiredSourceColumn: false },
    ]);
  });
});

describe("Tier 1 source engine adapter surface", () => {
  it("registers independently by stable source profile with immutable requirements", () => {
    const registry = createDatasetFormingEngineRegistry(
      TIER1_SOURCE_FORMING_ENGINES,
    );
    expect(registry.list().map((engine) => engine.engineKey)).toEqual([
      "etnopedia",
      "joshua-project",
      "wcd",
      "accelerate",
    ]);
    for (const engine of registry.list()) {
      expect(engine.checksum).toMatch(/^[a-f0-9]{64}$/u);
      expect(engine.artifactSchemaVersion).toBe(1);
      const requirementKeys = engine.resourceRequirements.map(
        (requirement) => requirement.key,
      );
      expect(requirementKeys).toEqual([
        "country-territory-codes",
        "rop-codes",
        ...(engine.engineKey === "joshua-project" ? ["jp-peopleid3"] : []),
        "source-aliases",
        expect.stringMatching(/-field-contract$/u),
        expect.stringMatching(/-type-contract$/u),
        expect.stringMatching(/-transformation-contract$/u),
      ]);
      expect(
        engine.resourceRequirements.find(
          (requirement) => requirement.key === "source-aliases",
        ),
      ).toMatchObject({
        bindingType: "catalog",
        expectedKind: "source-registry",
        compatibleSchemaVersions: [1],
        required: true,
      });
      expect(
        engine.resourceRequirements.filter(
          (requirement) => requirement.bindingType === "code",
        ),
      ).toEqual([
        expect.objectContaining({ contractType: "field-contract" }),
        expect.objectContaining({ contractType: "type-contract" }),
        expect.objectContaining({ contractType: "transformation-contract" }),
      ]);
    }
    expect(
      JOSHUA_PROJECT_FORMING_ENGINE.resourceRequirements.find(
        (requirement) => requirement.key === "jp-peopleid3",
      ),
    ).toMatchObject({
      bindingType: "catalog",
      expectedKind: "people-crosswalk",
      compatibleSchemaVersions: [1],
      required: true,
    });
  });

  it("adapts the generic forming context without persistence dependencies", () => {
    const source = sourceRows([
      { pageid: "5", title: "Alpha", countries: "US", rop3: "100001" },
    ]);
    const result = ETNOPEDIA_FORMING_ENGINE.form({
      connectionId: "connection",
      sourceProfileKey: "etnopedia-people-groups",
      sourceRunId: "run",
      sourceArtifacts: { rowsChecksum: "a".repeat(64), rawChecksum: "b".repeat(64) },
      resourceBindings: [],
      resources: {
        countries: SOURCE_FORMING_COUNTRIES,
        ropEntries: SOURCE_FORMING_ROP_ENTRIES,
        jpPeopleId3Entries: SOURCE_FORMING_JP_CROSSWALK,
      },
      ...source,
    });
    expect(result.valid).toBe(true);
    expect(result.rows).toHaveLength(1);
  });

  it("exposes one adapter for each independently integrated source class", () => {
    expect([
      ETNOPEDIA_FORMING_ENGINE.displayName,
      JOSHUA_PROJECT_FORMING_ENGINE.displayName,
      WCD_FORMING_ENGINE.displayName,
      ACCELERATE_FORMING_ENGINE.displayName,
    ]).toEqual([
      "Etnopedia forming",
      "Joshua Project forming",
      "World Christian Database forming",
      "Accelerate-owned forming",
    ]);
  });
});
