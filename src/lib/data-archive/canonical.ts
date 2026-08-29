import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const checksumSchema = z.string().regex(/^[0-9a-f]{64}$/);
const safeKeySchema = z.string().min(8).max(240).regex(/^[a-zA-Z0-9._:/-]+$/);
const safeIdentifierSchema = z.string().min(1).max(1024);
const nonNegativeIntegerSchema = z.number().int().nonnegative().safe();

export const archiveStorageWarningBytes = 750 * 1024 ** 2;
export const archiveStorageCriticalBytes = 900 * 1024 ** 2;

export const archiveApiRetentionPolicySchema = z.object({
  minimumAgeDays: z.number().int().min(7).max(30),
  hotVersionsPerConnection: z.number().int().min(1).max(3),
});

export const dataArchiveSchemaVersion = 1 as const;

export const databaseExportSchema = z.object({
  kind: z.enum(["roles", "schema", "data", "managed-auth", "managed-storage", "migrations"]),
  relativePath: safeIdentifierSchema,
  sha256: checksumSchema,
  sizeBytes: nonNegativeIntegerSchema,
});

export const storageObjectSchema = z.object({
  bucket: z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9._-]*$/),
  path: safeIdentifierSchema,
  version: z.string().max(240).nullable(),
  sizeBytes: nonNegativeIntegerSchema,
  contentType: z.string().max(160).nullable(),
  providerEtag: z.string().max(240).nullable(),
  lastModified: z.string().datetime({ offset: true }).nullable(),
  localSha256: checksumSchema,
});

export const storageInventorySchema = z.object({
  schemaVersion: z.literal(dataArchiveSchemaVersion),
  capturedAt: z.string().datetime({ offset: true }),
  objects: z.array(storageObjectSchema),
  objectCount: nonNegativeIntegerSchema,
  totalBytes: nonNegativeIntegerSchema,
});

export const archivePackageKindSchema = z.enum([
  "api-run",
  "dataset-version",
  "tier1-publication",
  "tier2-publication",
  "project-snapshot",
]);

export const archivePackageMemberSchema = z.object({
  kind: z.string().min(2).max(80).regex(/^[a-z0-9._-]+$/),
  sourceTable: z.string().regex(/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/).nullable(),
  sourceIdentifier: z.string().max(240).nullable(),
  storageBucket: z.string().max(100).nullable(),
  storageObjectPath: safeIdentifierSchema.nullable(),
  contentType: z.string().max(160).nullable(),
  sha256: checksumSchema,
  sizeBytes: nonNegativeIntegerSchema,
});

export const archivePackageSchema = z.object({
  schemaVersion: z.literal(dataArchiveSchemaVersion),
  packageKey: safeKeySchema,
  packageKind: archivePackageKindSchema,
  sourceIdentifier: z.string().min(1).max(240),
  sourceCreatedAt: z.string().datetime({ offset: true }),
  sourceSha256: checksumSchema,
  members: z.array(archivePackageMemberSchema).min(1),
  rowCount: nonNegativeIntegerSchema,
  objectCount: nonNegativeIntegerSchema,
  sizeBytes: nonNegativeIntegerSchema,
  archiveSnapshotId: z.string().regex(/^[0-9a-f]{8,64}$/),
});

export const archivePackageContentSchema = archivePackageSchema.omit({
  archiveSnapshotId: true,
});

export const capacitySummarySchema = z.object({
  databaseBytes: nonNegativeIntegerSchema,
  storageBytes: nonNegativeIntegerSchema,
  archiveAllocatedBytes: nonNegativeIntegerSchema,
  archiveUniqueBytes: nonNegativeIntegerSchema,
  uniqueBytesAdded: nonNegativeIntegerSchema,
  compressionRatio: z.number().positive().finite(),
  deduplicationRatio: z.number().positive().finite(),
  databaseStatus: z.enum(["healthy", "warning", "critical"]),
  storageStatus: z.enum(["healthy", "warning", "critical"]),
  archiveStatus: z.enum(["healthy", "warning", "critical"]),
  siteProtection: z.literal("single-site"),
  offsiteProtected: z.literal(false),
});

export const projectSnapshotManifestSchema = z.object({
  schemaVersion: z.literal(dataArchiveSchemaVersion),
  runKey: safeKeySchema,
  projectRef: z.string().min(8).max(80).regex(/^[a-z0-9]+$/),
  startedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }),
  postgresVersion: z.string().min(1).max(80),
  postgresClientVersion: z.string().min(1).max(80),
  supabaseCliVersion: z.string().min(1).max(80),
  resticVersion: z.string().min(1).max(80),
  migrationSha256: checksumSchema,
  databaseExports: z.array(databaseExportSchema).min(5),
  storageInventory: storageInventorySchema,
  packages: z.array(archivePackageSchema),
  capacity: capacitySummarySchema,
});

export const backupReceiptPayloadSchema = z.object({
  schemaVersion: z.literal(dataArchiveSchemaVersion),
  runKey: safeKeySchema,
  nonce: z.string().min(16).max(128).regex(/^[a-zA-Z0-9._:-]+$/),
  issuedAt: z.string().datetime({ offset: true }),
  status: z.enum(["verified", "failed"]),
  projectRef: z.string().min(8).max(80).regex(/^[a-z0-9]+$/),
  postgresVersion: z.string().min(1).max(80),
  migrationSha256: checksumSchema,
  manifestSha256: checksumSchema.nullable(),
  resticSnapshotId: z.string().regex(/^[0-9a-f]{8,64}$/).nullable(),
  databaseBytes: nonNegativeIntegerSchema,
  storageBytes: nonNegativeIntegerSchema,
  storageObjectCount: nonNegativeIntegerSchema,
  databaseUsageBytes: nonNegativeIntegerSchema,
  storageUsageBytes: nonNegativeIntegerSchema,
  archiveAllocatedBytes: nonNegativeIntegerSchema,
  uniqueBytesAdded: nonNegativeIntegerSchema,
  compressionRatio: z.number().positive().finite(),
  deduplicationRatio: z.number().positive().finite(),
  integrityVerifiedAt: z.string().datetime({ offset: true }).nullable(),
  completedAt: z.string().datetime({ offset: true }),
  failureCode: z.string().min(2).max(128).regex(/^[a-z0-9._-]+$/).nullable(),
  packages: z.array(archivePackageSchema),
});

export const signedBackupReceiptSchema = z.object({
  payload: backupReceiptPayloadSchema,
  payloadSha256: checksumSchema,
  signature: checksumSchema,
});

export const packageVerificationReceiptPayloadSchema = z.object({
  schemaVersion: z.literal(dataArchiveSchemaVersion),
  receiptKind: z.literal("package-restore-verification"),
  requestKey: z.string().min(8).max(160).regex(/^[a-zA-Z0-9._:-]+$/),
  nonce: z.string().min(16).max(128).regex(/^[a-zA-Z0-9._:-]+$/),
  issuedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }),
  status: z.enum(["verified", "failed"]),
  projectRef: z.string().min(8).max(80).regex(/^[a-z0-9]+$/),
  packageKey: safeKeySchema,
  manifestSha256: checksumSchema,
  resticSnapshotId: z.string().regex(/^[0-9a-f]{8,64}$/),
  memberCount: z.number().int().positive().safe(),
  totalBytes: nonNegativeIntegerSchema,
  requestedByOwnerId: z.string().trim().min(1).max(255),
  failureCode: z.string().min(2).max(128).regex(/^[a-z0-9._-]+$/).nullable(),
}).superRefine((value, context) => {
  if (new Date(value.completedAt).getTime() < new Date(value.issuedAt).getTime()) {
    context.addIssue({ code: "custom", message: "completion cannot precede issuance" });
  }
  if (value.status === "verified" && value.failureCode !== null) {
    context.addIssue({ code: "custom", message: "verified receipt cannot have a failure code" });
  }
  if (value.status === "failed" && value.failureCode === null) {
    context.addIssue({ code: "custom", message: "failed receipt requires a failure code" });
  }
});

export const signedPackageVerificationReceiptSchema = z.object({
  payload: packageVerificationReceiptPayloadSchema,
  payloadSha256: checksumSchema,
  signature: checksumSchema,
});

export const prunePlanItemSchema = z.object({
  packageKey: safeKeySchema,
  itemKind: z.enum(["database-row-set", "storage-object"]),
  itemIdentifier: safeIdentifierSchema,
  sizeBytes: nonNegativeIntegerSchema,
  reasons: z.array(z.string().min(2).max(160)).min(1),
});

export const prunePlanSchema = z.object({
  schemaVersion: z.literal(dataArchiveSchemaVersion),
  planKey: safeKeySchema,
  generatedAt: z.string().datetime({ offset: true }),
  sourceStateSha256: checksumSchema,
  retentionPolicy: archiveApiRetentionPolicySchema,
  currentStorageBytes: nonNegativeIntegerSchema,
  plannedRemovalBytes: nonNegativeIntegerSchema,
  projectedStorageBytes: nonNegativeIntegerSchema,
  storageWarningBytes: z.literal(archiveStorageWarningBytes),
  storageCriticalBytes: z.literal(archiveStorageCriticalBytes),
  verificationRequiredPackageKeys: z.array(safeKeySchema),
  productionDeletionEnabled: z.literal(false),
  items: z.array(prunePlanItemSchema),
  itemCount: nonNegativeIntegerSchema,
  totalBytes: nonNegativeIntegerSchema,
}).superRefine((value, context) => {
  const itemBytes = value.items.reduce((total, item) => total + item.sizeBytes, 0);
  if (
    value.itemCount !== value.items.length ||
    value.totalBytes !== itemBytes ||
    value.plannedRemovalBytes !== itemBytes
  ) {
    context.addIssue({ code: "custom", message: "prune plan totals are inconsistent" });
  }
  if (
    value.projectedStorageBytes !==
      Math.max(0, value.currentStorageBytes - value.plannedRemovalBytes)
  ) {
    context.addIssue({ code: "custom", message: "prune plan projection is inconsistent" });
  }
  if (
    new Set(value.verificationRequiredPackageKeys).size !==
      value.verificationRequiredPackageKeys.length ||
    [...value.verificationRequiredPackageKeys].sort().some(
      (key, index) => key !== value.verificationRequiredPackageKeys[index],
    )
  ) {
    context.addIssue({
      code: "custom",
      message: "verification-required package keys must be sorted and unique",
    });
  }
});

export type StorageObject = z.infer<typeof storageObjectSchema>;
export type StorageInventory = z.infer<typeof storageInventorySchema>;
export type ArchivePackage = z.infer<typeof archivePackageSchema>;
export type ArchivePackageContent = z.infer<typeof archivePackageContentSchema>;
export type CapacitySummary = z.infer<typeof capacitySummarySchema>;
export type ProjectSnapshotManifest = z.infer<typeof projectSnapshotManifestSchema>;
export type BackupReceiptPayload = z.infer<typeof backupReceiptPayloadSchema>;
export type SignedBackupReceipt = z.infer<typeof signedBackupReceiptSchema>;
export type PackageVerificationReceiptPayload = z.infer<
  typeof packageVerificationReceiptPayloadSchema
>;
export type SignedPackageVerificationReceipt = z.infer<
  typeof signedPackageVerificationReceiptSchema
>;
export type PrunePlan = z.infer<typeof prunePlanSchema>;
export type ArchiveApiRetentionPlanPolicy = z.infer<
  typeof archiveApiRetentionPolicySchema
>;

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalValue(child)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalValue(value))}\n`;
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalSha256(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export function normalizeStorageInventory(input: {
  capturedAt: string;
  objects: StorageObject[];
}): StorageInventory {
  const objects = [...input.objects].sort((left, right) =>
    `${left.bucket}\u0000${left.path}`.localeCompare(`${right.bucket}\u0000${right.path}`),
  );
  const uniqueKeys = new Set(objects.map((item) => `${item.bucket}\u0000${item.path}`));
  if (uniqueKeys.size !== objects.length) {
    throw new Error("storage_inventory_duplicate_object");
  }
  return storageInventorySchema.parse({
    schemaVersion: dataArchiveSchemaVersion,
    capturedAt: input.capturedAt,
    objects,
    objectCount: objects.length,
    totalBytes: objects.reduce((total, item) => total + item.sizeBytes, 0),
  });
}

export function reconcileStorageInventories(input: {
  before: StorageInventory;
  after: StorageInventory;
  copied: StorageObject[];
}): StorageInventory {
  const after = storageInventorySchema.parse(input.after);
  const copiedByKey = new Map(
    input.copied.map((object) => [`${object.bucket}\u0000${object.path}`, object]),
  );
  const changedDuringRun = canonicalSha256(input.before.objects) !== canonicalSha256(after.objects);

  for (const expected of after.objects) {
    const copied = copiedByKey.get(`${expected.bucket}\u0000${expected.path}`);
    if (
      !copied ||
      copied.sizeBytes !== expected.sizeBytes ||
      copied.localSha256 !== expected.localSha256
    ) {
      throw new Error(
        changedDuringRun
          ? "storage_inventory_changed_and_copy_incomplete"
          : "storage_inventory_copy_mismatch",
      );
    }
  }
  if (copiedByKey.size !== after.objects.length) {
    throw new Error("storage_inventory_unexpected_local_object");
  }
  return after;
}

export function contentAddressedPackagePath(input: {
  kind: z.infer<typeof archivePackageKindSchema>;
  sourceIdentifier: string;
  sha256: string;
}): string {
  return `packages/${contentAddressedPackageKey(input)}`;
}

export function contentAddressedPackageKey(input: {
  kind: z.infer<typeof archivePackageKindSchema>;
  sourceIdentifier: string;
  sha256: string;
}): string {
  const safeIdentifier = input.sourceIdentifier.replace(/[^a-zA-Z0-9._-]/g, "_");
  const checksum = checksumSchema.parse(input.sha256);
  if (!safeIdentifier || safeIdentifier.length > 160) {
    throw new Error("archive_source_identifier_invalid");
  }
  return `${input.kind}/${safeIdentifier}/${checksum}`;
}

export function buildArchivePackageContent(input: {
  packageKind: z.infer<typeof archivePackageKindSchema>;
  sourceIdentifier: string;
  sourceCreatedAt: string;
  sourceIdentity: unknown;
  members: z.infer<typeof archivePackageMemberSchema>[];
  rowCount: number;
}): ArchivePackageContent {
  const members = [...input.members].sort((left, right) =>
    [left.kind, left.sourceTable ?? "", left.sourceIdentifier ?? "", left.storageBucket ?? "", left.storageObjectPath ?? ""]
      .join("\u0000")
      .localeCompare(
        [right.kind, right.sourceTable ?? "", right.sourceIdentifier ?? "", right.storageBucket ?? "", right.storageObjectPath ?? ""].join("\u0000"),
      ),
  );
  const sourceSha256 = canonicalSha256({
    sourceIdentity: input.sourceIdentity,
    members,
  });
  return archivePackageContentSchema.parse({
    schemaVersion: dataArchiveSchemaVersion,
    packageKey: contentAddressedPackageKey({
      kind: input.packageKind,
      sourceIdentifier: input.sourceIdentifier,
      sha256: sourceSha256,
    }),
    packageKind: input.packageKind,
    sourceIdentifier: input.sourceIdentifier,
    sourceCreatedAt: input.sourceCreatedAt,
    sourceSha256,
    members,
    rowCount: input.rowCount,
    objectCount: members.filter((member) => member.storageObjectPath !== null).length,
    sizeBytes: members.reduce((total, member) => total + member.sizeBytes, 0),
  });
}

export function buildCapacitySummary(input: {
  databaseBytes: number;
  storageBytes: number;
  archiveAllocatedBytes: number;
  archiveUniqueBytes: number;
  uniqueBytesAdded: number;
  compressionRatio: number;
  deduplicationRatio: number;
}): CapacitySummary {
  const status = (bytes: number, warning: number, critical: number) =>
    bytes >= critical ? "critical" : bytes >= warning ? "warning" : "healthy";
  return capacitySummarySchema.parse({
    ...input,
    databaseStatus: status(input.databaseBytes, 350 * 1024 ** 2, 425 * 1024 ** 2),
    storageStatus: status(
      input.storageBytes,
      archiveStorageWarningBytes,
      archiveStorageCriticalBytes,
    ),
    archiveStatus: status(
      input.archiveAllocatedBytes,
      40 * 1024 ** 3,
      45 * 1024 ** 3,
    ),
    siteProtection: "single-site",
    offsiteProtected: false,
  });
}

export function signBackupReceipt(
  payload: BackupReceiptPayload,
  signingKey: string,
): SignedBackupReceipt {
  if (signingKey.length < 32) throw new Error("archive_signing_key_too_short");
  const parsed = backupReceiptPayloadSchema.parse(payload);
  const serialized = canonicalJson(parsed);
  const payloadSha256 = sha256Hex(serialized);
  const signature = createHmac("sha256", signingKey).update(serialized).digest("hex");
  return signedBackupReceiptSchema.parse({ payload: parsed, payloadSha256, signature });
}

export function verifyBackupReceipt(
  receipt: SignedBackupReceipt,
  signingKey: string,
): BackupReceiptPayload {
  const parsed = signedBackupReceiptSchema.parse(receipt);
  const serialized = canonicalJson(parsed.payload);
  const expectedPayloadSha256 = sha256Hex(serialized);
  const expectedSignature = createHmac("sha256", signingKey).update(serialized).digest();
  const actualSignature = Buffer.from(parsed.signature, "hex");
  if (
    parsed.payloadSha256 !== expectedPayloadSha256 ||
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw new Error("archive_receipt_signature_invalid");
  }
  return parsed.payload;
}

export function signPackageVerificationReceipt(
  payload: PackageVerificationReceiptPayload,
  signingKey: string,
): SignedPackageVerificationReceipt {
  if (signingKey.length < 32) throw new Error("archive_signing_key_too_short");
  const parsed = packageVerificationReceiptPayloadSchema.parse(payload);
  const serialized = canonicalJson(parsed);
  const payloadSha256 = sha256Hex(serialized);
  const signature = createHmac("sha256", signingKey).update(serialized).digest("hex");
  return signedPackageVerificationReceiptSchema.parse({
    payload: parsed,
    payloadSha256,
    signature,
  });
}

export function verifyPackageVerificationReceipt(
  receipt: SignedPackageVerificationReceipt,
  signingKey: string,
): PackageVerificationReceiptPayload {
  const parsed = signedPackageVerificationReceiptSchema.parse(receipt);
  const serialized = canonicalJson(parsed.payload);
  const expectedPayloadSha256 = sha256Hex(serialized);
  const expectedSignature = createHmac("sha256", signingKey).update(serialized).digest();
  const actualSignature = Buffer.from(parsed.signature, "hex");
  if (
    parsed.payloadSha256 !== expectedPayloadSha256 ||
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw new Error("archive_verification_receipt_signature_invalid");
  }
  return parsed.payload;
}
