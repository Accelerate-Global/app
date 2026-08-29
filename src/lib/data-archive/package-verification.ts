import { randomUUID } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import {
  archivePackageContentSchema,
  archivePackageSchema,
  canonicalSha256,
  signPackageVerificationReceipt,
  type ArchivePackageContent,
  type PackageVerificationReceiptPayload,
} from "./canonical";
import type { ArchiveWorkerConfig } from "./config";
import {
  archiveFetch,
  type ArchiveFetch,
} from "./http-client";
import {
  assertRestrictedPath,
  runArchiveCommand,
  safeStorageObjectPath,
  sha256File,
  withExclusiveArchiveWorkspace,
  type ArchiveCommand,
  type CommandResult,
} from "./backup-engine";

const checksumSchema = z.string().regex(/^[0-9a-f]{64}$/);
const packageVerificationMemberSchema = z.object({
  memberKind: z.string().min(2).max(80),
  storageBucket: z.string().min(1).max(100),
  storageObjectName: z.string().min(1).max(1024),
  contentChecksum: checksumSchema,
  sizeBytes: z.coerce.number().int().nonnegative().safe(),
});

export const apiRunPackageVerificationCandidateSchema = z.object({
  packageKey: archivePackageSchema.shape.packageKey,
  packageKind: z.literal("api-run"),
  packageStatus: z.enum(["verified", "cold", "rehydrating", "rehydrated", "failed"]),
  sourceChecksum: checksumSchema,
  manifestChecksum: checksumSchema,
  archiveSnapshotId: z.string().regex(/^[0-9a-f]{8,64}$/),
  sizeBytes: z.coerce.number().int().nonnegative().safe(),
  members: z.array(packageVerificationMemberSchema).min(1),
});

export type ApiRunPackageVerificationCandidate = z.infer<
  typeof apiRunPackageVerificationCandidateSchema
>;

export type PackageVerificationDependencies = {
  runCommand: (command: ArchiveCommand) => Promise<CommandResult>;
  fetchImpl: ArchiveFetch;
  now: () => Date;
};

export const defaultPackageVerificationDependencies: PackageVerificationDependencies = {
  runCommand: runArchiveCommand,
  fetchImpl: archiveFetch,
  now: () => new Date(),
};

function databaseCommand(
  config: ArchiveWorkerConfig,
  args: string[],
): ArchiveCommand {
  return { command: "psql", args, env: config.databaseEnvironment };
}

export function packageVerificationCatalogSql(packageKey: string): string {
  const safePackageKey = archivePackageSchema.shape.packageKey.parse(packageKey);
  return `
    select jsonb_build_object(
      'packageKey', package.package_key,
      'packageKind', package.package_kind,
      'packageStatus', package.status,
      'sourceChecksum', package.source_checksum,
      'manifestChecksum', package.manifest_checksum,
      'archiveSnapshotId', package.archive_snapshot_id,
      'sizeBytes', package.size_bytes,
      'members', coalesce(jsonb_agg(jsonb_build_object(
        'memberKind', member.member_kind,
        'storageBucket', member.storage_bucket,
        'storageObjectName', member.storage_object_name,
        'contentChecksum', member.content_checksum,
        'sizeBytes', member.size_bytes
      ) order by member.member_kind, member.storage_bucket, member.storage_object_name)
        filter (where member.id is not null), '[]'::jsonb)
    )::text
    from private.data_archive_packages as package
    left join private.data_archive_package_members as member on member.package_id = package.id
    where package.package_key = '${safePackageKey}'
    group by package.id
  `.trim();
}

export function parseApiRunPackageVerificationCandidate(
  value: string,
): ApiRunPackageVerificationCandidate {
  const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length !== 1) throw new Error("archive_verification_package_not_found");
  const candidate = apiRunPackageVerificationCandidateSchema.parse(JSON.parse(lines[0]!));
  if (candidate.packageStatus !== "verified") {
    throw new Error("archive_verification_package_not_hot_verified");
  }
  if (candidate.members.some(
    (member) => !member.storageBucket || !member.storageObjectName,
  )) {
    throw new Error("archive_verification_storage_member_invalid");
  }
  return candidate;
}

export async function loadApiRunPackageVerificationCandidate(input: {
  config: ArchiveWorkerConfig;
  packageKey: string;
  dependencies?: PackageVerificationDependencies;
}): Promise<ApiRunPackageVerificationCandidate> {
  const packageKey = archivePackageSchema.shape.packageKey.parse(input.packageKey);
  const dependencies = input.dependencies ?? defaultPackageVerificationDependencies;
  const result = await dependencies.runCommand(databaseCommand(input.config, [
    "-X",
    "--no-psqlrc",
    "--tuples-only",
    "--no-align",
    "--command",
    packageVerificationCatalogSql(packageKey),
  ]));
  return parseApiRunPackageVerificationCandidate(result.stdout);
}

async function findRestoredPackageDirectory(root: string, packageKey: string) {
  const suffix = join("archive-packages", packageKey);
  const matches: string[] = [];
  async function visit(directory: string) {
    if (directory.endsWith(suffix)) {
      matches.push(directory);
      return;
    }
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await visit(join(directory, entry.name));
    }
  }
  await visit(root);
  if (matches.length !== 1) throw new Error("archive_verification_package_restore_ambiguous");
  return matches[0]!;
}

function catalogMemberState(candidate: ApiRunPackageVerificationCandidate) {
  return candidate.members.map((member) => ({
    kind: member.memberKind,
    storageBucket: member.storageBucket,
    storageObjectPath: member.storageObjectName,
    sha256: member.contentChecksum,
    sizeBytes: member.sizeBytes,
  })).sort((left, right) =>
    `${left.kind}\u0000${left.storageBucket}\u0000${left.storageObjectPath}`.localeCompare(
      `${right.kind}\u0000${right.storageBucket}\u0000${right.storageObjectPath}`,
    ),
  );
}

function packageMemberState(content: ArchivePackageContent) {
  return content.members.map((member) => ({
    kind: member.kind,
    storageBucket: member.storageBucket,
    storageObjectPath: member.storageObjectPath,
    sha256: member.sha256,
    sizeBytes: member.sizeBytes,
  })).sort((left, right) =>
    `${left.kind}\u0000${left.storageBucket}\u0000${left.storageObjectPath}`.localeCompare(
      `${right.kind}\u0000${right.storageBucket}\u0000${right.storageObjectPath}`,
    ),
  );
}

export async function verifyRestoredApiRunPackageDirectory(input: {
  packageDirectory: string;
  candidate: ApiRunPackageVerificationCandidate;
}): Promise<{ memberCount: number; totalBytes: number }> {
  const content = archivePackageContentSchema.parse(
    JSON.parse(await readFile(join(input.packageDirectory, "package.json"), "utf8")),
  );
  if (
    content.packageKind !== "api-run" ||
    content.packageKey !== input.candidate.packageKey ||
    content.sourceSha256 !== input.candidate.sourceChecksum ||
    canonicalSha256({
      ...content,
      archiveSnapshotId: input.candidate.archiveSnapshotId,
    }) !== input.candidate.manifestChecksum
  ) {
    throw new Error("archive_verification_manifest_mismatch");
  }
  if (
    canonicalSha256(packageMemberState(content)) !==
      canonicalSha256(catalogMemberState(input.candidate)) ||
    content.members.length !== input.candidate.members.length ||
    content.sizeBytes !== input.candidate.sizeBytes
  ) {
    throw new Error("archive_verification_catalog_member_mismatch");
  }
  for (const member of content.members) {
    if (!member.storageBucket || !member.storageObjectPath) {
      throw new Error("archive_verification_storage_member_invalid");
    }
    const path = safeStorageObjectPath(
      join(input.packageDirectory, "objects"),
      member.storageBucket,
      member.storageObjectPath,
    );
    const details = await stat(path);
    if (details.size !== member.sizeBytes || (await sha256File(path)) !== member.sha256) {
      throw new Error("archive_verification_member_checksum_mismatch");
    }
  }
  return {
    memberCount: content.members.length,
    totalBytes: content.sizeBytes,
  };
}

export async function restoreAndVerifyApiRunPackage(input: {
  config: ArchiveWorkerConfig;
  candidate: ApiRunPackageVerificationCandidate;
  dependencies?: PackageVerificationDependencies;
}) {
  const dependencies = input.dependencies ?? defaultPackageVerificationDependencies;
  return withExclusiveArchiveWorkspace({
    lockPath: join(input.config.stateDirectory, "package-verification.lock"),
    parentDirectory: input.config.stagingDirectory,
    action: async (workspace) => {
      await dependencies.runCommand({
        command: "restic",
        args: [
          "restore",
          input.candidate.archiveSnapshotId,
          "--target",
          workspace.directory,
          "--include",
          `*/archive-packages/${input.candidate.packageKey}/**`,
        ],
        env: input.config.resticEnvironment,
      });
      await assertRestrictedPath(workspace.directory);
      const packageDirectory = await findRestoredPackageDirectory(
        workspace.directory,
        input.candidate.packageKey,
      );
      return verifyRestoredApiRunPackageDirectory({
        packageDirectory,
        candidate: input.candidate,
      });
    },
  });
}

export function normalizePackageVerificationFailure(error: unknown): string {
  return (error instanceof Error ? error.message : "package-verification-failed")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 128) || "package-verification-failed";
}

export function buildPackageVerificationReceiptPayload(input: {
  config: ArchiveWorkerConfig;
  candidate: ApiRunPackageVerificationCandidate;
  requestKey: string;
  requestedByOwnerId: string;
  completedAt: Date;
  status: "verified" | "failed";
  failureCode: string | null;
}): PackageVerificationReceiptPayload {
  const completedAt = input.completedAt.toISOString();
  return {
    schemaVersion: 1,
    receiptKind: "package-restore-verification",
    requestKey: input.requestKey,
    nonce: `verify:${input.completedAt.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}:${randomUUID()}`,
    issuedAt: completedAt,
    completedAt,
    status: input.status,
    projectRef: input.config.projectRef,
    packageKey: input.candidate.packageKey,
    manifestSha256: input.candidate.manifestChecksum,
    resticSnapshotId: input.candidate.archiveSnapshotId,
    memberCount: input.candidate.members.length,
    totalBytes: input.candidate.sizeBytes,
    requestedByOwnerId: input.requestedByOwnerId,
    failureCode: input.failureCode,
  };
}

export async function submitPackageVerificationReceipt(input: {
  config: ArchiveWorkerConfig;
  payload: PackageVerificationReceiptPayload;
  dependencies?: PackageVerificationDependencies;
}) {
  const dependencies = input.dependencies ?? defaultPackageVerificationDependencies;
  const signingKey = (await readFile(input.config.receiptKeyFile, "utf8")).trim();
  const receipt = signPackageVerificationReceipt(input.payload, signingKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await dependencies.fetchImpl(input.config.receiptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(receipt),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`archive_verification_receipt_http_${response.status}`);
    }
    const result = (await response.json()) as { ok?: unknown };
    if (result.ok !== true) throw new Error("archive_verification_receipt_invalid_response");
  } finally {
    clearTimeout(timeout);
  }
}
