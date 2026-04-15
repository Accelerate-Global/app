import { runCommand } from "./lib/command";
import { analyzeUiSmokeContracts } from "./lib/ui-smoke-contract";
import { createVerifyChangeReport } from "./lib/verify-change";
import {
  manualStepCatalog,
  verificationCommandCatalog,
} from "../config/change-impact";

type GitChangedFile = {
  path: string;
  status: string;
  displayPath: string;
};

function parseGitStatusPorcelain(output: string): GitChangedFile[] {
  const entries: GitChangedFile[] = [];
  const tokens = output.split("\0");

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (!token) {
      continue;
    }

    const status = token.slice(0, 2);
    const firstPath = token.slice(3);
    const isRenameOrCopy = status.includes("R") || status.includes("C");

    if (isRenameOrCopy) {
      const nextPath = tokens[index + 1];

      if (!nextPath) {
        continue;
      }

      entries.push({
        path: nextPath,
        status: status.trim(),
        displayPath: `${nextPath} (from ${firstPath})`,
      });
      index += 1;
      continue;
    }

    entries.push({
      path: firstPath,
      status: status.trim() || "??",
      displayPath: firstPath,
    });
  }

  return entries;
}

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
    "Contract issues",
    report.contractIssues.map((issue) => issue.message),
  );

  process.exitCode = report.exitCode;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
