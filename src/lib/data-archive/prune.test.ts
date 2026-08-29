import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("API artifact prune safety contract", () => {
  it("binds restore audit, retention policy, live capacity, and source ownership into rechecks", async () => {
    const source = await readFile("src/lib/data-archive/prune.ts", "utf8");
    expect(source).toContain("data_archive_package_verifications");
    expect(source).toContain("restore_audit_verified");
    expect(source).toContain("readArchiveApiRetentionPolicy");
    expect(source).toContain("readLiveStorageBytes");
    expect(source).toContain("regenerated.planSha256 !== planChecksum");
    expect(source).toContain("path_scoped_to_run");
    expect(source).toContain("shared_reference_count !== 1");
    expect(source).toContain("selected_package.package_kind = 'api-run'");
    expect(source).not.toContain("member.package_id = any(${packageIds}::uuid[])");
    expect(source).toContain("storage.from(identity.bucket).remove([identity.path])");
    expect(source).not.toMatch(/delete\s+from\s+storage\.objects/i);
  });
});
