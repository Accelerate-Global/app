import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  getTrackedFileTreeSha,
  isVerificationSatisfied,
  loadVerificationReceipt,
  recordVerificationSuccess,
} from "./verification-receipts";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

async function createTempRepo() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "verification-receipts-"));
  temporaryDirectories.push(rootDir);

  await execFileAsync("git", ["init"], { cwd: rootDir });
  await execFileAsync("git", ["config", "user.name", "Codex"], { cwd: rootDir });
  await execFileAsync("git", ["config", "user.email", "codex@example.com"], {
    cwd: rootDir,
  });

  return rootDir;
}

async function writeRepoFile(rootDir: string, filePath: string, content: string) {
  const absolutePath = path.join(rootDir, filePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

async function trackRepoFile(rootDir: string, filePath: string, content: string) {
  await writeRepoFile(rootDir, filePath, content);
  await execFileAsync("git", ["add", filePath], { cwd: rootDir });
  await execFileAsync("git", ["commit", "-m", "track file"], { cwd: rootDir });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directoryPath) =>
      rm(directoryPath, { recursive: true, force: true }),
    ),
  );
});

describe("verification-receipts", () => {
  it("reuses a receipt for the same tracked tree and changed file set", async () => {
    const rootDir = await createTempRepo();
    await trackRepoFile(rootDir, "src/lib/example.ts", "export const value = 1;\n");
    const treeSha = await getTrackedFileTreeSha(rootDir);

    await recordVerificationSuccess({
      rootDir,
      treeSha,
      changedFiles: ["src/lib/example.ts"],
      commandIds: ["typecheck", "verify:app"],
    });

    const receipt = await loadVerificationReceipt({
      rootDir,
      treeSha,
      changedFiles: ["src/lib/example.ts"],
    });

    expect(receipt).not.toBeNull();
    expect(isVerificationSatisfied(receipt, "typecheck")).toBe(true);
    expect(isVerificationSatisfied(receipt, "verify:app")).toBe(true);
  });

  it("invalidates receipts when the tracked tree changes", async () => {
    const rootDir = await createTempRepo();
    await trackRepoFile(rootDir, "src/lib/example.ts", "export const value = 1;\n");
    const originalTreeSha = await getTrackedFileTreeSha(rootDir);

    await recordVerificationSuccess({
      rootDir,
      treeSha: originalTreeSha,
      changedFiles: ["src/lib/example.ts"],
      commandIds: ["typecheck"],
    });

    await writeRepoFile(rootDir, "src/lib/example.ts", "export const value = 2;\n");
    const changedTreeSha = await getTrackedFileTreeSha(rootDir);
    const receipt = await loadVerificationReceipt({
      rootDir,
      treeSha: changedTreeSha,
      changedFiles: ["src/lib/example.ts"],
    });

    expect(changedTreeSha).not.toBe(originalTreeSha);
    expect(receipt).toBeNull();
  });

  it("treats a full smoke receipt as satisfying targeted smoke and smoke:check", async () => {
    const rootDir = await createTempRepo();
    await trackRepoFile(rootDir, "src/lib/example.ts", "export const value = 1;\n");
    const treeSha = await getTrackedFileTreeSha(rootDir);

    await recordVerificationSuccess({
      rootDir,
      treeSha,
      changedFiles: ["src/lib/example.ts"],
      commandIds: ["test:ui:smoke"],
    });

    const receipt = await loadVerificationReceipt({
      rootDir,
      treeSha,
      changedFiles: ["src/lib/example.ts"],
    });

    expect(isVerificationSatisfied(receipt, "test:ui:smoke:targeted")).toBe(true);
    expect(isVerificationSatisfied(receipt, "smoke:check")).toBe(true);
  });

  it("stores and reuses verify:ship:local receipts on the same tracked tree", async () => {
    const rootDir = await createTempRepo();
    await trackRepoFile(rootDir, "scripts/ship.ts", "export const shipped = true;\n");
    const treeSha = await getTrackedFileTreeSha(rootDir);

    await recordVerificationSuccess({
      rootDir,
      treeSha,
      changedFiles: ["scripts/ship.ts"],
      commandIds: ["verify:ship:local"],
    });

    const receipt = await loadVerificationReceipt({
      rootDir,
      treeSha,
      changedFiles: ["scripts/ship.ts"],
    });

    expect(isVerificationSatisfied(receipt, "verify:ship:local")).toBe(true);
  });
});
