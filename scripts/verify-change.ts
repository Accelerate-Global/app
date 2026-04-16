import { runCommand } from "./lib/command";
import { parseGitStatusPorcelain } from "./lib/git-status";
import { analyzeUiSmokeContracts } from "./lib/ui-smoke-contract";
import { createVerifyChangeReport } from "./lib/verify-change";
import {
  manualStepCatalog,
  verificationCommandCatalog,
} from "../config/change-impact";

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

async function main() {
  const [{ stdout }, contractReport] = await Promise.all([
    runCommand("git", ["status", "--porcelain=v1", "--untracked-files=all", "-z"], {
      quiet: true,
    }),
    analyzeUiSmokeContracts({ rootDir: process.cwd() }),
  ]);
  const changedFiles = parseGitStatusPorcelain(stdout);
  const report = createVerifyChangeReport({
    changedFiles: changedFiles.map((file) => file.path),
    contractIssues: contractReport.issues,
  });

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
    "Contract issues",
    report.contractIssues.map((issue) => issue.message),
  );

  process.exitCode = report.exitCode;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
