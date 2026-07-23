import { describe, expect, it } from "vitest";

import { createDatasetFormingEngineRegistry } from "./registry";
import type { DatasetFormingEngine } from "./types";

function engine(
  engineKey: string,
  sourceProfileKeys: string[],
): DatasetFormingEngine<Record<never, never>> {
  return {
    engineKey,
    displayName: engineKey,
    sourceProfileKeys,
    version: `${engineKey}-v1`,
    checksum: "a".repeat(64),
    artifactSchemaVersion: 1,
    publicationTargetKey: `${engineKey}-dataset`,
    resourceRequirements: [],
    form() {
      return {
        columns: [],
        rows: [],
        findings: [],
        validation: { warningCount: 0, errorCount: 0 },
        outputChecksum: "b".repeat(64),
        valid: true,
      };
    },
  };
}

describe("dataset forming engine registry", () => {
  it("resolves a supported source profile and engine key", () => {
    const registered = engine("source-a", ["profile-a"]);
    const registry = createDatasetFormingEngineRegistry([registered]);

    expect(registry.requireBySourceProfile("profile-a")).toBe(registered);
    expect(registry.getByEngineKey("source-a")).toBe(registered);
  });

  it("fails closed for unsupported and ambiguous source profiles", () => {
    const registry = createDatasetFormingEngineRegistry([
      engine("source-a", ["shared-profile"]),
      engine("source-b", ["shared-profile"]),
    ]);

    expect(() => registry.requireBySourceProfile("unknown")).toThrow(
      "No dataset forming engine",
    );
    expect(registry.resolveBySourceProfile("shared-profile")).toEqual({
      status: "ambiguous",
      sourceProfileKey: "shared-profile",
      engineKeys: ["source-a", "source-b"],
    });
    expect(() => registry.requireBySourceProfile("shared-profile")).toThrow(
      "more than one",
    );
  });

  it("rejects duplicate engine keys and incomplete declarations", () => {
    expect(() =>
      createDatasetFormingEngineRegistry([
        engine("duplicate", ["profile-a"]),
        engine("duplicate", ["profile-b"]),
      ]),
    ).toThrow("registered more than once");

    expect(() =>
      createDatasetFormingEngineRegistry([
        { ...engine("bad", ["profile"]), checksum: "not-a-checksum" },
      ]),
    ).toThrow("invalid checksum");
  });
});
