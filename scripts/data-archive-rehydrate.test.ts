import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("data archive rehydration CLI safety", () => {
  it("requires exact package, stable request, owner, approval, and environment gates", async () => {
    const source = await readFile("scripts/data-archive-rehydrate.ts", "utf8");
    expect(source).toContain('flag("--package-key")');
    expect(source).toContain('flag("--request-key")');
    expect(source).toContain('flag("--owner")');
    expect(source).toContain('process.argv.includes("--approve")');
    expect(source).toContain('DATA_ARCHIVE_REHYDRATION_ENABLED !== "true"');
  });
});
