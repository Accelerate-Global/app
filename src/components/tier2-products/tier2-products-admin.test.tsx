import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Tier2ProductsAdmin", () => {
  it("exposes the complete profile-specific review and publication lifecycle", async () => {
    const source = await readFile(
      "src/components/tier2-products/tier2-products-admin.tsx",
      "utf8",
    );
    expect(source).toContain("Launch selected partner flow");
    expect(source).toContain("Enable schedule");
    expect(source).toContain("sourceProfileId: profileId");
    expect(source).toContain("Import version");
    expect(source).toContain("Publish forming");
    expect(source).toContain("Build identity");
    expect(source).toContain("Build exact candidate");
    expect(source).toContain("Restore prior release");
    expect(source).toContain("Stable dataset restored");
    expect(source).toContain("Legacy side-by-side comparison");
    expect(source).toContain("Retain comparison");
    expect(source).toContain("Download full retained report");
  });
});
