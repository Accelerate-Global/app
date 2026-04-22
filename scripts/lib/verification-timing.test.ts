import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  readVerificationTimings,
  recordVerificationTiming,
} from "./verification-timing";

let rootDir: string | null = null;

async function createTempRoot() {
  rootDir = await mkdtemp(path.join(os.tmpdir(), "verification-timing-"));
  return rootDir;
}

afterEach(async () => {
  if (rootDir) {
    await rm(rootDir, { recursive: true, force: true });
  }
  rootDir = null;
});

describe("verification-timing", () => {
  it("returns an empty list when no timing log has been recorded", async () => {
    const tempRoot = await createTempRoot();

    await expect(readVerificationTimings(tempRoot)).resolves.toEqual([]);
  });

  it("records normalized timing samples in append-only order", async () => {
    const tempRoot = await createTempRoot();

    await recordVerificationTiming({
      rootDir: tempRoot,
      treeSha: "tree-sha",
      changedFiles: ["b.ts", "a.ts", "a.ts"],
      scope: "verification-run",
      name: "verify:ship:local",
      durationMs: 1234,
      status: "passed",
    });
    await recordVerificationTiming({
      rootDir: tempRoot,
      scope: "ship-run",
      name: "pnpm ship",
      durationMs: 5678,
      status: "failed",
    });

    const samples = await readVerificationTimings(tempRoot);

    expect(samples).toHaveLength(2);
    expect(samples[0]).toEqual(
      expect.objectContaining({
        treeSha: "tree-sha",
        changedFiles: ["a.ts", "b.ts"],
        scope: "verification-run",
        name: "verify:ship:local",
        durationMs: 1234,
        status: "passed",
      }),
    );
    expect(samples[1]).toEqual(
      expect.objectContaining({
        scope: "ship-run",
        name: "pnpm ship",
        durationMs: 5678,
        status: "failed",
      }),
    );
  });
});
