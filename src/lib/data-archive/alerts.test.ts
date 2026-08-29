import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildArchiveDirectAlert,
  isArchiveRunMissed,
  sendArchiveDirectAlert,
} from "./alerts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Samson direct archive alerts", () => {
  it("renders only fixed sanitized content", () => {
    const alert = buildArchiveDirectAlert({
      kind: "integrity-failed",
      runKey: "run/unsafe path and filename.csv",
      occurredAt: new Date("2026-08-27T10:00:00.000Z"),
    });
    expect(alert.idempotencyKey).toMatch(/^[a-z0-9._:-]+$/);
    expect(JSON.stringify(alert)).not.toContain("filename.csv");
    expect(alert.summary).not.toMatch(/credential|password|recovery key/i);
  });

  it("keeps package verification failure details fixed and sanitized", () => {
    const alert = buildArchiveDirectAlert({
      kind: "verification-failed",
      runKey: "verify:api-package:001",
      occurredAt: new Date("2026-08-29T10:00:00.000Z"),
    });
    expect(alert.severity).toBe("critical");
    expect(alert.title).toContain("restore verification failed");
    expect(JSON.stringify(alert)).not.toMatch(/snapshot|checksum|\/srv\//i);
  });

  it("enforces a one-hour cooldown with deterministic local state", async () => {
    const root = join(tmpdir(), `archive-alert-${crypto.randomUUID()}`);
    roots.push(root);
    const statePath = join(root, "alerts.json");
    const send = vi.fn().mockResolvedValue({ id: "email-id" });
    const occurredAt = new Date("2026-08-27T10:00:00.000Z");
    await expect(sendArchiveDirectAlert({
      kind: "backup-failed",
      runKey: "backup:one",
      statePath,
      occurredAt,
      send,
    })).resolves.toEqual({ sent: true });
    await expect(sendArchiveDirectAlert({
      kind: "backup-failed",
      runKey: "backup:two",
      statePath,
      occurredAt: new Date("2026-08-27T10:30:00.000Z"),
      send,
    })).resolves.toEqual({ sent: false, reason: "cooldown" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await readFile(statePath, "utf8"))).toMatchObject({ sent: 1 });
  });

  it("detects a missed 2 AM Pacific recovery point after its grace period", () => {
    const now = new Date("2026-08-27T16:00:00.000Z"); // 9 AM Pacific
    expect(isArchiveRunMissed({ now, lastVerifiedAt: null })).toBe(true);
    expect(
      isArchiveRunMissed({
        now,
        lastVerifiedAt: new Date("2026-08-27T10:00:00.000Z"),
      }),
    ).toBe(false);
    expect(
      isArchiveRunMissed({
        now: new Date("2026-08-27T14:00:00.000Z"), // 7 AM, within grace
        lastVerifiedAt: null,
      }),
    ).toBe(false);
  });

  it("reads direct-alert credentials from protected files", async () => {
    const root = join(tmpdir(), `archive-alert-${crypto.randomUUID()}`);
    roots.push(root);
    await import("node:fs/promises").then(async ({ mkdir, writeFile }) => {
      await mkdir(root, { recursive: true });
      await Promise.all([
        writeFile(join(root, "api-key"), "resend-secret\n"),
        writeFile(join(root, "sender"), "Alerts <alerts@example.com>\n"),
        writeFile(join(root, "recipient"), "owner@example.com\n"),
      ]);
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email-id" }), { status: 200 }),
    );
    await expect(sendArchiveDirectAlert({
      kind: "backup-failed",
      runKey: "backup:protected-files",
      statePath: join(root, "state.json"),
      credentialFiles: {
        apiKey: join(root, "api-key"),
        sender: join(root, "sender"),
        recipient: join(root, "recipient"),
        detailsUrl: "https://data.accelerateglobal.org",
      },
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
