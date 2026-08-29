import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("data archive package verification CLI safety", () => {
  it("requires an exact package, stable request, owner, approval, and environment gate", async () => {
    const source = await readFile("scripts/data-archive-verify-package.ts", "utf8");
    expect(source).toContain('flag("--package-key")');
    expect(source).toContain('flag("--request-key")');
    expect(source).toContain('flag("--owner")');
    expect(source).toContain('process.argv.includes("--approve")');
    expect(source).toContain(
      'process.env.DATA_ARCHIVE_PACKAGE_VERIFICATION_ENABLED !== "true"',
    );
    expect(source).toContain("restoreAndVerifyApiRunPackage");
    expect(source).toContain("submitPackageVerificationReceipt");
    expect(source).not.toContain("createSupabaseAdminClient");
    expect(source).not.toContain("DATABASE_URL");
  });
});
