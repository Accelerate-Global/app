import { chmod, mkdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertNoSecretArguments,
  assertRestrictedPath,
  resticBackupArgs,
  resticRetentionArgs,
  safeStorageObjectPath,
  sha256File,
  verifyStorageCopy,
  withExclusiveArchiveWorkspace,
  writeCanonicalFile,
} from "./backup-engine";

const paths: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(paths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("local data archive engine", () => {
  it("locks one run and always removes plaintext staging", async () => {
    const root = join(tmpdir(), `archive-engine-${crypto.randomUUID()}`);
    paths.push(root);
    const lockPath = join(root, "run.lock");
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let workspacePath = "";
    const first = withExclusiveArchiveWorkspace({
      lockPath,
      parentDirectory: root,
      action: async (workspace) => {
        workspacePath = workspace.directory;
        await held;
        return "done";
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(
      withExclusiveArchiveWorkspace({ lockPath, parentDirectory: root, action: async () => null }),
    ).rejects.toThrow("archive_run_already_active");
    release();
    await expect(first).resolves.toBe("done");
    await expect(stat(workspacePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps created paths private and rejects opened permissions", async () => {
    const root = join(tmpdir(), `archive-mode-${crypto.randomUUID()}`);
    paths.push(root);
    await mkdir(root, { mode: 0o700 });
    await assertRestrictedPath(root);
    await chmod(root, 0o755);
    await expect(assertRestrictedPath(root)).rejects.toThrow(
      "archive_path_permissions_too_open",
    );
  });

  it("never accepts credentials in process arguments", () => {
    expect(() =>
      assertNoSecretArguments({
        command: "pg_dump",
        args: ["postgresql://reader:secret@example.test/postgres"],
      }),
    ).toThrow("archive_secret_in_process_arguments");
    expect(() =>
      assertNoSecretArguments({ command: "pg_dump", args: ["--host", "db.example.test"] }),
    ).not.toThrow();
  });

  it("hashes canonical files and verifies copied Storage bytes", async () => {
    const root = join(tmpdir(), `archive-copy-${crypto.randomUUID()}`);
    paths.push(root);
    const storageRoot = join(root, "storage");
    const objectPath = safeStorageObjectPath(storageRoot, "bucket-one", "nested/data.json");
    await mkdir(join(objectPath, ".."), { recursive: true, mode: 0o700 });
    await writeFile(objectPath, "hello", { mode: 0o600 });
    const inventory = await verifyStorageCopy({
      storageDirectory: storageRoot,
      capturedAt: "2026-08-27T09:00:00.000Z",
      metadata: [
        {
          bucket: "bucket-one",
          path: "nested/data.json",
          version: null,
          sizeBytes: 5,
          contentType: "application/json",
          providerEtag: null,
          lastModified: null,
        },
      ],
    });
    expect(inventory.objectCount).toBe(1);
    expect(inventory.objects[0]?.localSha256).toBe(await sha256File(objectPath));

    const manifestPath = join(root, "manifest.json");
    const digest = await writeCanonicalFile(manifestPath, { b: 2, a: 1 });
    expect(digest).toBe(await sha256File(manifestPath));
  });

  it("rejects path escapes and defines encrypted deduplicating Restic policy", () => {
    expect(() => safeStorageObjectPath("/tmp/archive", "bucket", "../../escape"))
      .toThrow("archive_storage_path_escape");
    expect(resticBackupArgs({
      workspaceDirectory: "/stage/run",
      archiveTreeDirectory: "/archive/current",
      runKey: "backup:one",
    })).toEqual(expect.arrayContaining(["--compression", "max", "project-recovery"]));
    expect(resticRetentionArgs()).toEqual([
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
    ]);
  });
});
