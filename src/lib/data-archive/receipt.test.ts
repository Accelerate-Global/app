import { describe, expect, it } from "vitest";

import {
  signBackupReceipt,
  signPackageVerificationReceipt,
  type BackupReceiptPayload,
  type PackageVerificationReceiptPayload,
} from "./canonical";
import {
  authenticateBackupReceipt,
  authenticatePackageVerificationReceipt,
  buildBackupReceiptAlerts,
} from "./receipt";

const checksum = (character: string) => character.repeat(64);
const now = new Date("2026-08-27T09:05:00.000Z");
const key = "receipt-key-with-at-least-thirty-two-characters";

function payload(overrides: Partial<BackupReceiptPayload> = {}): BackupReceiptPayload {
  return {
    schemaVersion: 1,
    runKey: "backup:2026-08-27:001",
    nonce: "nonce-2026-08-27-000000000001",
    issuedAt: now.toISOString(),
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
    integrityVerifiedAt: now.toISOString(),
    completedAt: now.toISOString(),
    failureCode: null,
    packages: [],
    ...overrides,
  };
}

function verificationPayload(
  overrides: Partial<PackageVerificationReceiptPayload> = {},
): PackageVerificationReceiptPayload {
  return {
    schemaVersion: 1,
    receiptKind: "package-restore-verification",
    requestKey: "verify:api-package:001",
    nonce: "verify-nonce-2026082900000001",
    issuedAt: now.toISOString(),
    completedAt: now.toISOString(),
    status: "verified",
    projectRef: "uuyntfbqksnclyvlpecx",
    packageKey: `api-run/run-one/${checksum("d")}`,
    manifestSha256: checksum("a"),
    resticSnapshotId: checksum("b"),
    memberCount: 2,
    totalBytes: 200,
    requestedByOwnerId: "owner-one",
    failureCode: null,
    ...overrides,
  };
}

describe("signed backup receipts", () => {
  it("accepts a fresh correctly signed receipt", () => {
    const receipt = signBackupReceipt(payload(), key);
    expect(authenticateBackupReceipt({ value: receipt, signingKey: key, now })).toEqual(receipt);
  });

  it("rejects stale, future, and incorrectly signed receipts", () => {
    const stale = signBackupReceipt(
      payload({ issuedAt: "2026-08-27T08:54:59.000Z" }),
      key,
    );
    expect(() => authenticateBackupReceipt({ value: stale, signingKey: key, now }))
      .toThrow("outside the accepted time window");
    const future = signBackupReceipt(
      payload({ issuedAt: "2026-08-27T09:06:01.000Z" }),
      key,
    );
    expect(() => authenticateBackupReceipt({ value: future, signingKey: key, now }))
      .toThrow("outside the accepted time window");
    expect(() =>
      authenticateBackupReceipt({ value: signBackupReceipt(payload(), key), signingKey: `${key}x`, now }),
    ).toThrow("authentication failed");
  });

  it("builds only bounded sanitized failure and capacity alerts", () => {
    const alerts = buildBackupReceiptAlerts(
      payload({
        status: "failed",
        manifestSha256: null,
        resticSnapshotId: null,
        integrityVerifiedAt: null,
        failureCode: "storage-copy-mismatch",
        databaseUsageBytes: 425 * 1024 ** 2,
        storageUsageBytes: 750 * 1024 ** 2,
      }),
    );
    expect(alerts).toHaveLength(3);
    expect(alerts.map((alert) => alert.severity)).toEqual(["critical", "critical", "high"]);
    const serialized = JSON.stringify(alerts);
    expect(serialized).not.toMatch(/password|recovery key|local path|filename/i);
    expect(serialized).not.toContain(checksum("a"));
  });

  it("does not consume failure capacity for a healthy backup", () => {
    expect(buildBackupReceiptAlerts(payload())).toEqual([]);
  });
});

describe("signed package verification receipts", () => {
  it("accepts fresh evidence and rejects stale or incorrectly signed evidence", () => {
    const receipt = signPackageVerificationReceipt(verificationPayload(), key);
    expect(authenticatePackageVerificationReceipt({
      value: receipt,
      signingKey: key,
      now,
    })).toEqual(receipt);
    const stale = signPackageVerificationReceipt(
      verificationPayload({ issuedAt: "2026-08-27T08:54:59.000Z" }),
      key,
    );
    expect(() => authenticatePackageVerificationReceipt({
      value: stale,
      signingKey: key,
      now,
    })).toThrow("outside the accepted time window");
    expect(() => authenticatePackageVerificationReceipt({
      value: receipt,
      signingKey: `${key}x`,
      now,
    })).toThrow("authentication failed");
  });
});
