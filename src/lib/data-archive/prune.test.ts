import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { normalizeDatabaseByteValue } from "./prune";

describe("database byte normalization", () => {
  it.each([
    [0, 0],
    [42, 42],
    [BigInt(0), 0],
    [BigInt(42), 42],
    ["0", 0],
    ["001024", 1024],
    [String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
  ])("normalizes exact nonnegative safe integers (%s)", (value, expected) => {
    expect(normalizeDatabaseByteValue(value)).toBe(expected);
  });

  it.each([
    undefined,
    null,
    "",
    " 1",
    "1 ",
    "-1",
    "1.5",
    "1e3",
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    BigInt(-1),
    BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1),
    String(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)),
  ])("rejects invalid or unsafe database byte values (%s)", (value) => {
    expect(() => normalizeDatabaseByteValue(value)).toThrow(
      "archive_database_byte_value_invalid",
    );
  });
});

describe("API artifact prune safety contract", () => {
  it("binds restore audit, retention policy, live capacity, and source ownership into rechecks", async () => {
    const source = await readFile("src/lib/data-archive/prune.ts", "utf8");
    expect(source).toContain("data_archive_package_verifications");
    expect(source).toContain("restore_audit_verified");
    expect(source).toContain("readArchiveApiRetentionPolicy");
    expect(source).toContain("readLiveStorageBytes");
    expect(source).toContain("normalizeDatabaseByteValue(member.size_bytes)");
    expect(source).toContain("regenerated.planSha256 !== planChecksum");
    expect(source).toContain("path_scoped_to_run");
    expect(source).toContain("shared_reference_count !== 1");
    expect(source).toContain("selected_package.package_kind = 'api-run'");
    expect(source).not.toContain("member.package_id = any(${packageIds}::uuid[])");
    expect(source).toContain("storage.from(identity.bucket).remove([identity.path])");
    expect(source).not.toMatch(/delete\s+from\s+storage\.objects/i);
  });
});
