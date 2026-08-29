import { randomUUID } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import {
  archivePackageSchema,
  buildArchivePackageContent,
  buildCapacitySummary,
  canonicalJson,
  canonicalSha256,
  projectSnapshotManifestSchema,
  signBackupReceipt,
  type BackupReceiptPayload,
  type ArchivePackage,
  type ArchivePackageContent,
  type ProjectSnapshotManifest,
  type StorageObject,
} from "./canonical";
import {
  parseApiConnectionRawChunkManifest,
  parseApiConnectionRowsChunkManifest,
} from "@/lib/api-connection-output";
import type { ArchiveWorkerConfig } from "./config";
import {
  assertArchiveTreeReachability,
  assertRestrictedPath,
  readJsonFile,
  reconcileVerifiedCopies,
  resticBackupArgs,
  resticRetentionArgs,
  runArchiveCommand,
  safeStorageObjectPath,
  sha256File,
  verifyStorageCopy,
  withExclusiveArchiveWorkspace,
  writeCanonicalFile,
  type ArchiveCommand,
  type ArchiveRunWorkspace,
  type CommandResult,
} from "./backup-engine";

type ManagedExportRow = {
  source_table: string;
  source_ordinal: number;
  row_data: Record<string, unknown>;
};

type ProviderObject = Omit<StorageObject, "localSha256">;

type ResticBackupSummary = {
  snapshotId: string;
  dataAdded: number;
  totalBytesProcessed: number;
};

type ApiRunPackageCandidate = {
  runId: string;
  connectionId: string;
  sourceCreatedAt: string;
  rowCount: number;
  rowsStoragePath: string;
  rawStoragePath: string;
  rowsChecksum: string | null;
  rawChecksum: string | null;
};

type DatasetVersionPackageCandidate = {
  versionId: string;
  datasetId: string;
  sourceCreatedAt: string;
  rowCount: number;
  fileName: string;
  blobPath: string;
  action: string;
  status: string;
  columns: unknown;
};

type PipelineArtifactCandidate = {
  kind: string;
  storagePath: string;
  contentChecksum: string;
  sizeBytes: number;
};

type PipelinePublicationPackageCandidate = {
  publicationId: string;
  producerKind: string;
  producerRunId: string;
  datasetId: string;
  sourceCreatedAt: string;
  outputChecksum: string;
  rowCount: number;
  publicationTargetKey: string | null;
  datasetBlobPath: string;
  artifacts: PipelineArtifactCandidate[];
};

export type ArchiveRunnerDependencies = {
  runCommand: (command: ArchiveCommand) => Promise<CommandResult>;
  fetchImpl: typeof fetch;
  now: () => Date;
};

const defaultDependencies: ArchiveRunnerDependencies = {
  runCommand: runArchiveCommand,
  fetchImpl: fetch,
  now: () => new Date(),
};

const managedExportSql = (schema: "auth" | "storage") =>
  `copy (select jsonb_build_object('source_table', source_table, 'source_ordinal', source_ordinal, 'row_data', row_data)::text from private.data_archive_export_managed_rows('${schema}')) to stdout`;

function databaseCommand(
  config: ArchiveWorkerConfig,
  command: string,
  args: string[],
  stdoutPath?: string,
): ArchiveCommand {
  return {
    command,
    args,
    stdoutPath,
    env: config.databaseEnvironment,
  };
}

function resticCommand(config: ArchiveWorkerConfig, args: string[]): ArchiveCommand {
  return { command: "restic", args, env: config.resticEnvironment };
}

async function assertSecretFiles(config: ArchiveWorkerConfig): Promise<void> {
  for (const path of [
    config.databaseEnvironment.PGPASSFILE,
    config.resticEnvironment.RESTIC_PASSWORD_FILE,
    config.receiptKeyFile,
    config.storageAuthEmailFile,
    config.storageAuthPasswordFile,
    config.supabaseAnonKeyFile,
    config.directAlertCredentialFiles.apiKey,
    config.directAlertCredentialFiles.sender,
    config.directAlertCredentialFiles.recipient,
  ]) {
    if (!path) throw new Error("archive_required_secret_file_missing");
    await assertRestrictedPath(path);
  }
}

export function parseManagedExport(value: string): ManagedExportRow[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ManagedExportRow);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function numericSize(value: unknown): number {
  const result = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error("storage_metadata_size_invalid");
  }
  return result;
}

export function extractProviderStorageInventory(rows: ManagedExportRow[]): {
  buckets: string[];
  objects: ProviderObject[];
} {
  const buckets = rows
    .filter((row) => row.source_table === "buckets")
    .map((row) => String(row.row_data.id ?? ""))
    .filter((bucket) => /^[a-z0-9][a-z0-9._-]*$/.test(bucket))
    .sort();
  const objects = rows
    .filter((row) => row.source_table === "objects")
    .map((row): ProviderObject => {
      const metadata =
        row.row_data.metadata && typeof row.row_data.metadata === "object"
          ? (row.row_data.metadata as Record<string, unknown>)
          : {};
      const bucket = String(row.row_data.bucket_id ?? "");
      const path = String(row.row_data.name ?? "");
      safeStorageObjectPath("/archive-storage-validation", bucket, path);
      return {
        bucket,
        path,
        version: nullableString(row.row_data.version),
        sizeBytes: numericSize(metadata.size ?? row.row_data.size),
        contentType: nullableString(metadata.mimetype ?? row.row_data.metadata_mimetype),
        providerEtag: nullableString(metadata.eTag ?? metadata.etag),
        lastModified: nullableString(row.row_data.updated_at ?? row.row_data.created_at),
      };
    })
    .sort((left, right) =>
      `${left.bucket}\u0000${left.path}`.localeCompare(`${right.bucket}\u0000${right.path}`),
    );
  if (new Set(objects.map((object) => `${object.bucket}\u0000${object.path}`)).size !== objects.length) {
    throw new Error("storage_metadata_duplicate_object");
  }
  return { buckets: [...new Set(buckets)], objects };
}

function parseResticBackup(stdout: string): ResticBackupSummary {
  const messages = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  const summary = messages.findLast((message) => message.message_type === "summary");
  const snapshotId = typeof summary?.snapshot_id === "string" ? summary.snapshot_id : "";
  const dataAdded = Number(summary?.data_added ?? 0);
  const totalBytesProcessed = Number(summary?.total_bytes_processed ?? 0);
  if (
    !/^[0-9a-f]{8,64}$/.test(snapshotId) ||
    !Number.isFinite(dataAdded) ||
    !Number.isFinite(totalBytesProcessed)
  ) {
    throw new Error("restic_backup_summary_invalid");
  }
  return { snapshotId, dataAdded, totalBytesProcessed };
}

const apiRunPackageCandidatesSql = `copy (
  select jsonb_build_object(
    'runId', run.id,
    'connectionId', run.connection_id,
    'sourceCreatedAt', run.created_at,
    'rowCount', output.row_count,
    'rowsStoragePath', output.rows_storage_path,
    'rawStoragePath', output.raw_storage_path,
    'rowsChecksum', output.rows_checksum,
    'rawChecksum', output.raw_checksum
  )::text
  from private.api_connection_runs as run
  join private.api_connection_run_outputs as output on output.run_id = run.id
  where run.status = 'success'
    and run.created_at < now() - interval '30 days'
    and not exists (
      select 1 from private.data_archive_packages as package
      where package.package_kind = 'api-run'
        and package.source_identifier = run.id::text
    )
  order by run.created_at, run.id
) to stdout`;

const datasetVersionPackageCandidatesSql = `copy (
  select jsonb_build_object(
    'versionId', version.id,
    'datasetId', version.dataset_id,
    'sourceCreatedAt', version.version_created_at,
    'rowCount', version.row_count,
    'fileName', version.file_name,
    'blobPath', version.blob_path,
    'action', version.action,
    'status', version.status,
    'columns', version.columns
  )::text
  from public.dataset_versions as version
  where version.status = 'ready'
    and version.version_created_at < now() - interval '30 days'
    and not exists (
      select 1 from private.data_archive_packages as package
      where package.package_kind = 'dataset-version'
        and package.source_identifier = version.id::text
    )
  order by version.version_created_at, version.id
) to stdout`;

const pipelinePublicationPackageCandidatesSql = `copy (
  select jsonb_build_object(
    'publicationId', publication.id,
    'producerKind', publication.producer_kind,
    'producerRunId', publication.producer_run_id,
    'datasetId', publication.dataset_id,
    'sourceCreatedAt', publication.created_at,
    'outputChecksum', publication.output_checksum,
    'rowCount', publication.row_count,
    'publicationTargetKey', publication.publication_target_key,
    'datasetBlobPath', dataset.blob_path,
    'artifacts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', artifact.artifact_kind,
        'storagePath', artifact.storage_path,
        'contentChecksum', artifact.content_checksum,
        'sizeBytes', artifact.size_bytes
      ) order by artifact.artifact_kind, artifact.storage_path)
      from private.pipeline_artifacts as artifact
      where artifact.run_id = publication.producer_run_id
    ), '[]'::jsonb)
  )::text
  from private.pipeline_publications as publication
  join public.datasets as dataset on dataset.id = publication.dataset_id
  where publication.producer_kind in (
      'dataset-forming', 'tier1-merge', 'aggregate1',
      'tier2-forming', 'tier2-merge', 'aggregate2'
    )
    and publication.created_at < now() - interval '30 days'
    and not exists (
      select 1 from private.data_archive_packages as package
      where package.package_kind = case
          when publication.producer_kind in ('tier2-forming', 'tier2-merge', 'aggregate2')
            then 'tier2-publication'
          else 'tier1-publication'
        end
        and package.source_identifier = publication.id::text
    )
  order by publication.created_at, publication.id
) to stdout`;

function parseApiRunPackageCandidates(value: string): ApiRunPackageCandidate[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ApiRunPackageCandidate);
}

function parseJsonLines<T>(value: string): T[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function parseDatasetVersionPackageCandidates(
  value: string,
): DatasetVersionPackageCandidate[] {
  return parseJsonLines<DatasetVersionPackageCandidate>(value);
}

function parsePipelinePublicationPackageCandidates(
  value: string,
): PipelinePublicationPackageCandidate[] {
  return parseJsonLines<PipelinePublicationPackageCandidate>(value);
}

function findStorageObject(
  inventory: ProjectSnapshotManifest["storageInventory"],
  path: string,
  bucket?: string,
): StorageObject {
  const matches = inventory.objects.filter(
    (object) => object.path === path && (bucket === undefined || object.bucket === bucket),
  );
  if (matches.length !== 1) throw new Error("archive_package_storage_identity_ambiguous");
  return matches[0]!;
}

async function expandApiRunObjectPaths(input: {
  candidate: ApiRunPackageCandidate;
  inventory: ProjectSnapshotManifest["storageInventory"];
  storageDirectory: string;
}): Promise<Array<{ kind: string; object: StorageObject }>> {
  const base = [
    { kind: "rows-manifest", path: input.candidate.rowsStoragePath },
    { kind: "raw-manifest", path: input.candidate.rawStoragePath },
  ];
  const expanded: Array<{ kind: string; object: StorageObject }> = [];
  for (const artifact of base) {
    const object = findStorageObject(input.inventory, artifact.path);
    const localPath = safeStorageObjectPath(
      input.storageDirectory,
      object.bucket,
      object.path,
    );
    const body = await readFile(localPath, "utf8");
    const expectedChecksum = artifact.kind === "rows-manifest"
      ? input.candidate.rowsChecksum
      : input.candidate.rawChecksum;
    if (expectedChecksum && object.localSha256 !== expectedChecksum) {
      throw new Error("archive_package_manifest_checksum_mismatch");
    }
    expanded.push({ kind: artifact.kind, object });
    const manifest = artifact.kind === "rows-manifest"
      ? parseApiConnectionRowsChunkManifest(body)
      : parseApiConnectionRawChunkManifest(body);
    for (const chunk of manifest?.chunks ?? []) {
      const chunkObject = findStorageObject(input.inventory, chunk.path);
      if (
        chunkObject.localSha256 !== chunk.checksum ||
        chunkObject.sizeBytes !== chunk.sizeBytes
      ) {
        throw new Error("archive_package_chunk_checksum_mismatch");
      }
      expanded.push({
        kind: artifact.kind === "rows-manifest" ? "rows-chunk" : "raw-chunk",
        object: chunkObject,
      });
    }
  }
  const unique = new Map<string, { kind: string; object: StorageObject }>();
  for (const member of expanded) {
    unique.set(`${member.object.bucket}\u0000${member.object.path}`, member);
  }
  return [...unique.values()].sort((left, right) =>
    `${left.object.bucket}\u0000${left.object.path}`.localeCompare(
      `${right.object.bucket}\u0000${right.object.path}`,
    ),
  );
}

function storagePackageMember(input: {
  kind: string;
  sourceIdentifier: string;
  object: StorageObject;
}) {
  return {
    kind: input.kind,
    sourceTable: null,
    sourceIdentifier: input.sourceIdentifier,
    storageBucket: input.object.bucket,
    storageObjectPath: input.object.path,
    contentType: input.object.contentType,
    sha256: input.object.localSha256,
    sizeBytes: input.object.sizeBytes,
  };
}

function databasePackageMember(input: {
  kind: string;
  sourceTable: string;
  sourceIdentifier: string;
  checksum: string;
  logicalBytes: number;
}) {
  return {
    kind: input.kind,
    sourceTable: input.sourceTable,
    sourceIdentifier: input.sourceIdentifier,
    storageBucket: null,
    storageObjectPath: null,
    contentType: "application/json",
    sha256: input.checksum,
    sizeBytes: input.logicalBytes,
  };
}

export function buildDatasetVersionPackageContent(input: {
  candidate: DatasetVersionPackageCandidate;
  inventory: ProjectSnapshotManifest["storageInventory"];
  datasetBucket: string;
}): ArchivePackageContent {
  const object = findStorageObject(
    input.inventory,
    input.candidate.blobPath,
    input.datasetBucket,
  );
  const metadata = {
    versionId: input.candidate.versionId,
    datasetId: input.candidate.datasetId,
    fileName: input.candidate.fileName,
    action: input.candidate.action,
    status: input.candidate.status,
    rowCount: input.candidate.rowCount,
    columns: input.candidate.columns,
    blobPath: input.candidate.blobPath,
  };
  const metadataBody = canonicalJson(metadata);
  return buildArchivePackageContent({
    packageKind: "dataset-version",
    sourceIdentifier: input.candidate.versionId,
    sourceCreatedAt: new Date(input.candidate.sourceCreatedAt).toISOString(),
    sourceIdentity: metadata,
    rowCount: input.candidate.rowCount,
    members: [
      databasePackageMember({
        kind: "dataset-version-record",
        sourceTable: "public.dataset_versions",
        sourceIdentifier: input.candidate.versionId,
        checksum: canonicalSha256(metadata),
        logicalBytes: Buffer.byteLength(metadataBody),
      }),
      databasePackageMember({
        kind: "dataset-version-rows",
        sourceTable: "public.dataset_version_rows",
        sourceIdentifier: input.candidate.versionId,
        checksum: object.localSha256,
        logicalBytes: 0,
      }),
      storagePackageMember({
        kind: "dataset-blob",
        sourceIdentifier: input.candidate.versionId,
        object,
      }),
    ],
  });
}

export function buildPipelinePublicationPackageContent(input: {
  candidate: PipelinePublicationPackageCandidate;
  inventory: ProjectSnapshotManifest["storageInventory"];
  datasetBucket: string;
  artifactBucket: string;
}): ArchivePackageContent {
  const packageKind = input.candidate.producerKind.startsWith("tier2-") ||
      input.candidate.producerKind === "aggregate2"
    ? "tier2-publication"
    : "tier1-publication";
  const metadata = {
    publicationId: input.candidate.publicationId,
    producerKind: input.candidate.producerKind,
    producerRunId: input.candidate.producerRunId,
    datasetId: input.candidate.datasetId,
    outputChecksum: input.candidate.outputChecksum,
    rowCount: input.candidate.rowCount,
    publicationTargetKey: input.candidate.publicationTargetKey,
    datasetBlobPath: input.candidate.datasetBlobPath,
  };
  const metadataBody = canonicalJson(metadata);
  const datasetObject = findStorageObject(
    input.inventory,
    input.candidate.datasetBlobPath,
    input.datasetBucket,
  );
  const artifactMembers = input.candidate.artifacts.map((artifact) => {
    const object = findStorageObject(
      input.inventory,
      artifact.storagePath,
      input.artifactBucket,
    );
    if (
      object.localSha256 !== artifact.contentChecksum ||
      object.sizeBytes !== artifact.sizeBytes
    ) {
      throw new Error("archive_pipeline_artifact_mismatch");
    }
    return storagePackageMember({
      kind: `pipeline-${artifact.kind}`,
      sourceIdentifier: input.candidate.publicationId,
      object,
    });
  });
  return buildArchivePackageContent({
    packageKind,
    sourceIdentifier: input.candidate.publicationId,
    sourceCreatedAt: new Date(input.candidate.sourceCreatedAt).toISOString(),
    sourceIdentity: metadata,
    rowCount: input.candidate.rowCount,
    members: [
      databasePackageMember({
        kind: "pipeline-publication-record",
        sourceTable: "private.pipeline_publications",
        sourceIdentifier: input.candidate.publicationId,
        checksum: canonicalSha256(metadata),
        logicalBytes: Buffer.byteLength(metadataBody),
      }),
      databasePackageMember({
        kind: "pipeline-publication-rows",
        sourceTable: "private.pipeline_publication_rows",
        sourceIdentifier: input.candidate.publicationId,
        checksum: input.candidate.outputChecksum,
        logicalBytes: 0,
      }),
      storagePackageMember({
        kind: "pipeline-dataset-blob",
        sourceIdentifier: input.candidate.publicationId,
        object: datasetObject,
      }),
      ...artifactMembers,
    ],
  });
}

async function storeArchivePackage(input: {
  content: ArchivePackageContent;
  workspace: ArchiveRunWorkspace;
  config: ArchiveWorkerConfig;
  dependencies: ArchiveRunnerDependencies;
}): Promise<ArchivePackage> {
  const pointerPath = join(
    input.config.archiveTreeDirectory,
    "packages",
    input.content.packageKey,
    "manifest.json",
  );
  const retainedPointer = await readFile(pointerPath, "utf8").catch(() => null);
  if (retainedPointer) {
    const retained = archivePackageSchema.parse(JSON.parse(retainedPointer));
    if (retained.packageKey !== input.content.packageKey) {
      throw new Error("archive_package_pointer_conflict");
    }
    const comparable = Object.fromEntries(
      Object.entries(retained).filter(([key]) => key !== "archiveSnapshotId"),
    );
    if (canonicalSha256(comparable) !== canonicalSha256(input.content)) {
      throw new Error("archive_package_pointer_conflict");
    }
    await input.dependencies.runCommand(
      resticCommand(input.config, ["snapshots", retained.archiveSnapshotId, "--json"]),
    );
    return retained;
  }

  const packageDirectory = join(
    input.workspace.directory,
    "archive-packages",
    input.content.packageKey,
  );
  await mkdir(packageDirectory, { recursive: true, mode: 0o700 });
  await writeCanonicalFile(join(packageDirectory, "package.json"), input.content);
  for (const member of input.content.members) {
    if (!member.storageBucket || !member.storageObjectPath) continue;
    const source = safeStorageObjectPath(
      input.workspace.storageDirectory,
      member.storageBucket,
      member.storageObjectPath,
    );
    const target = safeStorageObjectPath(
      join(packageDirectory, "objects"),
      member.storageBucket,
      member.storageObjectPath,
    );
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await copyFile(source, target);
    await chmod(target, 0o600);
    await assertRestrictedPath(target);
  }
  const result = await input.dependencies.runCommand(
    resticCommand(input.config, [
      "backup",
      "--compression",
      "max",
      "--tag",
      "catalog-archive",
      "--tag",
      `package:${canonicalSha256(input.content)}`,
      "--json",
      packageDirectory,
    ]),
  );
  const backup = parseResticBackup(result.stdout);
  const archivePackage = archivePackageSchema.parse({
    ...input.content,
    archiveSnapshotId: backup.snapshotId,
  });
  await mkdir(dirname(pointerPath), { recursive: true, mode: 0o700 });
  await writeCanonicalFile(pointerPath, archivePackage);
  return archivePackage;
}

async function collectApiRunPackages(input: {
  config: ArchiveWorkerConfig;
  workspace: ArchiveRunWorkspace;
  inventory: ProjectSnapshotManifest["storageInventory"];
  dependencies: ArchiveRunnerDependencies;
}): Promise<ArchivePackage[]> {
  const result = await input.dependencies.runCommand(
    databaseCommand(input.config, "psql", [
      "-X",
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--command",
      apiRunPackageCandidatesSql,
    ]),
  );
  const packages: ArchivePackage[] = [];
  for (const candidate of parseApiRunPackageCandidates(result.stdout)) {
    const expanded = await expandApiRunObjectPaths({
      candidate,
      inventory: input.inventory,
      storageDirectory: input.workspace.storageDirectory,
    });
    const members = expanded.map(({ kind, object }) =>
      storagePackageMember({
        kind,
        sourceIdentifier: candidate.runId,
        object,
      }),
    );
    const content = buildArchivePackageContent({
      packageKind: "api-run",
      sourceIdentifier: candidate.runId,
      sourceCreatedAt: new Date(candidate.sourceCreatedAt).toISOString(),
      sourceIdentity: {
        runId: candidate.runId,
        connectionId: candidate.connectionId,
        rowCount: candidate.rowCount,
      },
      rowCount: candidate.rowCount,
      members,
    });
    packages.push(await storeArchivePackage({ ...input, content }));
  }
  return packages;
}

async function collectDatasetVersionPackages(input: {
  config: ArchiveWorkerConfig;
  workspace: ArchiveRunWorkspace;
  inventory: ProjectSnapshotManifest["storageInventory"];
  dependencies: ArchiveRunnerDependencies;
}): Promise<ArchivePackage[]> {
  const result = await input.dependencies.runCommand(
    databaseCommand(input.config, "psql", [
      "-X",
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--command",
      datasetVersionPackageCandidatesSql,
    ]),
  );
  const packages: ArchivePackage[] = [];
  for (const candidate of parseDatasetVersionPackageCandidates(result.stdout)) {
    const content = buildDatasetVersionPackageContent({
      candidate,
      inventory: input.inventory,
      datasetBucket: input.config.datasetBucket,
    });
    packages.push(await storeArchivePackage({ ...input, content }));
  }
  return packages;
}

async function collectPipelinePublicationPackages(input: {
  config: ArchiveWorkerConfig;
  workspace: ArchiveRunWorkspace;
  inventory: ProjectSnapshotManifest["storageInventory"];
  dependencies: ArchiveRunnerDependencies;
}): Promise<ArchivePackage[]> {
  const result = await input.dependencies.runCommand(
    databaseCommand(input.config, "psql", [
      "-X",
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--command",
      pipelinePublicationPackageCandidatesSql,
    ]),
  );
  const packages: ArchivePackage[] = [];
  for (const candidate of parsePipelinePublicationPackageCandidates(result.stdout)) {
    const content = buildPipelinePublicationPackageContent({
      candidate,
      inventory: input.inventory,
      datasetBucket: input.config.datasetBucket,
      artifactBucket: input.config.artifactBucket,
    });
    packages.push(await storeArchivePackage({ ...input, content }));
  }
  return packages;
}

async function runResticBackup(input: {
  config: ArchiveWorkerConfig;
  workspace: ArchiveRunWorkspace;
  dependencies: ArchiveRunnerDependencies;
}): Promise<ResticBackupSummary> {
  const result = await input.dependencies.runCommand(
    resticCommand(input.config, [
      ...resticBackupArgs({
        workspaceDirectory: input.workspace.directory,
        archiveTreeDirectory: input.config.archiveTreeDirectory,
        runKey: input.workspace.runKey,
      }),
      "--json",
      "--exclude-caches",
    ]),
  );
  return parseResticBackup(result.stdout);
}

async function exportManagedRows(input: {
  schema: "auth" | "storage";
  path: string;
  config: ArchiveWorkerConfig;
  dependencies: ArchiveRunnerDependencies;
}) {
  await input.dependencies.runCommand(
    databaseCommand(
      input.config,
      "psql",
      ["-X", "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--command", managedExportSql(input.schema)],
      input.path,
    ),
  );
}

async function exportDatabase(input: {
  config: ArchiveWorkerConfig;
  workspace: ArchiveRunWorkspace;
  dependencies: ArchiveRunnerDependencies;
}) {
  const rolesPath = join(input.workspace.databaseDirectory, "roles.csv");
  const schemaPath = join(input.workspace.databaseDirectory, "schema.sql");
  const dataPath = join(input.workspace.databaseDirectory, "data.sql");
  const authPath = join(input.workspace.databaseDirectory, "managed-auth.ndjson");
  const storagePath = join(input.workspace.databaseDirectory, "managed-storage.ndjson");
  const migrationsPath = join(input.workspace.databaseDirectory, "migrations.sql");

  await input.dependencies.runCommand(
    databaseCommand(
      input.config,
      "psql",
      [
        "-X",
        "--no-psqlrc",
        "--csv",
        "--command",
        "select rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls from pg_catalog.pg_roles order by rolname",
      ],
      rolesPath,
    ),
  );
  await input.dependencies.runCommand(
    databaseCommand(
      input.config,
      "pg_dump",
      [
        "--schema-only",
        "--no-owner",
        "--no-privileges",
        "--schema=public",
        "--schema=private",
        "--schema=supabase_migrations",
      ],
      schemaPath,
    ),
  );
  await input.dependencies.runCommand(
    databaseCommand(
      input.config,
      "pg_dump",
      [
        "--data-only",
        "--no-owner",
        "--no-privileges",
        "--schema=public",
        "--schema=private",
      ],
      dataPath,
    ),
  );
  await input.dependencies.runCommand(
    databaseCommand(
      input.config,
      "pg_dump",
      [
        "--data-only",
        "--no-owner",
        "--no-privileges",
        "--schema=supabase_migrations",
      ],
      migrationsPath,
    ),
  );
  await exportManagedRows({ ...input, schema: "auth", path: authPath });
  await exportManagedRows({ ...input, schema: "storage", path: storagePath });

  const files = [
    ["roles", rolesPath],
    ["schema", schemaPath],
    ["data", dataPath],
    ["managed-auth", authPath],
    ["managed-storage", storagePath],
    ["migrations", migrationsPath],
  ] as const;
  const databaseExports = await Promise.all(
    files.map(async ([kind, path]) => ({
      kind,
      relativePath: relative(input.workspace.directory, path),
      sha256: await sha256File(path),
      sizeBytes: (await stat(path)).size,
    })),
  );
  return {
    databaseExports,
    databaseBytes: databaseExports.reduce((total, file) => total + file.sizeBytes, 0),
    migrationSha256: await sha256File(migrationsPath),
    storageExportPath: storagePath,
  };
}

async function readVersion(
  dependencies: ArchiveRunnerDependencies,
  command: string,
  args: string[],
): Promise<string> {
  const result = await dependencies.runCommand({ command, args });
  return result.stdout.trim().replace(/\s+/g, " ").slice(0, 80) || "unknown";
}

export function assertPostgres17Tooling(input: {
  serverVersion: string;
  clientVersion: string;
}): void {
  if (!/(?:^|\s|\))17\./.test(input.clientVersion)) {
    throw new Error("archive_postgres_17_client_required");
  }
  if (!/^17\./.test(input.serverVersion)) {
    throw new Error("archive_postgres_17_server_required");
  }
}

async function readDatabaseUsage(
  config: ArchiveWorkerConfig,
  dependencies: ArchiveRunnerDependencies,
): Promise<number> {
  const result = await dependencies.runCommand(
    databaseCommand(config, "psql", [
      "-X",
      "--no-psqlrc",
      "--tuples-only",
      "--no-align",
      "--command",
      "select pg_database_size(current_database())",
    ]),
  );
  const bytes = Number(result.stdout.trim());
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error("database_usage_invalid");
  return bytes;
}

async function readDatabaseVersion(
  config: ArchiveWorkerConfig,
  dependencies: ArchiveRunnerDependencies,
): Promise<string> {
  const result = await dependencies.runCommand(
    databaseCommand(config, "psql", [
      "-X",
      "--no-psqlrc",
      "--tuples-only",
      "--no-align",
      "--command",
      "show server_version",
    ]),
  );
  return result.stdout.trim().replace(/\s+/g, " ").slice(0, 80) || "unknown";
}

async function syncStorage(input: {
  config: ArchiveWorkerConfig;
  workspace: ArchiveRunWorkspace;
  preExportPath: string;
  dependencies: ArchiveRunnerDependencies;
  storageEnvironment: Record<string, string | undefined>;
}) {
  const pre = extractProviderStorageInventory(
    parseManagedExport(await readFile(input.preExportPath, "utf8")),
  );
  for (const bucket of pre.buckets) {
    safeStorageObjectPath(input.workspace.storageDirectory, bucket, ".archive-root");
    const bucketDirectory = join(input.workspace.storageDirectory, bucket);
    await mkdir(bucketDirectory, { recursive: true, mode: 0o700 });
    await input.dependencies.runCommand({
      command: "rclone",
      args: [
        "sync",
        `archive:${bucket}`,
        bucketDirectory,
        "--checkers",
        "8",
        "--transfers",
        "4",
        "--retries",
        "3",
        "--low-level-retries",
        "5",
        "--log-level",
        "ERROR",
      ],
      env: input.storageEnvironment,
    });
  }

  const postExportPath = join(input.workspace.databaseDirectory, "managed-storage-post.ndjson");
  await exportManagedRows({
    schema: "storage",
    path: postExportPath,
    config: input.config,
    dependencies: input.dependencies,
  });
  const post = extractProviderStorageInventory(
    parseManagedExport(await readFile(postExportPath, "utf8")),
  );
  if (canonicalSha256(pre) !== canonicalSha256(post)) {
    throw new Error("storage_inventory_changed_during_backup");
  }
  const verified = await verifyStorageCopy({
    metadata: post.objects,
    storageDirectory: input.workspace.storageDirectory,
    capturedAt: input.dependencies.now().toISOString(),
  });
  return reconcileVerifiedCopies({ before: verified, after: verified, verifiedCopy: verified });
}

async function createStorageSessionEnvironment(input: {
  config: ArchiveWorkerConfig;
  dependencies: ArchiveRunnerDependencies;
}): Promise<Record<string, string | undefined>> {
  const [email, password, anonKey] = await Promise.all([
    readFile(input.config.storageAuthEmailFile, "utf8").then((value) => value.trim()),
    readFile(input.config.storageAuthPasswordFile, "utf8").then((value) => value.trim()),
    readFile(input.config.supabaseAnonKeyFile, "utf8").then((value) => value.trim()),
  ]);
  if (!email || !password || !anonKey) {
    throw new Error("archive_storage_auth_secret_missing");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await input.dependencies.fetchImpl(
      `${input.config.supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error("archive_storage_auth_failed");
    const result = (await response.json()) as { access_token?: unknown };
    if (typeof result.access_token !== "string" || result.access_token.length < 32) {
      throw new Error("archive_storage_auth_invalid_response");
    }
    return {
      ...input.config.storageEnvironment,
      AWS_SECRET_ACCESS_KEY: anonKey,
      AWS_SESSION_TOKEN: result.access_token,
      RCLONE_CONFIG_ARCHIVE_TYPE: "s3",
      RCLONE_CONFIG_ARCHIVE_PROVIDER: "Other",
      RCLONE_CONFIG_ARCHIVE_ACCESS_KEY_ID:
        input.config.storageEnvironment.AWS_ACCESS_KEY_ID,
      RCLONE_CONFIG_ARCHIVE_SECRET_ACCESS_KEY: anonKey,
      RCLONE_CONFIG_ARCHIVE_SESSION_TOKEN: result.access_token,
      RCLONE_CONFIG_ARCHIVE_ENDPOINT:
        input.config.storageEnvironment.AWS_ENDPOINT_URL_S3,
      RCLONE_CONFIG_ARCHIVE_REGION:
        input.config.storageEnvironment.AWS_DEFAULT_REGION,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function listArchiveTreePaths(root: string): Promise<string[]> {
  const paths: string[] = [];
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) paths.push(relative(root, path));
    }
  }
  await visit(root);
  return paths;
}

async function readCatalogPackageKeys(
  config: ArchiveWorkerConfig,
  dependencies: ArchiveRunnerDependencies,
): Promise<string[]> {
  const result = await dependencies.runCommand(
    databaseCommand(config, "psql", [
      "-X",
      "--no-psqlrc",
      "--tuples-only",
      "--no-align",
      "--command",
      "select package_key from private.data_archive_packages where status in ('verified', 'cold', 'rehydrating', 'rehydrated') order by package_key",
    ]),
  );
  return result.stdout.split("\n").map((value) => value.trim()).filter(Boolean);
}

function repositoryRatios(input: {
  logicalBytes: number;
  dataAdded: number;
  allocatedBytes: number;
}) {
  const nonZeroAdded = Math.max(input.dataAdded, 1);
  const nonZeroAllocated = Math.max(input.allocatedBytes, 1);
  return {
    deduplicationRatio: Math.max(input.logicalBytes / nonZeroAdded, 0.0001),
    compressionRatio: Math.max(input.logicalBytes / nonZeroAllocated, 0.0001),
  };
}

async function archiveAllocatedBytes(
  config: ArchiveWorkerConfig,
  dependencies: ArchiveRunnerDependencies,
): Promise<number> {
  const result = await dependencies.runCommand({
    command: "du",
    args: ["-sb", config.resticRepository],
  });
  const bytes = Number(result.stdout.trim().split(/\s+/)[0]);
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error("archive_usage_invalid");
  return bytes;
}

export async function submitArchiveReceipt(input: {
  config: ArchiveWorkerConfig;
  payload: BackupReceiptPayload;
  dependencies: ArchiveRunnerDependencies;
}) {
  const signingKey = (await readFile(input.config.receiptKeyFile, "utf8")).trim();
  const receipt = signBackupReceipt(input.payload, signingKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await input.dependencies.fetchImpl(input.config.receiptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(receipt),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`archive_receipt_http_${response.status}`);
    const result = (await response.json()) as { ok?: unknown };
    if (result.ok !== true) throw new Error("archive_receipt_invalid_response");
  } finally {
    clearTimeout(timeout);
  }
}

export async function executeArchiveBackup(
  config: ArchiveWorkerConfig,
  overrides: Partial<ArchiveRunnerDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  await assertSecretFiles(config);
  await Promise.all([
    mkdir(config.stateDirectory, { recursive: true, mode: 0o700 }),
    mkdir(config.stagingDirectory, { recursive: true, mode: 0o700 }),
    mkdir(config.archiveTreeDirectory, { recursive: true, mode: 0o700 }),
  ]);
  await dependencies.runCommand(resticCommand(config, ["snapshots", "--json"]));

  return withExclusiveArchiveWorkspace({
    lockPath: join(config.stateDirectory, "backup.lock"),
    parentDirectory: config.stagingDirectory,
    action: async (workspace) => {
      const startedAt = dependencies.now();
      const [postgresVersion, postgresClientVersion, supabaseCliVersion, resticVersion, databaseUsageBytes] =
        await Promise.all([
          readDatabaseVersion(config, dependencies),
          readVersion(dependencies, "pg_dump", ["--version"]),
          readVersion(dependencies, "supabase", ["--version"]),
          readVersion(dependencies, "restic", ["version"]),
          readDatabaseUsage(config, dependencies),
        ]);
      assertPostgres17Tooling({
        serverVersion: postgresVersion,
        clientVersion: postgresClientVersion,
      });
      const database = await exportDatabase({ config, workspace, dependencies });
      const storageEnvironment = await createStorageSessionEnvironment({
        config,
        dependencies,
      });
      const storageInventory = await syncStorage({
        config,
        workspace,
        preExportPath: database.storageExportPath,
        dependencies,
        storageEnvironment,
      });
      const packageInput = {
        config,
        workspace,
        inventory: storageInventory,
        dependencies,
      };
      const packages = [
        ...(await collectApiRunPackages(packageInput)),
        ...(await collectDatasetVersionPackages(packageInput)),
        ...(await collectPipelinePublicationPackages(packageInput)),
      ].sort((left, right) => left.packageKey.localeCompare(right.packageKey));

      const catalogPackageKeys = await readCatalogPackageKeys(config, dependencies);
      assertArchiveTreeReachability({
        catalogPackageKeys: [
          ...new Set([...catalogPackageKeys, ...packages.map((item) => item.packageKey)]),
        ],
        archiveTreeDirectory: config.archiveTreeDirectory,
        reachableRelativePaths: await listArchiveTreePaths(config.archiveTreeDirectory),
      });

      const initialBackup = await runResticBackup({ config, workspace, dependencies });
      const allocatedAfterInitial = await archiveAllocatedBytes(config, dependencies);
      const ratios = repositoryRatios({
        logicalBytes: database.databaseBytes + storageInventory.totalBytes,
        dataAdded: initialBackup.dataAdded,
        allocatedBytes: allocatedAfterInitial,
      });
      const capacity = buildCapacitySummary({
        databaseBytes: databaseUsageBytes,
        storageBytes: storageInventory.totalBytes,
        archiveAllocatedBytes: allocatedAfterInitial,
        archiveUniqueBytes: initialBackup.dataAdded,
        uniqueBytesAdded: initialBackup.dataAdded,
        ...ratios,
      });
      const completedAt = dependencies.now();
      const manifest: ProjectSnapshotManifest = projectSnapshotManifestSchema.parse({
        schemaVersion: 1,
        runKey: workspace.runKey,
        projectRef: config.projectRef,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        postgresVersion,
        postgresClientVersion,
        supabaseCliVersion,
        resticVersion,
        migrationSha256: database.migrationSha256,
        databaseExports: database.databaseExports,
        storageInventory,
        packages,
        capacity,
      });
      const manifestPath = join(workspace.manifestDirectory, "project-snapshot.json");
      const manifestSha256 = await writeCanonicalFile(manifestPath, manifest);
      const finalBackup = await runResticBackup({ config, workspace, dependencies });
      await dependencies.runCommand(
        resticCommand(config, ["forget", initialBackup.snapshotId]),
      );
      await dependencies.runCommand(
        resticCommand(config, ["check", `--read-data-subset=${config.checkSubset}`]),
      );
      await dependencies.runCommand(resticCommand(config, resticRetentionArgs()));

      const uniqueBytesAdded = initialBackup.dataAdded + finalBackup.dataAdded;
      const payload: BackupReceiptPayload = {
        schemaVersion: 1,
        runKey: workspace.runKey,
        nonce: `nonce:${randomUUID()}`,
        issuedAt: dependencies.now().toISOString(),
        status: "verified",
        projectRef: config.projectRef,
        postgresVersion,
        migrationSha256: database.migrationSha256,
        manifestSha256,
        resticSnapshotId: finalBackup.snapshotId,
        databaseBytes: database.databaseBytes,
        storageBytes: storageInventory.totalBytes,
        storageObjectCount: storageInventory.objectCount,
        databaseUsageBytes,
        storageUsageBytes: storageInventory.totalBytes,
        archiveAllocatedBytes: allocatedAfterInitial,
        uniqueBytesAdded,
        compressionRatio: ratios.compressionRatio,
        deduplicationRatio: ratios.deduplicationRatio,
        integrityVerifiedAt: dependencies.now().toISOString(),
        completedAt: dependencies.now().toISOString(),
        failureCode: null,
        packages,
      };
      await writeFile(config.lastSuccessFile, `${payload.completedAt}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await submitArchiveReceipt({ config, payload, dependencies });
      return {
        runKey: workspace.runKey,
        snapshotId: finalBackup.snapshotId,
        manifestSha256,
        databaseBytes: database.databaseBytes,
        storageBytes: storageInventory.totalBytes,
        storageObjectCount: storageInventory.objectCount,
        uniqueBytesAdded,
        siteProtection: "single-site" as const,
        offsiteProtected: false as const,
      };
    },
  });
}

export async function submitArchiveFailureReceipt(input: {
  config: ArchiveWorkerConfig;
  runKey: string;
  failureCode: string;
  overrides?: Partial<ArchiveRunnerDependencies>;
}) {
  const dependencies = { ...defaultDependencies, ...input.overrides };
  const now = dependencies.now().toISOString();
  const safeRunKey = /^[A-Za-z0-9._:-]{8,160}$/.test(input.runKey)
    ? input.runKey
    : `failure:${now.slice(0, 10).replaceAll("-", "")}`;
  const safeFailureCode = input.failureCode
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 128) || "backup-failed";
  const payload: BackupReceiptPayload = {
    schemaVersion: 1,
    runKey: safeRunKey,
    nonce: `nonce:${randomUUID()}`,
    issuedAt: now,
    status: "failed",
    projectRef: input.config.projectRef,
    postgresVersion: "unknown",
    migrationSha256: "0".repeat(64),
    manifestSha256: null,
    resticSnapshotId: null,
    databaseBytes: 0,
    storageBytes: 0,
    storageObjectCount: 0,
    databaseUsageBytes: 0,
    storageUsageBytes: 0,
    archiveAllocatedBytes: 0,
    uniqueBytesAdded: 0,
    compressionRatio: 1,
    deduplicationRatio: 1,
    integrityVerifiedAt: null,
    completedAt: now,
    failureCode: safeFailureCode,
    packages: [],
  };
  await submitArchiveReceipt({ config: input.config, payload, dependencies });
}

export async function readLastSuccessfulArchiveRun(path: string): Promise<Date | null> {
  try {
    const value = (await readFile(path, "utf8")).trim();
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

export async function readStoredProjectManifest(path: string) {
  return projectSnapshotManifestSchema.parse(await readJsonFile(path));
}
