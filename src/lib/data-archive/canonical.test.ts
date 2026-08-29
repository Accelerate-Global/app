import { describe, expect, it } from "vitest";

import {
  buildCapacitySummary,
  buildArchivePackageContent,
  canonicalJson,
  canonicalSha256,
  contentAddressedPackagePath,
  normalizeStorageInventory,
  reconcileStorageInventories,
  signBackupReceipt,
  signPackageVerificationReceipt,
  verifyBackupReceipt,
  verifyPackageVerificationReceipt,
  type BackupReceiptPayload,
  type PackageVerificationReceiptPayload,
  type StorageObject,
} from "./canonical";

const checksum = (character: string) => character.repeat(64);

const object = (path: string, sha256 = checksum("a")): StorageObject => ({
  bucket: "api-connection-artifacts",
  path,
  version: null,
  sizeBytes: 20,
  contentType: "application/json",
  providerEtag: null,
  lastModified: "2026-08-27T09:00:00.000Z",
  localSha256: sha256,
});

describe("canonical data archive records", () => {
  it("serializes object keys and checksums deterministically", () => {
    expect(canonicalJson({ z: 1, nested: { b: 2, a: 1 }, a: 2 })).toBe(
      '{"a":2,"nested":{"a":1,"b":2},"z":1}\n',
    );
    expect(canonicalSha256({ b: 2, a: 1 })).toBe(
      canonicalSha256({ a: 1, b: 2 }),
    );
  });

  it("sorts and totals inventory without accepting duplicate identities", () => {
    const inventory = normalizeStorageInventory({
      capturedAt: "2026-08-27T09:00:00.000Z",
      objects: [object("z.json"), object("a.json")],
    });
    expect(inventory.objects.map((item) => item.path)).toEqual(["a.json", "z.json"]);
    expect(inventory.objectCount).toBe(2);
    expect(inventory.totalBytes).toBe(40);
    expect(() =>
      normalizeStorageInventory({
        capturedAt: "2026-08-27T09:00:00.000Z",
        objects: [object("same.json"), object("same.json")],
      }),
    ).toThrow("storage_inventory_duplicate_object");
  });

  it("fails closed when an inventory copy is missing or mismatched", () => {
    const before = normalizeStorageInventory({
      capturedAt: "2026-08-27T09:00:00.000Z",
      objects: [object("one.json")],
    });
    const after = normalizeStorageInventory({
      capturedAt: "2026-08-27T09:01:00.000Z",
      objects: [object("one.json"), object("two.json", checksum("b"))],
    });
    expect(() => reconcileStorageInventories({ before, after, copied: [object("one.json")] }))
      .toThrow("storage_inventory_changed_and_copy_incomplete");
    expect(reconcileStorageInventories({ before, after, copied: after.objects })).toEqual(after);
  });

  it("uses stable content-addressed paths rather than snapshot dates", () => {
    for (const kind of [
      "api-run",
      "dataset-version",
      "tier1-publication",
      "tier2-publication",
    ] as const) {
      expect(
        contentAddressedPackagePath({
          kind,
          sourceIdentifier: "source/one",
          sha256: checksum("c"),
        }),
      ).toBe(`packages/${kind}/source_one/${checksum("c")}`);
    }
    const content = buildArchivePackageContent({
      packageKind: "dataset-version",
      sourceIdentifier: "version-one",
      sourceCreatedAt: "2026-06-01T00:00:00.000Z",
      sourceIdentity: { id: "version-one", checksum: checksum("a") },
      rowCount: 1,
      members: [{
        kind: "dataset-blob",
        sourceTable: null,
        sourceIdentifier: "version-one",
        storageBucket: "datasets",
        storageObjectPath: "datasets/csv/one.csv",
        contentType: "text/csv",
        sha256: checksum("b"),
        sizeBytes: 20,
      }],
    });
    expect(content.packageKey).toBe(
      `dataset-version/version-one/${content.sourceSha256}`,
    );
  });

  it("classifies provider capacity at the approved thresholds", () => {
    const warning = buildCapacitySummary({
      databaseBytes: 350 * 1024 ** 2,
      storageBytes: 899 * 1024 ** 2,
      archiveAllocatedBytes: 1,
      archiveUniqueBytes: 1,
      uniqueBytesAdded: 1,
      compressionRatio: 2,
      deduplicationRatio: 3,
    });
    expect(warning.databaseStatus).toBe("warning");
    expect(warning.storageStatus).toBe("warning");
    expect(warning.siteProtection).toBe("single-site");
    expect(warning.offsiteProtected).toBe(false);

    const critical = buildCapacitySummary({
      ...warning,
      databaseBytes: 425 * 1024 ** 2,
      storageBytes: 900 * 1024 ** 2,
    });
    expect(critical.databaseStatus).toBe("critical");
    expect(critical.storageStatus).toBe("critical");
  });

  it("signs and verifies canonical receipts and rejects tampering", () => {
    const payload: BackupReceiptPayload = {
      schemaVersion: 1,
      runKey: "backup:2026-08-27:001",
      nonce: "nonce-2026-08-27-000000000001",
      issuedAt: "2026-08-27T09:05:00.000Z",
      status: "verified",
      projectRef: "uuyntfbqksnclyvlpecx",
      postgresVersion: "17.6",
      migrationSha256: checksum("a"),
      manifestSha256: checksum("b"),
      resticSnapshotId: checksum("c"),
      databaseBytes: 100,
      storageBytes: 200,
      storageObjectCount: 2,
      databaseUsageBytes: 300,
      storageUsageBytes: 400,
      archiveAllocatedBytes: 500,
      uniqueBytesAdded: 10,
      compressionRatio: 2,
      deduplicationRatio: 3,
      integrityVerifiedAt: "2026-08-27T09:04:00.000Z",
      completedAt: "2026-08-27T09:05:00.000Z",
      failureCode: null,
      packages: [],
    };
    const key = "receipt-key-with-at-least-thirty-two-characters";
    const receipt = signBackupReceipt(payload, key);
    expect(verifyBackupReceipt(receipt, key)).toEqual(payload);
    expect(() =>
      verifyBackupReceipt(
        { ...receipt, payload: { ...payload, databaseBytes: 101 } },
        key,
      ),
    ).toThrow("archive_receipt_signature_invalid");
  });

  it("signs package restore verification evidence and rejects status ambiguity", () => {
    const payload: PackageVerificationReceiptPayload = {
      schemaVersion: 1,
      receiptKind: "package-restore-verification",
      requestKey: "verify:api-package:001",
      nonce: "verify-nonce-2026082900000001",
      issuedAt: "2026-08-29T09:00:00.000Z",
      completedAt: "2026-08-29T09:01:00.000Z",
      status: "verified",
      projectRef: "uuyntfbqksnclyvlpecx",
      packageKey: `api-run/run-one/${checksum("d")}`,
      manifestSha256: checksum("a"),
      resticSnapshotId: checksum("b"),
      memberCount: 2,
      totalBytes: 200,
      requestedByOwnerId: "owner-one",
      failureCode: null,
    };
    const key = "receipt-key-with-at-least-thirty-two-characters";
    const receipt = signPackageVerificationReceipt(payload, key);
    expect(verifyPackageVerificationReceipt(receipt, key)).toEqual(payload);
    expect(() => signPackageVerificationReceipt({
      ...payload,
      status: "failed",
      failureCode: null,
    }, key)).toThrow();
    expect(() => verifyPackageVerificationReceipt({
      ...receipt,
      payload: { ...payload, totalBytes: 201 },
    }, key)).toThrow("archive_verification_receipt_signature_invalid");
  });
});
