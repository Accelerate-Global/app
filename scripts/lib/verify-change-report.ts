import { manualStepCatalog, verificationCommandCatalog } from "../../config/change-impact";
import { runCommand } from "./command";
import { parseGitStatusPorcelain, type GitChangedFile } from "./git-status";
import { evaluateTestImpact } from "./test-impact";
import { createVerifyChangeReport, type VerifyChangeReport } from "./verify-change";
import { analyzeUiSmokeContracts } from "./ui-smoke-contract";

export type VerifyChangeCollection = {
  changedFiles: GitChangedFile[];
  report: VerifyChangeReport;
};

function printSection(title: string, items: string[]) {
  console.log(`\n${title}`);

  if (items.length === 0) {
    console.log("- none");
    return;
  }

  for (const item of items) {
    console.log(`- ${item}`);
  }
}

export async function collectVerifyChangeReport() {
  const { stdout } = await runCommand(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all", "-z"],
    { quiet: true },
  );
  const changedFiles = parseGitStatusPorcelain(stdout);
  const [contractReport, testDelta] = await Promise.all([
    analyzeUiSmokeContracts({ rootDir: process.cwd() }),
    evaluateTestImpact({
      rootDir: process.cwd(),
      changedFiles: changedFiles.map((file) => file.path),
    }),
  ]);

  return {
    changedFiles,
    report: createVerifyChangeReport({
      changedFiles: changedFiles.map((file) => file.path),
      contractIssues: contractReport.issues,
      testDelta,
    }),
  } satisfies VerifyChangeCollection;
}

export function printVerifyChangeReport(input: VerifyChangeCollection) {
  const { changedFiles, report } = input;

  printSection(
    "Changed files",
    changedFiles.map((file) => `${file.status} ${file.displayPath}`),
  );
  printSection(
    "Impacted domains",
    report.domains.map((domain) => domain.label),
  );
  printSection(
    "Required commands",
    report.requiredCommands.map(
      (commandId) =>
        `${verificationCommandCatalog[commandId].command}: ${verificationCommandCatalog[commandId].description}`,
    ),
  );
  printSection(
    "Recommended commands",
    report.recommendedCommands.map(
      (commandId) =>
        `${verificationCommandCatalog[commandId].command}: ${verificationCommandCatalog[commandId].description}`,
    ),
  );
  printSection(
    "Manual pre-ship steps",
    report.manualSteps.map(
      (stepId) =>
        `${manualStepCatalog[stepId].command}: ${manualStepCatalog[stepId].description}`,
    ),
  );
  printSection(
    "Targeted smoke subset",
    report.targetedSmoke.mode === "none"
      ? []
      : [
          ...(report.targetedSmoke.command
            ? [report.targetedSmoke.command]
            : []),
          ...report.targetedSmoke.summary,
        ],
  );
  printSection(
    "Required test updates",
    report.testDelta.missingTestUpdates.map(
      (mapping) =>
        `${mapping.sourcePath}: ${mapping.candidateTestPaths.join(", ")}`,
    ),
  );
  printSection(
    "Contract issues",
    report.contractIssues.map((issue) => issue.message),
  );
}
