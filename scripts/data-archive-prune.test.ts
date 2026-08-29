import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("data archive prune CLI safety", () => {
  it("keeps production deletion off unless a separate flag, checksum, owner, and environment gate are present", async () => {
    const source = await readFile("scripts/data-archive-prune.ts", "utf8");
    expect(source).toContain('hasFlag("--approve")');
    expect(source).toContain('flag("--checksum")');
    expect(source).toContain('flag("--owner")');
    expect(source).toContain('DATA_ARCHIVE_PRODUCTION_PRUNE_ENABLED === "true"');
    expect(source).toContain("productionDeletionEnabled: false");
    expect(source).not.toMatch(/remove\(\[?["'`]*\*/);
  });
});
