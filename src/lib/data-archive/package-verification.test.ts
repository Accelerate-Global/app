import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canonicalJson,
  canonicalSha256,
  sha256Hex,
  type ArchivePackageContent,
} from "./canonical";
import type { ArchiveWorkerConfig } from "./config";
import {
  buildPackageVerificationReceiptPayload,
  packageVerificationCatalogSql,
  parseApiRunPackageVerificationCandidate,
  restoreAndVerifyApiRunPackage,
  verifyRestoredApiRunPackageDirectory,
  type ApiRunPackageVerificationCandidate,
} from "./package-verification";

const roots: string[] = [];
const checksum = (character: string) => character.repeat(64);

async function fixture() {
  const root = join(tmpdir(), `archive-package-verification-${crypto.randomUUID()}`);
  roots.push(root);
  const packageDirectory = join(root, "package");
  const rows = Buffer.from('{"schemaVersion":1,"columns":[],"rows":[]}');
  const raw = Buffer.from("[]");
  const members = [
    {
      kind: "rows-manifest",
      sourceTable: null,
      sourceIdentifier: "run-one",
      storageBucket: "api-connection-artifacts",
      storageObjectPath: "api-connection-runs/run-one/rows.json",
      contentType: "application/json",
      sha256: sha256Hex(rows),
      sizeBytes: rows.byteLength,
    },
    {
      kind: "raw-manifest",
      sourceTable: null,
      sourceIdentifier: "run-one",
      storageBucket: "api-connection-artifacts",
      storageObjectPath: "api-connection-runs/run-one/raw.json",
      contentType: "application/json",
      sha256: sha256Hex(raw),
      sizeBytes: raw.byteLength,
    },
  ];
  const content: ArchivePackageContent = {
    schemaVersion: 1,
    packageKey: `api-run/run-one/${checksum("d")}`,
    packageKind: "api-run",
    sourceIdentifier: "run-one",
    sourceCreatedAt: "2026-06-01T00:00:00.000Z",
    sourceSha256: checksum("d"),
    members,
    rowCount: 0,
    objectCount: 2,
    sizeBytes: rows.byteLength + raw.byteLength,
  };
  const archiveSnapshotId = checksum("e");
  const candidate: ApiRunPackageVerificationCandidate = {
    packageKey: content.packageKey,
    packageKind: "api-run",
    packageStatus: "verified",
    sourceChecksum: content.sourceSha256,
    manifestChecksum: canonicalSha256({ ...content, archiveSnapshotId }),
    archiveSnapshotId,
    sizeBytes: content.sizeBytes,
    members: members.map((member) => ({
      memberKind: member.kind,
      storageBucket: member.storageBucket!,
      storageObjectName: member.storageObjectPath!,
      contentChecksum: member.sha256,
      sizeBytes: member.sizeBytes,
    })),
  };
  await mkdir(packageDirectory, { recursive: true, mode: 0o700 });
  await writeFile(join(packageDirectory, "package.json"), canonicalJson(content), {
    mode: 0o600,
  });
  for (const [member, body] of [[members[0]!, rows], [members[1]!, raw]] as const) {
    const target = join(
      packageDirectory,
      "objects",
      member.storageBucket!,
      member.storageObjectPath!,
    );
    await mkdir(join(target, ".."), { recursive: true, mode: 0o700 });
    await writeFile(target, body, { mode: 0o600 });
  }
  return { root, packageDirectory, candidate, content };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Samson API package restore verification", () => {
  it("parses one exact hot verified catalog package", () => {
    const value = JSON.stringify({
      packageKey: `api-run/run-one/${checksum("d")}`,
      packageKind: "api-run",
      packageStatus: "verified",
      sourceChecksum: checksum("d"),
      manifestChecksum: checksum("a"),
      archiveSnapshotId: checksum("b"),
      sizeBytes: 2,
      members: [{
        memberKind: "rows-manifest",
        storageBucket: "api-connection-artifacts",
        storageObjectName: "runs/one/rows.json",
        contentChecksum: checksum("c"),
        sizeBytes: 2,
      }],
    });
    expect(parseApiRunPackageVerificationCandidate(value).packageStatus).toBe("verified");
    expect(() => parseApiRunPackageVerificationCandidate(
      value.replace('"verified"', '"cold"'),
    )).toThrow("archive_verification_package_not_hot_verified");
    expect(packageVerificationCatalogSql(
      `api-run/run-one/${checksum("d")}`,
    )).toContain(
      `where package.package_key = 'api-run/run-one/${checksum("d")}'`,
    );
    expect(() => packageVerificationCatalogSql("unsafe'package"))
      .toThrow();
  });

  it("verifies manifest identity, catalog members, file sizes, and checksums", async () => {
    const value = await fixture();
    await expect(verifyRestoredApiRunPackageDirectory({
      packageDirectory: value.packageDirectory,
      candidate: value.candidate,
    })).resolves.toEqual({ memberCount: 2, totalBytes: value.content.sizeBytes });
    const rawPath = join(
      value.packageDirectory,
      "objects/api-connection-artifacts/api-connection-runs/run-one/raw.json",
    );
    await writeFile(rawPath, "tampered", { mode: 0o600 });
    await expect(verifyRestoredApiRunPackageDirectory({
      packageDirectory: value.packageDirectory,
      candidate: value.candidate,
    })).rejects.toThrow("archive_verification_member_checksum_mismatch");
  });

  it("restores only the selected package and removes private staging afterward", async () => {
    const value = await fixture();
    const stateDirectory = join(value.root, "state");
    const stagingDirectory = join(value.root, "staging");
    await Promise.all([
      mkdir(stateDirectory, { recursive: true, mode: 0o700 }),
      mkdir(stagingDirectory, { recursive: true, mode: 0o700 }),
    ]);
    const config = {
      stateDirectory,
      stagingDirectory,
      resticEnvironment: {},
    } as ArchiveWorkerConfig;
    const runCommand = vi.fn(async (command: { args: string[] }) => {
      const target = command.args[command.args.indexOf("--target") + 1]!;
      const restored = join(target, "snapshot/archive-packages", value.candidate.packageKey);
      await mkdir(join(restored, ".."), { recursive: true, mode: 0o700 });
      await cp(value.packageDirectory, restored, { recursive: true });
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    await expect(restoreAndVerifyApiRunPackage({
      config,
      candidate: value.candidate,
      dependencies: {
        runCommand,
        fetchImpl: vi.fn(),
        now: () => new Date("2026-08-29T09:00:00.000Z"),
      },
    })).resolves.toEqual({ memberCount: 2, totalBytes: value.content.sizeBytes });
    expect(runCommand).toHaveBeenCalledWith(expect.objectContaining({
      command: "restic",
      args: expect.arrayContaining([
        value.candidate.archiveSnapshotId,
        `*/archive-packages/${value.candidate.packageKey}/**`,
      ]),
    }));
    expect(await readdir(stagingDirectory)).toEqual([]);
  });

  it("builds terminal signed-receipt payloads without local archive paths", async () => {
    const value = await fixture();
    const payload = buildPackageVerificationReceiptPayload({
      config: { projectRef: "uuyntfbqksnclyvlpecx" } as ArchiveWorkerConfig,
      candidate: value.candidate,
      requestKey: "verify:api-package:001",
      requestedByOwnerId: "owner-one",
      completedAt: new Date("2026-08-29T09:00:00.000Z"),
      status: "verified",
      failureCode: null,
    });
    expect(payload.memberCount).toBe(2);
    expect(payload.totalBytes).toBe(value.content.sizeBytes);
    expect(JSON.stringify(payload)).not.toMatch(/\/srv\/|\/var\/cache\/|resticRepository/);
    expect(await readFile(join(value.packageDirectory, "package.json"), "utf8"))
      .toContain(value.candidate.packageKey);
  });
});
