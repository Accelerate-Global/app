import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { findAxDataExecutionDependencies } from "./check-ax-data-isolation";

async function fixture(body: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ax-isolation-"));
  await Promise.all(["src", "scripts", "config"].map((name) => mkdir(path.join(root, name))));
  await writeFile(path.join(root, "package.json"), '{"scripts":{}}');
  await writeFile(path.join(root, "src", "reader.ts"), body);
  return root;
}

describe("AX Data execution isolation", () => {
  it("accepts current-source-only executable paths", async () => {
    await expect(
      findAxDataExecutionDependencies(await fixture('export const source = "current";')),
    ).resolves.toEqual([]);
  });

  it("reports executable parent-repository readers", async () => {
    const findings = await findAxDataExecutionDependencies(
      await fixture('export const root = "../data";'),
    );
    expect(findings).toEqual([
      { file: "src/reader.ts", marker: "../data" },
    ]);
  });
});
