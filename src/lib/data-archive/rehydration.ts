import { and, desc, eq } from "drizzle-orm";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { getDb } from "@/db";
import {
  apiConnectionRunOutputs,
  dataArchivePackageMembers,
  dataArchivePackages,
  dataArchiveRehydrations,
} from "@/db/schema";
import {
  parseApiConnectionRawChunkManifest,
  parseApiConnectionRowsChunkManifest,
} from "@/lib/api-connection-output";

import {
  archivePackageContentSchema,
  canonicalSha256,
  sha256Hex,
  type ArchivePackageContent,
} from "./canonical";
import type { ArchiveWorkerConfig } from "./config";
import {
  assertRestrictedPath,
  runArchiveCommand,
  safeStorageObjectPath,
  sha256File,
  withExclusiveArchiveWorkspace,
} from "./backup-engine";
import { archiveFetch, type ArchiveFetch } from "./http-client";

export type RehydratedUpload = {
  memberKind: string;
  bucket: string;
  originalPath: string;
  targetPath: string;
  contentType: string;
  body: Uint8Array;
  sha256: string;
};

type RehydrationStorageEnvironment = Partial<Pick<
  NodeJS.ProcessEnv,
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "SUPABASE_URL"
  | "SUPABASE_SECRET_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
>>;

export type RehydrationStorageDependencies = {
  fetchImpl: ArchiveFetch;
  environment: RehydrationStorageEnvironment;
};

const defaultRehydrationStorageDependencies: RehydrationStorageDependencies = {
  fetchImpl: archiveFetch,
  environment: process.env as RehydrationStorageEnvironment,
};

function encodeStoragePath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

function storageAdminConfiguration(environment: RehydrationStorageEnvironment) {
  const rawUrl = environment.NEXT_PUBLIC_SUPABASE_URL ?? environment.SUPABASE_URL;
  const serviceKey = environment.SUPABASE_SECRET_KEY ?? environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !serviceKey) {
    throw new Error("archive_rehydration_storage_admin_configuration_missing");
  }
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("archive_rehydration_storage_admin_url_invalid");
  }
  return {
    baseUrl: `${url.origin}/storage/v1`,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
    },
  };
}

function storageObjectUrl(baseUrl: string, bucket: string, path?: string) {
  const suffix = path ? `/${encodeStoragePath(path)}` : "";
  return `${baseUrl}/object/${encodeURIComponent(bucket)}${suffix}`;
}

export async function uploadRehydratedStorageObject(
  input: RehydratedUpload,
  dependencies: RehydrationStorageDependencies = defaultRehydrationStorageDependencies,
) {
  const config = storageAdminConfiguration(dependencies.environment);
  const url = storageObjectUrl(config.baseUrl, input.bucket, input.targetPath);
  const uploaded = await dependencies.fetchImpl(url, {
    method: "POST",
    headers: {
      ...config.headers,
      "content-length": String(input.body.byteLength),
      "content-type": input.contentType,
      "x-upsert": "false",
    },
    body: input.body,
  });
  if (uploaded.ok) return;
  const retained = await dependencies.fetchImpl(url, {
    method: "GET",
    headers: config.headers,
    maxResponseBytes: input.body.byteLength,
  });
  if (!retained.ok) {
    throw new Error(`archive_rehydration_storage_upload_http_${uploaded.status}`);
  }
  const body = new Uint8Array(await retained.arrayBuffer());
  if (sha256Hex(body) !== input.sha256) {
    throw new Error("archive_rehydration_target_conflict");
  }
}

export async function removeRehydratedStorageObject(
  input: Pick<RehydratedUpload, "bucket" | "targetPath">,
  dependencies: RehydrationStorageDependencies = defaultRehydrationStorageDependencies,
) {
  const config = storageAdminConfiguration(dependencies.environment);
  const body = JSON.stringify({ prefixes: [input.targetPath] });
  const removed = await dependencies.fetchImpl(
    storageObjectUrl(config.baseUrl, input.bucket),
    {
      method: "DELETE",
      headers: {
        ...config.headers,
        "content-length": String(Buffer.byteLength(body)),
        "content-type": "application/json",
      },
      body,
    },
  );
  if (!removed.ok) {
    throw new Error(`archive_rehydration_storage_delete_http_${removed.status}`);
  }
}

export function buildApiRunRehydratedUploads(input: {
  packageContent: ArchivePackageContent;
  bodies: Map<string, Uint8Array>;
  requestKey: string;
}) {
  if (input.packageContent.packageKind !== "api-run") {
    throw new Error("archive_rehydration_package_kind_unsupported");
  }
  const safeRequest = input.requestKey.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safeRequest || safeRequest.length > 160) {
    throw new Error("archive_rehydration_request_key_invalid");
  }
  const targetByOriginal = new Map(
    input.packageContent.members.map((member) => [
      member.storageObjectPath!,
      `rehydrated/${safeRequest}/${member.storageObjectPath}`,
    ]),
  );
  const uploads: RehydratedUpload[] = [];
  for (const member of input.packageContent.members) {
    if (!member.storageBucket || !member.storageObjectPath) {
      throw new Error("archive_rehydration_storage_member_invalid");
    }
    const original = input.bodies.get(
      `${member.storageBucket}\u0000${member.storageObjectPath}`,
    );
    if (!original || sha256Hex(original) !== member.sha256) {
      throw new Error("archive_rehydration_member_checksum_mismatch");
    }
    let body = original;
    if (member.kind === "rows-manifest" || member.kind === "raw-manifest") {
      const text = Buffer.from(original).toString("utf8");
      const manifest = member.kind === "rows-manifest"
        ? parseApiConnectionRowsChunkManifest(text)
        : parseApiConnectionRawChunkManifest(text);
      if (manifest) {
        body = Buffer.from(JSON.stringify({
          ...manifest,
          chunks: manifest.chunks.map((chunk) => {
            const targetPath = targetByOriginal.get(chunk.path);
            if (!targetPath) throw new Error("archive_rehydration_chunk_member_missing");
            return { ...chunk, path: targetPath };
          }),
        }));
      }
    }
    uploads.push({
      memberKind: member.kind,
      bucket: member.storageBucket,
      originalPath: member.storageObjectPath,
      targetPath: targetByOriginal.get(member.storageObjectPath)!,
      contentType: member.contentType ?? "application/octet-stream",
      body,
      sha256: sha256Hex(body),
    });
  }
  uploads.sort((left, right) => {
    const leftManifest = left.memberKind.endsWith("manifest") ? 1 : 0;
    const rightManifest = right.memberKind.endsWith("manifest") ? 1 : 0;
    return leftManifest - rightManifest || left.targetPath.localeCompare(right.targetPath);
  });
  const rows = uploads.find((upload) => upload.memberKind === "rows-manifest");
  const raw = uploads.find((upload) => upload.memberKind === "raw-manifest");
  if (!rows || !raw) throw new Error("archive_rehydration_output_manifest_missing");
  return { uploads, rows, raw };
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
  if (matches.length !== 1) throw new Error("archive_rehydration_package_restore_ambiguous");
  return matches[0]!;
}

export async function rehydrateApiRunPackage(input: {
  config: ArchiveWorkerConfig;
  packageKey: string;
  requestKey: string;
  requestedByOwnerId: string;
  storageDependencies?: RehydrationStorageDependencies;
}) {
  if (!/^[a-zA-Z0-9._:-]{8,160}$/.test(input.requestKey)) {
    throw new Error("archive_rehydration_request_key_invalid");
  }
  const db = getDb();
  const [archivePackage] = await db
    .select()
    .from(dataArchivePackages)
    .where(eq(dataArchivePackages.packageKey, input.packageKey))
    .orderBy(desc(dataArchivePackages.sourceCreatedAt))
    .limit(1);
  if (!archivePackage || archivePackage.packageKind !== "api-run") {
    throw new Error("archive_rehydration_package_not_found");
  }
  if (archivePackage.status === "rehydrated") {
    return { packageId: archivePackage.id, replayed: true };
  }
  if (archivePackage.status !== "cold") {
    throw new Error("archive_rehydration_package_not_cold");
  }
  const [existing] = await db
    .select()
    .from(dataArchiveRehydrations)
    .where(eq(dataArchiveRehydrations.requestKey, input.requestKey))
    .limit(1);
  if (existing?.status === "verified") {
    if (existing.packageId !== archivePackage.id) {
      throw new Error("archive_rehydration_request_conflict");
    }
    return { packageId: archivePackage.id, replayed: true };
  }
  if (!existing) {
    await db.insert(dataArchiveRehydrations).values({
      requestKey: input.requestKey,
      packageId: archivePackage.id,
      status: "restoring",
      targetIdentifier: `api-run:${archivePackage.sourceIdentifier}:${input.requestKey}`.slice(0, 240),
      manifestChecksum: archivePackage.manifestChecksum,
      requestedByOwnerId: input.requestedByOwnerId,
    });
  } else if (existing.packageId !== archivePackage.id) {
    throw new Error("archive_rehydration_request_conflict");
  } else {
    await db
      .update(dataArchiveRehydrations)
      .set({ status: "restoring", completedAt: null, failureCode: null, updatedAt: new Date() })
      .where(eq(dataArchiveRehydrations.id, existing.id));
  }

  return withExclusiveArchiveWorkspace({
    lockPath: join(input.config.stateDirectory, "rehydration.lock"),
    parentDirectory: input.config.stagingDirectory,
    action: async (workspace) => {
      const uploaded: RehydratedUpload[] = [];
      try {
        await runArchiveCommand({
          command: "restic",
          args: [
            "restore",
            archivePackage.archiveSnapshotId,
            "--target",
            workspace.directory,
            "--include",
            `*/archive-packages/${archivePackage.packageKey}/**`,
          ],
          env: input.config.resticEnvironment,
        });
        const packageDirectory = await findRestoredPackageDirectory(
          workspace.directory,
          archivePackage.packageKey,
        );
        await assertRestrictedPath(workspace.directory);
        const content = archivePackageContentSchema.parse(
          JSON.parse(await readFile(join(packageDirectory, "package.json"), "utf8")),
        );
        if (
          content.packageKey !== archivePackage.packageKey ||
          content.sourceSha256 !== archivePackage.sourceChecksum ||
          canonicalSha256({ ...content, archiveSnapshotId: archivePackage.archiveSnapshotId }) !==
            archivePackage.manifestChecksum
        ) {
          throw new Error("archive_rehydration_manifest_mismatch");
        }
        const bodies = new Map<string, Uint8Array>();
        for (const member of content.members) {
          const path = safeStorageObjectPath(
            join(packageDirectory, "objects"),
            member.storageBucket!,
            member.storageObjectPath!,
          );
          const details = await stat(path);
          if (details.size !== member.sizeBytes || (await sha256File(path)) !== member.sha256) {
            throw new Error("archive_rehydration_member_checksum_mismatch");
          }
          bodies.set(
            `${member.storageBucket}\u0000${member.storageObjectPath}`,
            new Uint8Array(await readFile(path)),
          );
        }
        const prepared = buildApiRunRehydratedUploads({
          packageContent: content,
          bodies,
          requestKey: input.requestKey,
        });
        for (const upload of prepared.uploads) {
          await uploadRehydratedStorageObject(
            upload,
            input.storageDependencies,
          );
          uploaded.push(upload);
        }
        await db.transaction(async (tx) => {
          const [lockedPackage] = await tx
            .select()
            .from(dataArchivePackages)
            .where(eq(dataArchivePackages.id, archivePackage.id))
            .limit(1)
            .for("update");
          if (!lockedPackage || lockedPackage.status !== "cold") {
            throw new Error("archive_rehydration_package_state_changed");
          }
          const [output] = await tx
            .select()
            .from(apiConnectionRunOutputs)
            .where(eq(apiConnectionRunOutputs.runId, archivePackage.sourceIdentifier))
            .limit(1)
            .for("update");
          if (!output) throw new Error("archive_rehydration_output_missing");
          await tx
            .update(apiConnectionRunOutputs)
            .set({
              rowsStoragePath: prepared.rows.targetPath,
              rawStoragePath: prepared.raw.targetPath,
              rowsSizeBytes: prepared.rows.body.byteLength,
              rawSizeBytes: prepared.raw.body.byteLength,
              rowsChecksum: prepared.rows.sha256,
              rawChecksum: prepared.raw.sha256,
            })
            .where(eq(apiConnectionRunOutputs.id, output.id));
          for (const upload of prepared.uploads) {
            await tx
              .update(dataArchivePackageMembers)
              .set({
                hotState: "rehydrated",
                rehydratedStorageObjectName: upload.targetPath,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(dataArchivePackageMembers.packageId, archivePackage.id),
                  eq(dataArchivePackageMembers.storageBucket, upload.bucket),
                  eq(dataArchivePackageMembers.storageObjectName, upload.originalPath),
                ),
              );
          }
          await tx
            .update(dataArchiveRehydrations)
            .set({ status: "verified", completedAt: new Date(), updatedAt: new Date() })
            .where(eq(dataArchiveRehydrations.requestKey, input.requestKey));
          await tx
            .update(dataArchivePackages)
            .set({ status: "rehydrated", rehydratedAt: new Date(), updatedAt: new Date() })
            .where(eq(dataArchivePackages.id, archivePackage.id));
        });
        return { packageId: archivePackage.id, replayed: false };
      } catch (error) {
        for (const upload of uploaded.reverse()) {
          await removeRehydratedStorageObject(
            upload,
            input.storageDependencies,
          )
            .catch(() => undefined);
        }
        await db
          .update(dataArchiveRehydrations)
          .set({
            status: "failed",
            completedAt: new Date(),
            failureCode: "rehydration-failed",
            updatedAt: new Date(),
          })
          .where(eq(dataArchiveRehydrations.requestKey, input.requestKey));
        throw error;
      }
    },
  });
}
