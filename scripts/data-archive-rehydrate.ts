import { readArchiveWorkerConfig } from "@/lib/data-archive/config";
import { sendArchiveDirectAlert } from "@/lib/data-archive/alerts";
import { rehydrateApiRunPackage } from "@/lib/data-archive/rehydration";

function flag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function main() {
  const packageKey = flag("--package-key");
  const requestKey = flag("--request-key");
  const owner = flag("--owner");
  if (
    !packageKey ||
    !requestKey ||
    !owner ||
    !process.argv.includes("--approve") ||
    process.env.DATA_ARCHIVE_REHYDRATION_ENABLED !== "true"
  ) {
    throw new Error(
      "Rehydration requires --package-key, --request-key, --owner, --approve, and DATA_ARCHIVE_REHYDRATION_ENABLED=true.",
    );
  }
  const config = readArchiveWorkerConfig();
  try {
    const result = await rehydrateApiRunPackage({
      config,
      packageKey,
      requestKey,
      requestedByOwnerId: owner,
    });
    process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
  } catch (error) {
    await sendArchiveDirectAlert({
      kind: "rehydration-failed",
      runKey: requestKey,
      statePath: config.alertStateFile,
      credentialFiles: config.directAlertCredentialFiles,
    }).catch(() => undefined);
    throw error;
  }
}

main().catch((error) => {
  const code = error instanceof Error
    ? error.message.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 128)
    : "archive-rehydration-failed";
  process.stderr.write(`Data archive rehydration failed (${code}).\n`);
  process.exitCode = 1;
});
