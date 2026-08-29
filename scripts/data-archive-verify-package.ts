import { readArchiveWorkerConfig } from "@/lib/data-archive/config";
import { sendArchiveDirectAlert } from "@/lib/data-archive/alerts";
import {
  buildPackageVerificationReceiptPayload,
  defaultPackageVerificationDependencies,
  loadApiRunPackageVerificationCandidate,
  normalizePackageVerificationFailure,
  restoreAndVerifyApiRunPackage,
  submitPackageVerificationReceipt,
} from "@/lib/data-archive/package-verification";

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
    process.env.DATA_ARCHIVE_PACKAGE_VERIFICATION_ENABLED !== "true"
  ) {
    throw new Error(
      "Package verification requires --package-key, --request-key, --owner, --approve, and DATA_ARCHIVE_PACKAGE_VERIFICATION_ENABLED=true.",
    );
  }

  const config = readArchiveWorkerConfig();
  const candidate = await loadApiRunPackageVerificationCandidate({
    config,
    packageKey,
  });
  try {
    const verified = await restoreAndVerifyApiRunPackage({ config, candidate });
    const completedAt = defaultPackageVerificationDependencies.now();
    await submitPackageVerificationReceipt({
      config,
      payload: buildPackageVerificationReceiptPayload({
        config,
        candidate,
        requestKey,
        requestedByOwnerId: owner,
        completedAt,
        status: "verified",
        failureCode: null,
      }),
    });
    process.stdout.write(`${JSON.stringify({
      ok: true,
      packageKey: candidate.packageKey,
      memberCount: verified.memberCount,
      totalBytes: verified.totalBytes,
      temporaryStagingRemoved: true,
    })}\n`);
  } catch (error) {
    const failureCode = normalizePackageVerificationFailure(error);
    const completedAt = defaultPackageVerificationDependencies.now();
    await submitPackageVerificationReceipt({
      config,
      payload: buildPackageVerificationReceiptPayload({
        config,
        candidate,
        requestKey,
        requestedByOwnerId: owner,
        completedAt,
        status: "failed",
        failureCode,
      }),
    }).catch(() => undefined);
    await sendArchiveDirectAlert({
      kind: "verification-failed",
      runKey: requestKey,
      statePath: config.alertStateFile,
      credentialFiles: config.directAlertCredentialFiles,
    }).catch(() => undefined);
    throw error;
  }
}

main().catch((error) => {
  const code = normalizePackageVerificationFailure(error);
  process.stderr.write(`Data archive package verification failed (${code}).\n`);
  process.exitCode = 1;
});
