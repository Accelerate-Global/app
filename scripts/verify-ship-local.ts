import { pathToFileURL } from "node:url";

import {
  buildLocalVerificationPlan,
  executeLocalVerificationPlan,
} from "./lib/local-verification";
import { collectVerifyChangeReport, printVerifyChangeReport } from "./lib/verify-change-report";
import {
  getTrackedFileTreeSha,
  loadVerificationReceipt,
} from "./lib/verification-receipts";

export async function runVerifyShipLocal() {
  if (process.argv.includes("--deprecated-alias")) {
    console.warn(
      "verify:release is deprecated. Use pnpm run verify:ship:local instead.",
    );
  }

  const collection = await collectVerifyChangeReport();
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
