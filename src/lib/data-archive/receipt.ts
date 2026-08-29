import { eq, or } from "drizzle-orm";

import { getDb } from "@/db";
import {
  dataArchiveBackupRuns,
  dataArchivePackageVerifications,
  dataArchivePackageMembers,
  dataArchivePackages,
  dataArchiveReceipts,
} from "@/db/schema";
import type { OperationalAlertInput } from "@/lib/operational-alerts";

import {
  canonicalSha256,
  signedPackageVerificationReceiptSchema,
  signedBackupReceiptSchema,
  verifyPackageVerificationReceipt,
  verifyBackupReceipt,
  type BackupReceiptPayload,
  type PackageVerificationReceiptPayload,
  type SignedPackageVerificationReceipt,
  type SignedBackupReceipt,
} from "./canonical";

const MAX_RECEIPT_AGE_MS = 10 * 60 * 1000;
const MAX_RECEIPT_FUTURE_MS = 60 * 1000;

export class DataArchiveReceiptError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "DataArchiveReceiptError";
    this.code = code;
    this.status = status;
  }
}

export function authenticateBackupReceipt(input: {
  value: unknown;
  signingKey: string;
  now?: Date;
}): SignedBackupReceipt {
  let receipt: SignedBackupReceipt;
  try {
    receipt = signedBackupReceiptSchema.parse(input.value);
    verifyBackupReceipt(receipt, input.signingKey);
  } catch {
    throw new DataArchiveReceiptError(
      "archive_receipt_authentication_failed",
      "Backup receipt authentication failed.",
      401,
    );
  }

  const now = (input.now ?? new Date()).getTime();
  const issuedAt = new Date(receipt.payload.issuedAt).getTime();
  if (
    !Number.isFinite(issuedAt) ||
    now - issuedAt > MAX_RECEIPT_AGE_MS ||
    issuedAt - now > MAX_RECEIPT_FUTURE_MS
  ) {
    throw new DataArchiveReceiptError(
      "archive_receipt_stale",
      "Backup receipt is outside the accepted time window.",
      401,
    );
  }
  return receipt;
}

export function authenticatePackageVerificationReceipt(input: {
  value: unknown;
  signingKey: string;
  now?: Date;
}): SignedPackageVerificationReceipt {
  let receipt: SignedPackageVerificationReceipt;
  try {
    receipt = signedPackageVerificationReceiptSchema.parse(input.value);
    verifyPackageVerificationReceipt(receipt, input.signingKey);
  } catch {
    throw new DataArchiveReceiptError(
      "archive_verification_receipt_authentication_failed",
      "Package verification receipt authentication failed.",
      401,
    );
  }

  const now = (input.now ?? new Date()).getTime();
  const issuedAt = new Date(receipt.payload.issuedAt).getTime();
  if (
    !Number.isFinite(issuedAt) ||
    now - issuedAt > MAX_RECEIPT_AGE_MS ||
    issuedAt - now > MAX_RECEIPT_FUTURE_MS
  ) {
    throw new DataArchiveReceiptError(
      "archive_verification_receipt_stale",
      "Package verification receipt is outside the accepted time window.",
      401,
    );
  }
  return receipt;
}

function safeAlertToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").slice(0, 120);
}

export function buildBackupReceiptAlerts(
  payload: BackupReceiptPayload,
): OperationalAlertInput[] {
  const alerts: OperationalAlertInput[] = [];
  const runToken = safeAlertToken(payload.runKey);
  if (payload.status === "failed") {
    const reason = payload.failureCode ?? "backup-failed";
    alerts.push({
      idempotencyKey: `data-archive:${runToken}:failed`,
      fingerprint: `data-archive-${safeAlertToken(reason)}`,
      severity: "critical",
      source: "data.archive",
      title: "Samson data backup failed",
      summary:
        "The scheduled single-site recovery backup did not produce a verified recovery point. Review the protected Samson service logs.",
    });
  }
  const thresholds = [
    {
      kind: "database",
      bytes: payload.databaseUsageBytes,
      warning: 350 * 1024 ** 2,
      critical: 425 * 1024 ** 2,
    },
    {
      kind: "storage",
      bytes: payload.storageUsageBytes,
      warning: 750 * 1024 ** 2,
      critical: 900 * 1024 ** 2,
    },
    {
      kind: "archive",
      bytes: payload.archiveAllocatedBytes,
      warning: 40 * 1024 ** 3,
      critical: 45 * 1024 ** 3,
    },
  ] as const;
  for (const threshold of thresholds) {
    if (threshold.bytes < threshold.warning) continue;
    const critical = threshold.bytes >= threshold.critical;
    const band = critical ? "critical" : "warning";
    alerts.push({
      idempotencyKey: `data-archive:capacity:${threshold.kind}:${band}:${payload.completedAt.slice(0, 10)}`,
      fingerprint: `data-archive-capacity-${threshold.kind}-${band}`,
      severity: critical ? "critical" : "high",
      source: "data.archive.capacity",
      title: `${threshold.kind === "archive" ? "Samson archive" : `Supabase ${threshold.kind}`} capacity is ${band}`,
      summary: `${threshold.kind === "archive" ? "Archive allocation" : `Live ${threshold.kind} usage`} has entered the configured ${band} range. Generate or refresh the protected archive eligibility report.`,
    });
  }
  return alerts;
}

function assertSameRun(
  existing: typeof dataArchiveBackupRuns.$inferSelect,
  payload: BackupReceiptPayload,
) {
  if (
    existing.sourceProjectRef !== payload.projectRef ||
    existing.migrationChecksum !== payload.migrationSha256 ||
    existing.manifestChecksum !== payload.manifestSha256 ||
    existing.resticSnapshotId !== payload.resticSnapshotId ||
    existing.status !== payload.status
  ) {
    throw new DataArchiveReceiptError(
      "archive_receipt_idempotency_conflict",
      "Backup receipt conflicts with an existing run.",
      409,
    );
  }
}

export async function persistBackupReceipt(
  receipt: SignedBackupReceipt,
): Promise<{ backupRunId: string; replayed: boolean }> {
  const payload = receipt.payload;
  const db = getDb();
  return db.transaction(async (tx) => {
    const [existingReceipt] = await tx
      .select()
      .from(dataArchiveReceipts)
      .where(
        or(
          eq(dataArchiveReceipts.receiptKey, payload.runKey),
          eq(dataArchiveReceipts.nonce, payload.nonce),
        ),
      )
      .limit(1);

    if (existingReceipt) {
      if (
        existingReceipt.receiptKey !== payload.runKey ||
        existingReceipt.nonce !== payload.nonce ||
        existingReceipt.payloadChecksum !== receipt.payloadSha256 ||
        existingReceipt.signatureDigest !== receipt.signature
      ) {
        throw new DataArchiveReceiptError(
          "archive_receipt_replay_conflict",
          "Backup receipt replay conflicts with retained evidence.",
          409,
        );
      }
      return { backupRunId: existingReceipt.backupRunId, replayed: true };
    }

    const terminalAt = new Date(payload.completedAt);
    const integrityVerifiedAt = payload.integrityVerifiedAt
      ? new Date(payload.integrityVerifiedAt)
      : null;
    const [insertedRun] = await tx
      .insert(dataArchiveBackupRuns)
      .values({
        runKey: payload.runKey,
        status: payload.status,
        sourceProjectRef: payload.projectRef,
        sourceDatabaseVersion: payload.postgresVersion,
        migrationChecksum: payload.migrationSha256,
        manifestChecksum: payload.manifestSha256,
        resticSnapshotId: payload.resticSnapshotId,
        databaseBytes: payload.databaseBytes,
        storageBytes: payload.storageBytes,
        storageObjectCount: payload.storageObjectCount,
        databaseUsageBytes: payload.databaseUsageBytes,
        storageUsageBytes: payload.storageUsageBytes,
        archiveAllocatedBytes: payload.archiveAllocatedBytes,
        uniqueBytesAdded: payload.uniqueBytesAdded,
        compressionRatio: payload.compressionRatio,
        deduplicationRatio: payload.deduplicationRatio,
        failureCode: payload.failureCode,
        startedAt: new Date(payload.issuedAt),
        completedAt: terminalAt,
        integrityVerifiedAt,
        receiptReceivedAt: new Date(),
      })
      .onConflictDoNothing({ target: dataArchiveBackupRuns.runKey })
      .returning();

    let run = insertedRun;
    if (!run) {
      [run] = await tx
        .select()
        .from(dataArchiveBackupRuns)
        .where(eq(dataArchiveBackupRuns.runKey, payload.runKey))
        .limit(1);
      if (!run) throw new Error("archive_backup_run_missing_after_conflict");
      assertSameRun(run, payload);
    }

    if (payload.status === "verified") {
      for (const archivePackage of payload.packages) {
        const packageManifestChecksum = canonicalSha256(archivePackage);
        const [insertedPackage] = await tx
          .insert(dataArchivePackages)
          .values({
            backupRunId: run.id,
            packageKey: archivePackage.packageKey,
            packageKind: archivePackage.packageKind,
            sourceIdentifier: archivePackage.sourceIdentifier,
            sourceChecksum: archivePackage.sourceSha256,
            manifestChecksum: packageManifestChecksum,
            status: "verified",
            rowCount: archivePackage.rowCount,
            objectCount: archivePackage.objectCount,
            sizeBytes: archivePackage.sizeBytes,
            archiveSnapshotId: archivePackage.archiveSnapshotId,
            sourceCreatedAt: new Date(archivePackage.sourceCreatedAt),
            integrityVerifiedAt: integrityVerifiedAt!,
          })
          .onConflictDoNothing({ target: dataArchivePackages.packageKey })
          .returning();

        const [catalogPackage] = insertedPackage
          ? [insertedPackage]
          : await tx
              .select()
              .from(dataArchivePackages)
              .where(eq(dataArchivePackages.packageKey, archivePackage.packageKey))
              .limit(1);
        if (
          !catalogPackage ||
          catalogPackage.sourceChecksum !== archivePackage.sourceSha256 ||
          catalogPackage.manifestChecksum !== packageManifestChecksum
        ) {
          throw new DataArchiveReceiptError(
            "archive_package_identity_conflict",
            "Archive package conflicts with retained evidence.",
            409,
          );
        }
        if (insertedPackage) {
          await tx.insert(dataArchivePackageMembers).values(
            archivePackage.members.map((member) => ({
              packageId: catalogPackage.id,
              memberKind: member.kind,
              sourceTable: member.sourceTable,
              sourceIdentifier: member.sourceIdentifier,
              storageBucket: member.storageBucket,
              storageObjectName: member.storageObjectPath,
              contentType: member.contentType,
              contentChecksum: member.sha256,
              sizeBytes: member.sizeBytes,
              hotState: "hot" as const,
            })),
          );
        }
      }
    }

    const [storedReceipt] = await tx
      .insert(dataArchiveReceipts)
      .values({
        backupRunId: run.id,
        receiptKey: payload.runKey,
        nonce: payload.nonce,
        issuedAt: new Date(payload.issuedAt),
        signatureDigest: receipt.signature,
        payloadChecksum: receipt.payloadSha256,
      })
      .returning();
    if (!storedReceipt) throw new Error("archive_receipt_not_persisted");
    return { backupRunId: run.id, replayed: false };
  });
}

function assertSamePackageVerification(
  existing: typeof dataArchivePackageVerifications.$inferSelect,
  receipt: SignedPackageVerificationReceipt,
) {
  const payload = receipt.payload;
  if (
    existing.requestKey !== payload.requestKey ||
    existing.nonce !== payload.nonce ||
    existing.status !== payload.status ||
    existing.manifestChecksum !== payload.manifestSha256 ||
    existing.memberCount !== payload.memberCount ||
    existing.totalBytes !== payload.totalBytes ||
    existing.requestedByOwnerId !== payload.requestedByOwnerId ||
    existing.failureCode !== payload.failureCode ||
    existing.payloadChecksum !== receipt.payloadSha256 ||
    existing.signatureDigest !== receipt.signature
  ) {
    throw new DataArchiveReceiptError(
      "archive_verification_receipt_replay_conflict",
      "Package verification receipt replay conflicts with retained evidence.",
      409,
    );
  }
}

export async function persistPackageVerificationReceipt(
  receipt: SignedPackageVerificationReceipt,
): Promise<{ packageId: string; replayed: boolean }> {
  const payload: PackageVerificationReceiptPayload = receipt.payload;
  const db = getDb();
  return db.transaction(async (tx) => {
    const [archivePackage] = await tx
      .select()
      .from(dataArchivePackages)
      .where(eq(dataArchivePackages.packageKey, payload.packageKey))
      .limit(1);
    if (
      !archivePackage ||
      archivePackage.packageKind !== "api-run" ||
      archivePackage.manifestChecksum !== payload.manifestSha256 ||
      archivePackage.archiveSnapshotId !== payload.resticSnapshotId
    ) {
      throw new DataArchiveReceiptError(
        "archive_verification_package_conflict",
        "Package verification receipt conflicts with the protected catalog.",
        409,
      );
    }

    const [existing] = await tx
      .select()
      .from(dataArchivePackageVerifications)
      .where(or(
        eq(dataArchivePackageVerifications.requestKey, payload.requestKey),
        eq(dataArchivePackageVerifications.nonce, payload.nonce),
      ))
      .limit(1);
    if (existing) {
      if (existing.packageId !== archivePackage.id) {
        throw new DataArchiveReceiptError(
          "archive_verification_receipt_replay_conflict",
          "Package verification receipt replay conflicts with retained evidence.",
          409,
        );
      }
      assertSamePackageVerification(existing, receipt);
      return { packageId: archivePackage.id, replayed: true };
    }

    const members = await tx
      .select()
      .from(dataArchivePackageMembers)
      .where(eq(dataArchivePackageMembers.packageId, archivePackage.id));
    const memberBytes = members.reduce((total, member) => total + member.sizeBytes, 0);
    if (
      members.length !== payload.memberCount ||
      memberBytes !== payload.totalBytes ||
      archivePackage.sizeBytes !== payload.totalBytes
    ) {
      throw new DataArchiveReceiptError(
        "archive_verification_member_conflict",
        "Package verification receipt does not match protected package members.",
        409,
      );
    }

    const completedAt = new Date(payload.completedAt);
    const [inserted] = await tx
      .insert(dataArchivePackageVerifications)
      .values({
        requestKey: payload.requestKey,
        nonce: payload.nonce,
        packageId: archivePackage.id,
        status: payload.status,
        manifestChecksum: payload.manifestSha256,
        memberCount: payload.memberCount,
        totalBytes: payload.totalBytes,
        requestedByOwnerId: payload.requestedByOwnerId,
        issuedAt: new Date(payload.issuedAt),
        completedAt,
        verifiedAt: payload.status === "verified" ? completedAt : null,
        failureCode: payload.failureCode,
        signatureDigest: receipt.signature,
        payloadChecksum: receipt.payloadSha256,
      })
      .returning();
    if (!inserted) throw new Error("archive_verification_receipt_not_persisted");

    if (payload.status === "verified" && archivePackage.restoreVerifiedAt === null) {
      await tx
        .update(dataArchivePackages)
        .set({ restoreVerifiedAt: completedAt, updatedAt: new Date() })
        .where(eq(dataArchivePackages.id, archivePackage.id));
    }
    return { packageId: archivePackage.id, replayed: false };
  });
}
