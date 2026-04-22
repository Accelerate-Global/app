import { pathToFileURL } from "node:url";

import {
  buildLocalVerificationPlan,
  executeLocalVerificationPlan,
} from "./lib/local-verification";
import { runCommand } from "./lib/command";
import { type GitChangedFile } from "./lib/git-status";
import { evaluateTestImpact } from "./lib/test-impact";
import { analyzeUiSmokeContracts } from "./lib/ui-smoke-contract";
import { createVerifyChangeReport } from "./lib/verify-change";
import { printVerifyChangeReport } from "./lib/verify-change-report";
import {
  getTrackedFileTreeSha,
  loadVerificationReceipt,
  recordVerificationSuccess,
} from "./lib/verification-receipts";

function parseNullSeparatedPaths(output: string) {
  return output
    .split("\0")
    .map((token) => token.trim())
    .filter(Boolean);
}

async function collectShipLocalVerificationReport() {
  const { stdout } = await runCommand(
    "git",
    ["diff", "--name-only", "-z", "origin/main...HEAD"],
    { quiet: true, stdinMode: "ignore" },
  );
  const changedFiles = parseNullSeparatedPaths(stdout);
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
    changedFiles: changedFiles.map((filePath) => ({
      path: filePath,
      status: "M",
      displayPath: filePath,
    })) satisfies GitChangedFile[],
    report,
  };
}

export async function runVerifyShipLocal() {
  if (process.argv.includes("--deprecated-alias")) {
    console.warn(
      "verify:release is deprecated. Use pnpm run verify:ship:local instead.",
    );
  }

  const collection = await collectShipLocalVerificationReport();
  printVerifyChangeReport(collection);

  if (collection.report.exitCode !== 0) {
    process.exitCode = 1;
    return;
  }

  const rootDir = process.cwd();
  const treeSha = await getTrackedFileTreeSha(rootDir);
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
  });

  await recordVerificationSuccess({
    rootDir,
    treeSha,
    changedFiles: collection.report.changedFiles,
    commandIds: ["verify:ship:local"],
  });
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
