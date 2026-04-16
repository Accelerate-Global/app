import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { evaluateTestImpact } from "./test-impact";

const temporaryDirectories: string[] = [];

async function createTempRepo() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "test-impact-"));
  temporaryDirectories.push(rootDir);
  return rootDir;
}

async function writeRepoFile(rootDir: string, filePath: string, content = "export {};\n") {
  const absolutePath = path.join(rootDir, filePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directoryPath) =>
      rm(directoryPath, { recursive: true, force: true }),
    ),
  );
});

describe("test-impact", () => {
  it("passes when a changed source file has a changed direct test", async () => {
    const rootDir = await createTempRepo();
    await writeRepoFile(rootDir, "src/lib/field-sources.ts");
    await writeRepoFile(rootDir, "src/lib/field-sources.test.ts");

    const report = await evaluateTestImpact({
      rootDir,
      changedFiles: ["src/lib/field-sources.ts", "src/lib/field-sources.test.ts"],
    });

    expect(report.exitCode).toBe(0);
    expect(report.coveredSourceFiles).toEqual(["src/lib/field-sources.ts"]);
    expect(report.missingTestUpdates).toEqual([]);
  });

  it("fails when a changed source file has a direct test but no changed test delta", async () => {
    const rootDir = await createTempRepo();
    await writeRepoFile(rootDir, "src/lib/filter-settings.ts");
    await writeRepoFile(rootDir, "src/lib/filter-settings.test.ts");

    const report = await evaluateTestImpact({
      rootDir,
      changedFiles: ["src/lib/filter-settings.ts"],
    });

    expect(report.exitCode).toBe(1);
    expect(report.missingTestUpdates).toHaveLength(1);
    expect(report.missingTestUpdates[0]?.sourcePath).toBe("src/lib/filter-settings.ts");
  });

  it("passes when multiple direct tests exist and one of them changed", async () => {
    const rootDir = await createTempRepo();
    await writeRepoFile(rootDir, "config/change-impact.ts");
    await writeRepoFile(rootDir, "config/change-impact.test.ts");
    await writeRepoFile(rootDir, "config/change-impact.spec.ts");

    const report = await evaluateTestImpact({
      rootDir,
      changedFiles: ["config/change-impact.ts", "config/change-impact.spec.ts"],
    });

    expect(report.exitCode).toBe(0);
    expect(report.mappings[0]?.candidateTestPaths).toEqual([
      "config/change-impact.test.ts",
      "config/change-impact.spec.ts",
    ]);
    expect(report.mappings[0]?.changedTestPaths).toEqual([
      "config/change-impact.spec.ts",
    ]);
  });

  it("does not require a test delta when no direct same-stem test exists", async () => {
    const rootDir = await createTempRepo();
    await writeRepoFile(rootDir, "src/components/dashboard/filter-settings-client.tsx");

    const report = await evaluateTestImpact({
      rootDir,
      changedFiles: ["src/components/dashboard/filter-settings-client.tsx"],
    });

    expect(report.exitCode).toBe(0);
    expect(report.coveredSourceFiles).toEqual([]);
  });

  it("passes when only test files changed", async () => {
    const rootDir = await createTempRepo();
    await writeRepoFile(rootDir, "src/components/dashboard/field-sources-client.test.tsx");

    const report = await evaluateTestImpact({
      rootDir,
      changedFiles: ["src/components/dashboard/field-sources-client.test.tsx"],
    });

    expect(report.exitCode).toBe(0);
    expect(report.changedTestFiles).toEqual([
      "src/components/dashboard/field-sources-client.test.tsx",
    ]);
    expect(report.coveredSourceFiles).toEqual([]);
  });

  it("maps page components to page.test.ts files", async () => {
    const rootDir = await createTempRepo();
    await writeRepoFile(rootDir, "src/app/dashboard/field-sources/page.tsx");
    await writeRepoFile(rootDir, "src/app/dashboard/field-sources/page.test.ts");

    const report = await evaluateTestImpact({
      rootDir,
      changedFiles: [
        "src/app/dashboard/field-sources/page.tsx",
        "src/app/dashboard/field-sources/page.test.ts",
      ],
    });

    expect(report.exitCode).toBe(0);
    expect(report.mappings[0]?.candidateTestPaths).toContain(
      "src/app/dashboard/field-sources/page.test.ts",
    );
  });
});
