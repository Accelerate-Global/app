import { describe, expect, it, vi } from "vitest";

import {
  buildArtifactPrunePlan,
  executeArtifactPrune,
  parseArtifactPruneArgs,
} from "./prune-reference-resource-artifacts";

const options = {
  resourceKey: "retired-resource",
  expectedKind: "retired-kind",
  prefix: "reference-resources/retired-resource",
  apply: false,
  local: false,
};

function dependencies(actualPaths = [
  "reference-resources/retired-resource/version-a/a.json",
  "reference-resources/retired-resource/version-a/b.json",
]) {
  return {
    loadResource: vi.fn(async () => ({
      kind: "retired-kind",
      manifests: [{
        normalized: "reference-resources/retired-resource/version-a/a.json",
        metadata: "reference-resources/retired-resource/version-a/b.json",
      }],
    })),
    listPaths: vi.fn(async () => actualPaths),
    removePaths: vi.fn(async () => undefined),
  };
}

describe("reference-resource artifact pruning", () => {
  it("is dry-run by default and requires an exact resource, kind, and prefix", () => {
    expect(parseArtifactPruneArgs([
      "--resource-key", "retired-resource",
      "--expected-kind", "retired-kind",
      "--prefix", "/reference-resources/retired-resource/",
    ])).toEqual(options);
  });

  it("builds a plan only when the manifests exactly match Storage", async () => {
    const plan = await buildArtifactPrunePlan(options, dependencies());
    expect(plan.paths).toHaveLength(2);
    expect(plan.prefix).toBe(options.prefix);
  });

  it.each([
    ["kind drift", { expectedKind: "other" }, dependencies()],
    ["prefix escape", { prefix: "reference-resources/other" }, dependencies()],
    ["missing object", {}, dependencies([
      "reference-resources/retired-resource/version-a/a.json",
    ])],
    ["unexpected object", {}, dependencies([
      "reference-resources/retired-resource/version-a/a.json",
      "reference-resources/retired-resource/version-a/b.json",
      "reference-resources/retired-resource/version-a/untracked.json",
    ])],
  ])("rejects %s", async (_label, optionOverrides, deps) => {
    await expect(buildArtifactPrunePlan({ ...options, ...optionOverrides }, deps))
      .rejects.toThrow();
    expect(deps.removePaths).not.toHaveBeenCalled();
  });

  it("does not mutate Storage during a dry run", async () => {
    const deps = dependencies();
    const result = await executeArtifactPrune(options, deps);
    expect(result.mode).toBe("dry-run");
    expect(deps.removePaths).not.toHaveBeenCalled();
  });

  it("removes only planned paths and proves the prefix is empty", async () => {
    const deps = dependencies();
    deps.listPaths
      .mockResolvedValueOnce([
        "reference-resources/retired-resource/version-a/a.json",
        "reference-resources/retired-resource/version-a/b.json",
      ])
      .mockResolvedValueOnce([]);

    const result = await executeArtifactPrune({ ...options, apply: true }, deps);
    expect(result.mode).toBe("applied");
    expect(deps.removePaths).toHaveBeenCalledWith(result.plan.paths);
  });

  it("fails if anything remains after deletion", async () => {
    const deps = dependencies();
    deps.listPaths.mockResolvedValueOnce([
      "reference-resources/retired-resource/version-a/a.json",
      "reference-resources/retired-resource/version-a/b.json",
    ])
      .mockResolvedValueOnce([
        "reference-resources/retired-resource/version-a/a.json",
      ]);
    await expect(executeArtifactPrune({ ...options, apply: true }, deps))
      .rejects.toThrow("verification failed");
  });
});
