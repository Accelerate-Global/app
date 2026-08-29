import { readArchiveWorkerConfig } from "@/lib/data-archive/config";
import {
  executeArchiveBackup,
  readLastSuccessfulArchiveRun,
  submitArchiveFailureReceipt,
} from "@/lib/data-archive/archive-runner";
import {
  isArchiveRunMissed,
  sendArchiveDirectAlert,
} from "@/lib/data-archive/alerts";

function normalizeFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "backup-failed";
  return message
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 128) || "backup-failed";
}

function failureRunKey(now = new Date()) {
  return `failure:${now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
}

async function runBackup() {
  const config = readArchiveWorkerConfig();
  try {
    const result = await executeArchiveBackup(config);
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        runKey: result.runKey,
        snapshotId: result.snapshotId,
        databaseBytes: result.databaseBytes,
        storageBytes: result.storageBytes,
        storageObjectCount: result.storageObjectCount,
        uniqueBytesAdded: result.uniqueBytesAdded,
        siteProtection: result.siteProtection,
        offsiteProtected: result.offsiteProtected,
      })}\n`,
    );
  } catch (error) {
    const code = normalizeFailureCode(error);
    const runKey = failureRunKey();
    let receiptDelivered = false;
    try {
      await submitArchiveFailureReceipt({ config, runKey, failureCode: code });
      receiptDelivered = true;
    } catch {
      // Direct delivery below is independent from Supabase and the receipt route.
    }
    if (!receiptDelivered) {
      const kind = code.includes("receipt")
        ? "receipt-unavailable" as const
        : "backup-failed" as const;
      await sendArchiveDirectAlert({
        kind,
        runKey,
        statePath: config.alertStateFile,
        credentialFiles: config.directAlertCredentialFiles,
      }).catch(() => undefined);
    }
    process.stderr.write(`Samson data archive failed (${code}).\n`);
    process.exitCode = 1;
  }
}

async function checkMissedRun() {
  const config = readArchiveWorkerConfig();
  const now = new Date();
  const lastVerifiedAt = await readLastSuccessfulArchiveRun(config.lastSuccessFile);
  if (!isArchiveRunMissed({ now, lastVerifiedAt })) {
    process.stdout.write(`${JSON.stringify({ ok: true, missed: false })}\n`);
    return;
  }
  await sendArchiveDirectAlert({
    kind: "missed-run",
    runKey: `missed:${now.toISOString().slice(0, 10).replaceAll("-", "")}`,
    statePath: config.alertStateFile,
    occurredAt: now,
    credentialFiles: config.directAlertCredentialFiles,
  });
  process.stdout.write(`${JSON.stringify({ ok: false, missed: true })}\n`);
  process.exitCode = 1;
}

async function main() {
  const command = process.argv[2] ?? "run";
  if (command === "run") return runBackup();
  if (command === "check-missed") return checkMissedRun();
  throw new Error("Usage: samson-data-archive.ts [run|check-missed]");
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Samson data archive command failed."}\n`,
  );
  process.exitCode = 1;
});
