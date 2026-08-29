import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  chmod,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";

import {
  canonicalJson,
  normalizeStorageInventory,
  reconcileStorageInventories,
  sha256Hex,
  storageObjectSchema,
  type StorageInventory,
  type StorageObject,
} from "./canonical";

export type ArchiveCommand = {
  command: string;
  args: string[];
  env?: Record<string, string | undefined>;
  stdoutPath?: string;
  allowedExitCodes?: number[];
};

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type ArchiveRunWorkspace = {
  runKey: string;
  directory: string;
  databaseDirectory: string;
  storageDirectory: string;
  manifestDirectory: string;
};

const secretArgumentPattern = /(?:password|secret|token|key)=|postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@/i;
const activeArchiveChildren = new Set<ReturnType<typeof spawn>>();

export function assertNoSecretArguments(command: ArchiveCommand): void {
  const unsafe = command.args.find((argument) => secretArgumentPattern.test(argument));
  if (unsafe) throw new Error("archive_secret_in_process_arguments");
}

export async function runArchiveCommand(command: ArchiveCommand): Promise<CommandResult> {
  assertNoSecretArguments(command);
  const allowedExitCodes = command.allowedExitCodes ?? [0];
  const stdoutHandle = command.stdoutPath
    ? await open(command.stdoutPath, "wx", 0o600)
    : null;
  try {
    return await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(command.command, command.args, {
        env: { ...process.env, ...command.env },
        stdio: ["ignore", stdoutHandle ? stdoutHandle.fd : "pipe", "pipe"],
      });
      activeArchiveChildren.add(child);
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
      child.once("error", (error) => {
        activeArchiveChildren.delete(child);
        rejectPromise(error);
      });
      child.once("close", (code) => {
        activeArchiveChildren.delete(child);
        const exitCode = code ?? 1;
        const result = {
          exitCode,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
        };
        if (!allowedExitCodes.includes(exitCode)) {
          rejectPromise(
            Object.assign(new Error(`archive_command_failed:${basename(command.command)}`), {
              exitCode,
              sanitizedStderr: sanitizeCommandError(result.stderr),
            }),
          );
          return;
        }
        resolvePromise(result);
      });
    });
  } finally {
    await stdoutHandle?.close();
  }
}

export function sanitizeCommandError(value: string): string {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, "postgresql://[redacted]@")
    .replace(/(?:password|secret|token|key)=\S+/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

async function createWorkspace(parentDirectory?: string): Promise<ArchiveRunWorkspace> {
  const root = parentDirectory ?? tmpdir();
  await mkdir(root, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(join(root, "ax-data-archive-"));
  await chmod(directory, 0o700);
  const runKey = `backup:${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}:${randomUUID().slice(0, 8)}`;
  const databaseDirectory = join(directory, "database");
  const storageDirectory = join(directory, "storage");
  const manifestDirectory = join(directory, "manifests");
  await Promise.all(
    [databaseDirectory, storageDirectory, manifestDirectory].map((path) =>
      mkdir(path, { recursive: true, mode: 0o700 }),
    ),
  );
  return { runKey, directory, databaseDirectory, storageDirectory, manifestDirectory };
}

export async function withExclusiveArchiveWorkspace<T>(input: {
  lockPath: string;
  parentDirectory?: string;
  retainOnFailure?: boolean;
  action: (workspace: ArchiveRunWorkspace) => Promise<T>;
}): Promise<T> {
  await mkdir(resolve(input.lockPath, ".."), { recursive: true, mode: 0o700 });
  let lock;
  try {
    lock = await open(input.lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("archive_run_already_active");
    }
    throw error;
  }
  const workspace = await createWorkspace(input.parentDirectory);
  let signalCleanupStarted = false;
  const cleanupForSignal = async (signal: NodeJS.Signals) => {
    if (signalCleanupStarted) return;
    signalCleanupStarted = true;
    for (const child of activeArchiveChildren) child.kill("SIGTERM");
    await lock.close().catch(() => undefined);
    await unlink(input.lockPath).catch(() => undefined);
    await rm(workspace.directory, { recursive: true, force: true });
    process.exit(signal === "SIGINT" ? 130 : 143);
  };
  const onInterrupt = () => void cleanupForSignal("SIGINT");
  const onTerminate = () => void cleanupForSignal("SIGTERM");
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);
  let succeeded = false;
  try {
    await lock.writeFile(`${process.pid}\n`, { encoding: "utf8" });
    const result = await input.action(workspace);
    succeeded = true;
    return result;
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
    await lock.close();
    await unlink(input.lockPath).catch(() => undefined);
    if (succeeded || !input.retainOnFailure) {
      await rm(workspace.directory, { recursive: true, force: true });
    } else {
      await chmod(workspace.directory, 0o700);
    }
  }
}

export async function assertRestrictedPath(path: string): Promise<void> {
  const details = await stat(path);
  if ((details.mode & 0o077) !== 0) throw new Error("archive_path_permissions_too_open");
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("end", resolvePromise);
    stream.once("error", rejectPromise);
  });
  return hash.digest("hex");
}

export async function writeCanonicalFile(path: string, value: unknown): Promise<string> {
  const serialized = canonicalJson(value);
  await writeFile(path, serialized, { encoding: "utf8", mode: 0o600, flag: "wx" });
  return sha256Hex(serialized);
}

export async function verifyStorageCopy(input: {
  metadata: Array<{
    bucket: string;
    path: string;
    version: string | null;
    sizeBytes: number;
    contentType: string | null;
    providerEtag: string | null;
    lastModified: string | null;
  }>;
  storageDirectory: string;
  capturedAt: string;
}): Promise<StorageInventory> {
  const objects: StorageObject[] = [];
  for (const metadata of input.metadata) {
    const localPath = safeStorageObjectPath(
      input.storageDirectory,
      metadata.bucket,
      metadata.path,
    );
    await chmod(localPath, 0o600).catch(() => undefined);
    const details = await stat(localPath).catch(() => null);
    if (!details?.isFile() || details.size !== metadata.sizeBytes) {
      throw new Error("storage_inventory_copy_mismatch");
    }
    objects.push(
      storageObjectSchema.parse({
        ...metadata,
        localSha256: await sha256File(localPath),
      }),
    );
  }
  return normalizeStorageInventory({ capturedAt: input.capturedAt, objects });
}

export function safeStorageObjectPath(
  storageDirectory: string,
  bucket: string,
  objectPath: string,
): string {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(bucket)) {
    throw new Error("archive_storage_bucket_invalid");
  }
  if (!objectPath || objectPath.includes("\0")) {
    throw new Error("archive_storage_path_invalid");
  }
  const root = resolve(storageDirectory);
  const candidate = resolve(root, bucket, objectPath);
  if (!candidate.startsWith(`${root}${sep}`)) {
    throw new Error("archive_storage_path_escape");
  }
  return candidate;
}

export function reconcileVerifiedCopies(input: {
  before: StorageInventory;
  after: StorageInventory;
  verifiedCopy: StorageInventory;
}): StorageInventory {
  return reconcileStorageInventories({
    before: input.before,
    after: input.after,
    copied: input.verifiedCopy.objects,
  });
}

export function resticRetentionArgs(): string[] {
  return [
    "forget",
    "--keep-daily",
    "30",
    "--keep-weekly",
    "13",
    "--keep-monthly",
    "12",
    "--tag",
    "project-recovery",
    "--prune",
  ];
}

export function resticBackupArgs(input: {
  workspaceDirectory: string;
  archiveTreeDirectory: string;
  runKey: string;
}): string[] {
  return [
    "backup",
    "--compression",
    "max",
    "--tag",
    "project-recovery",
    "--tag",
    `run:${input.runKey}`,
    input.workspaceDirectory,
    input.archiveTreeDirectory,
  ];
}

export function assertArchiveTreeReachability(input: {
  catalogPackageKeys: string[];
  archiveTreeDirectory: string;
  reachableRelativePaths: string[];
}): void {
  const reachable = new Set(input.reachableRelativePaths.map((path) => path.replaceAll("\\", "/")));
  for (const packageKey of input.catalogPackageKeys) {
    const expected = relative(
      input.archiveTreeDirectory,
      safeStorageObjectPath(input.archiveTreeDirectory, "packages", packageKey),
    ).replaceAll("\\", "/");
    if (![...reachable].some((path) => path === expected || path.startsWith(`${expected}/`))) {
      throw new Error("archive_package_not_reachable");
    }
  }
}

export async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}
