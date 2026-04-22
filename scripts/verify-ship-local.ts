import { pathToFileURL } from "node:url";

import {
  buildLocalVerificationPlan,
  executeLocalVerificationPlan,
} from "./lib/local-verification";
import { type GitChangedFile } from "./lib/git-status";
import { getShipLocalDiff } from "./lib/ship-local-changes";
import { evaluateTestImpact } from "./lib/test-impact";
import { analyzeUiSmokeContracts } from "./lib/ui-smoke-contract";
import { createVerifyChangeReport } from "./lib/verify-change";
import { printVerifyChangeReport } from "./lib/verify-change-report";
import {
  getTrackedFileTreeSha,
  loadVerificationReceipt,
  recordVerificationSuccess,
} from "./lib/verification-receipts";
import { recordVerificationTiming } from "./lib/verification-timing";

export async function collectShipLocalVerificationReport() {
  const shipLocalDiff = await getShipLocalDiff();
  const changedFiles = shipLocalDiff.changedFiles;
  const [contractReport, testDelta] = await Promise.all([
    analyzeUiSmokeContracts({ rootDir: process.cwd() }),
    evaluateTestImpact({
      rootDir: process.cwd(),
      changedFiles,
    }),
  ]);
  const report = createVerifyChangeReport({
    changedFiles,
    contractIssues: contractReport.issues,
    testDelta,
  });

  return {
    shipLocalDiff,
    changedFiles: changedFiles.map((filePath) => ({
      path: filePath,
      status: "M",
      displayPath: filePath,
    })) satisfies GitChangedFile[],
    report,
  };
}

export async function runVerifyShipLocal() {
  const startedAt = Date.now();

  if (process.argv.includes("--deprecated-alias")) {
    console.warn(
      "verify:release is deprecated. Use pnpm run verify:ship:local instead.",
    );
  }
  const rootDir = process.cwd();
  let treeSha: string | undefined;
  let changedFiles: string[] | undefined;

  try {
    const collection = await collectShipLocalVerificationReport();
    printVerifyChangeReport(collection);
    changedFiles = collection.report.changedFiles;

    if (collection.report.exitCode !== 0) {
      await recordVerificationTiming({
        rootDir,
        treeSha,
        changedFiles,
        scope: "verification-run",
        name: "verify:ship:local",
        durationMs: Date.now() - startedAt,
        status: "failed",
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
      mode: "ship-local",
      receipt,
      report: collection.report,
    });

    await executeLocalVerificationPlan({
      rootDir,
      treeSha,
      changedFiles: collection.report.changedFiles,
      plan,
      uiSmokeDiff: {
        baseRef: collection.shipLocalDiff.baseRef,
        headRef: collection.shipLocalDiff.headRef,
      },
    });

    await recordVerificationSuccess({
      rootDir,
      treeSha,
      changedFiles: collection.report.changedFiles,
      commandIds: ["verify:ship:local"],
    });
    await recordVerificationTiming({
      rootDir,
      treeSha,
      changedFiles,
      scope: "verification-run",
      name: "verify:ship:local",
      durationMs: Date.now() - startedAt,
      status: "passed",
    });
  } catch (error) {
    await recordVerificationTiming({
      rootDir,
      treeSha,
      changedFiles,
      scope: "verification-run",
      name: "verify:ship:local",
      durationMs: Date.now() - startedAt,
      status: "failed",
    });
    throw error;
  }
}

function isMainModule(metaUrl: string) {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
}

if (isMainModule(import.meta.url)) {
  void runVerifyShipLocal().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
