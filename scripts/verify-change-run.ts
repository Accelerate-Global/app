import { pathToFileURL } from "node:url";

import {
  buildLocalVerificationPlan,
  executeLocalVerificationPlan,
} from "./lib/local-verification";
import { collectVerifyChangeReport, printVerifyChangeReport } from "./lib/verify-change-report";
import { printVerificationTimingSummary } from "./lib/verification-timing-summary";
import {
  getTrackedFileTreeSha,
  loadVerificationReceipt,
} from "./lib/verification-receipts";
import { recordVerificationTiming } from "./lib/verification-timing";

export async function runVerifyChangeRun() {
  const rootDir = process.cwd();
  const startedAt = Date.now();
  let treeSha: string | undefined;
  let changedFiles: string[] | undefined;

  try {
    const collection = await collectVerifyChangeReport();
    printVerifyChangeReport(collection);
    changedFiles = collection.report.changedFiles;

    if (collection.report.exitCode !== 0) {
      await recordVerificationTiming({
        rootDir,
        treeSha,
        changedFiles,
        scope: "verification-run",
        name: "verify:change:run",
        durationMs: Date.now() - startedAt,
        status: "failed",
      });
      await printVerificationTimingSummary({
        rootDir,
        changedFiles,
      });
      process.exitCode = 1;
      return;
    }

    treeSha = await getTrackedFileTreeSha(rootDir);
    const receipt = await loadVerificationReceipt({
      rootDir,
      treeSha,
      changedFiles: collection.report.changedFiles,
    });
    const plan = buildLocalVerificationPlan({
      mode: "change-run",
      receipt,
      report: collection.report,
    });

    await executeLocalVerificationPlan({
      rootDir,
      treeSha,
      changedFiles: collection.report.changedFiles,
      plan,
    });

    await recordVerificationTiming({
      rootDir,
      treeSha,
      changedFiles,
      scope: "verification-run",
      name: "verify:change:run",
      durationMs: Date.now() - startedAt,
      status: "passed",
    });
    await printVerificationTimingSummary({
      rootDir,
      changedFiles,
    });
  } catch (error) {
    await recordVerificationTiming({
      rootDir,
      treeSha,
      changedFiles,
      scope: "verification-run",
      name: "verify:change:run",
      durationMs: Date.now() - startedAt,
      status: "failed",
    });

    if (changedFiles) {
      await printVerificationTimingSummary({
        rootDir,
        changedFiles,
      });
    }

    throw error;
  }
}

function isMainModule(metaUrl: string) {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
}

if (isMainModule(import.meta.url)) {
  void runVerifyChangeRun().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
