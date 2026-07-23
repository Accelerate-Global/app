import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { EXACT_LEGACY_PIPELINE_RESOURCE_FILES } from "@/lib/reference-resources/legacy-import";

import {
  exactPipelineCandidateNeedsActivation,
  parsePipelineResourceImportArguments,
  parsePipelineResourceImportManifest,
} from "./import-pipeline-reference-resources";

describe("pipeline reference resource import command", () => {
  it("requires one explicit environment and an explicit AX Data root", () => {
    expect(
      parsePipelineResourceImportArguments([
        "--remote",
        "--ax-data-root",
        "../data",
        "--manifest",
        "pipeline-resources.json",
      ]),
    ).toEqual({
      environment: "remote",
      axDataRoot: "../data",
      manifestPath: "pipeline-resources.json",
    });
    expect(() =>
      parsePipelineResourceImportArguments(["--local", "--remote", "--ax-data-root", "../data"]),
    ).toThrow("exactly one");
    expect(() => parsePipelineResourceImportArguments(["--local"])).toThrow(
      "latest-file discovery is not allowed",
    );
  });

  it("accepts only a complete exact five-resource manifest", () => {
    expect(
      parsePipelineResourceImportManifest({
        resources: EXACT_LEGACY_PIPELINE_RESOURCE_FILES,
      }).resources,
    ).toEqual(EXACT_LEGACY_PIPELINE_RESOURCE_FILES);

    expect(() =>
      parsePipelineResourceImportManifest({
        resources: {
          ...EXACT_LEGACY_PIPELINE_RESOURCE_FILES,
          "source-aliases": {
            ...EXACT_LEGACY_PIPELINE_RESOURCE_FILES["source-aliases"],
            sha256: "not-a-checksum",
          },
        },
      }),
    ).toThrow("source-aliases");
    expect(() =>
      parsePipelineResourceImportManifest({
        resources: {
          ...EXACT_LEGACY_PIPELINE_RESOURCE_FILES,
          unexpected: {
            resourceKey: "unexpected",
            relativePath: "resource.csv",
            sha256: "a".repeat(64),
            sourceRetrievedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      }),
    ).toThrow("unsupported resources");
  });

  it("is idempotent when the exact candidate is already active", () => {
    expect(exactPipelineCandidateNeedsActivation("version-1", "version-1")).toBe(false);
    expect(exactPipelineCandidateNeedsActivation(null, "version-1")).toBe(true);
    expect(exactPipelineCandidateNeedsActivation("version-1", "version-2")).toBe(true);
  });

  it("orders remote migration, core bootstrap, exact import, and full health validation", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(packageJson.scripts["db:push:remote"]).toBe(
      "node --import tsx scripts/push-remote-migrations.ts && pnpm run reference-resources:bootstrap:remote:core && pnpm run pipeline-resources:import:remote && pnpm run reference-resources:bootstrap:remote",
    );
    expect(packageJson.scripts["pipeline-resources:import:remote"]).toContain(
      "--remote --ax-data-root ../data",
    );
    expect(packageJson.scripts["pipeline-resources:import:remote"]).not.toContain(
      "sanitized",
    );
  });
});
