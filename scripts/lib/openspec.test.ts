import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  checkOpenSpecArchiveReadiness,
  listActiveOpenSpecChanges,
  listGeneratedOpenSpecPurposePlaceholders,
} from "./openspec";

const temporaryDirectories: string[] = [];

async function createTempRoot() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "openspec-check-"));
  temporaryDirectories.push(rootDir);

  return rootDir;
}

async function writeTempFile(rootDir: string, filePath: string, content: string) {
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

describe("openspec helpers", () => {
  it("lists only active changes and ignores archived changes", async () => {
    const rootDir = await createTempRoot();
    await writeTempFile(
      rootDir,
      "openspec/changes/add-feature/proposal.md",
      "## Summary\n",
    );
    await writeTempFile(
      rootDir,
      "openspec/changes/archive/2026-04-27-add-feature/proposal.md",
      "## Summary\n",
    );

    await expect(listActiveOpenSpecChanges(rootDir)).resolves.toEqual([
      "add-feature",
    ]);
  });

  it("finds generated archive Purpose placeholders in durable specs", async () => {
    const rootDir = await createTempRoot();
    await writeTempFile(
      rootDir,
      "openspec/specs/example/spec.md",
      "# example Specification\n\n## Purpose\nTBD - created by archiving change example.\n",
    );

    await expect(
      listGeneratedOpenSpecPurposePlaceholders(rootDir),
    ).resolves.toEqual(["openspec/specs/example/spec.md"]);
  });

  it("returns readiness issues for active changes and placeholder specs", async () => {
    const rootDir = await createTempRoot();
    await writeTempFile(
      rootDir,
      "openspec/changes/add-feature/tasks.md",
      "## Tasks\n",
    );
    await writeTempFile(
      rootDir,
      "openspec/specs/example/spec.md",
      "# example Specification\n\n## Purpose\nTBD - created by archiving change example.\n",
    );

    const result = await checkOpenSpecArchiveReadiness(rootDir);

    expect(result.activeChanges).toEqual(["add-feature"]);
    expect(result.placeholderSpecs).toEqual(["openspec/specs/example/spec.md"]);
    expect(result.issues.join("\n")).toContain(
      "Active OpenSpec changes must be archived before ship",
    );
  });
});
