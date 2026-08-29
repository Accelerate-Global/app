import { beforeEach, describe, expect, it, vi } from "vitest";

import { signBackupReceipt, type BackupReceiptPayload } from "@/lib/data-archive/canonical";
import { enqueueOperationalAlert } from "@/lib/operational-alerts";
import { persistBackupReceipt } from "@/lib/data-archive/receipt";

import { POST } from "./route";

vi.mock("@/lib/operational-alerts", () => ({ enqueueOperationalAlert: vi.fn() }));
vi.mock("@/lib/data-archive/receipt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data-archive/receipt")>();
  return { ...actual, persistBackupReceipt: vi.fn() };
});

const key = "receipt-key-with-at-least-thirty-two-characters";
const checksum = (character: string) => character.repeat(64);

function payload(overrides: Partial<BackupReceiptPayload> = {}): BackupReceiptPayload {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    runKey: "backup:2026-08-27:001",
    nonce: "nonce-2026-08-27-000000000001",
    issuedAt: now,
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
    integrityVerifiedAt: now,
    completedAt: now,
    failureCode: null,
    packages: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATA_ARCHIVE_RECEIPT_SIGNING_KEY = key;
  vi.mocked(persistBackupReceipt).mockResolvedValue({
    backupRunId: "run-id",
    replayed: false,
  });
  vi.mocked(enqueueOperationalAlert).mockResolvedValue({ queued: true });
});

describe("POST /api/internal/archive-receipts", () => {
  it("accepts a signed receipt without exposing archive addressing", async () => {
    const response = await POST(
      new Request("https://data.accelerateglobal.org/api/internal/archive-receipts", {
        method: "POST",
        body: JSON.stringify(signBackupReceipt(payload(), key)),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, replayed: false });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("rejects invalid and oversized receipts", async () => {
    const invalid = await POST(
      new Request("https://data.accelerateglobal.org/api/internal/archive-receipts", {
        method: "POST",
        body: JSON.stringify({ invalid: true }),
      }),
    );
    expect(invalid.status).toBe(401);
    expect(persistBackupReceipt).not.toHaveBeenCalled();

    const oversized = await POST(
      new Request("https://data.accelerateglobal.org/api/internal/archive-receipts", {
        method: "POST",
        headers: { "content-length": String(300 * 1024) },
        body: "{}",
      }),
    );
    expect(oversized.status).toBe(413);
  });

  it("queues bounded operational alerts once for a failed receipt", async () => {
    const failedPayload = payload({
      status: "failed",
      manifestSha256: null,
      resticSnapshotId: null,
      integrityVerifiedAt: null,
      failureCode: "database-export-failed",
    });
    const response = await POST(
      new Request("https://data.accelerateglobal.org/api/internal/archive-receipts", {
        method: "POST",
        body: JSON.stringify(signBackupReceipt(failedPayload, key)),
      }),
    );
    expect(response.status).toBe(200);
    expect(enqueueOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({ source: "data.archive", severity: "critical" }),
    );
  });

  it("does not alert twice for an idempotent replay", async () => {
    vi.mocked(persistBackupReceipt).mockResolvedValueOnce({
      backupRunId: "run-id",
      replayed: true,
    });
    const response = await POST(
      new Request("https://data.accelerateglobal.org/api/internal/archive-receipts", {
        method: "POST",
        body: JSON.stringify(signBackupReceipt(payload({
          status: "failed",
          manifestSha256: null,
          resticSnapshotId: null,
          integrityVerifiedAt: null,
          failureCode: "database-export-failed",
        }), key)),
      }),
    );
    expect(response.status).toBe(200);
    expect(enqueueOperationalAlert).not.toHaveBeenCalled();
  });
});
