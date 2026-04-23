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

export type ReportSection = {
  title: string;
  items: string[];
};

const planningCommands = [
  "[planning] pnpm run task:kickoff -- --scope <path-or-glob>: Record the kickoff brief for the current task, including unrelated dirty files when scope is provided. Required during the active 3-task UI/admin pilot.",
  "[planning] pnpm run verify:change: Plan the current worktree and required verification commands before editing.",
] as const;

const terminalGuidance = [
  "[terminal] pnpm run verify:change:run: Run the required local checks once for the current candidate tracked tree.",
  "[terminal] pnpm run verify:ship:local: Use only for merge or release readiness after change-run passes.",
] as const;

const workflowWarnings = [
  "Do not run pnpm run test:ui:smoke manually before pnpm run verify:change:run unless you are isolating a browser-specific failure after targeted smoke or the terminal gate fails.",
] as const;

export function printSection(title: string, items: string[]) {
  console.log(`\n${title}`);

  if (items.length === 0) {
    console.log("- none");
    return;
  }

  for (const item of items) {
    console.log(`- ${item}`);
  }
}

function formatVerificationCommand(commandId: keyof typeof verificationCommandCatalog) {
  const command = verificationCommandCatalog[commandId];

  return `[${command.usage}] ${command.command}: ${command.description}`;
}

export function buildVerifyChangeSections(input: VerifyChangeCollection): ReportSection[] {
  const { changedFiles, report } = input;

  return [
    {
      title: "Changed files",
      items: changedFiles.map((file) => `${file.status} ${file.displayPath}`),
    },
    {
      title: "Impacted domains",
      items: report.domains.map((domain) => domain.label),
    },
    {
      title: "Planning commands",
      items: [...planningCommands],
    },
    {
      title: "Required commands",
      items: report.requiredCommands.map((commandId) => formatVerificationCommand(commandId)),
    },
    {
      title: "Recommended commands",
      items: report.recommendedCommands.map((commandId) =>
        formatVerificationCommand(commandId),
      ),
    },
    {
      title: "Manual pre-ship steps",
      items: report.manualSteps.map(
        (stepId) =>
          `${manualStepCatalog[stepId].command}: ${manualStepCatalog[stepId].description}`,
      ),
    },
    {
      title: "Targeted smoke subset",
      items:
        report.targetedSmoke.mode === "none"
          ? []
          : [
              ...(report.targetedSmoke.command
                ? [report.targetedSmoke.command]
                : []),
              ...report.targetedSmoke.summary,
            ],
    },
    {
      title: "Terminal gate",
      items: [...terminalGuidance],
    },
    {
      title: "Workflow warnings",
      items: [...workflowWarnings],
    },
    {
      title: "Required test updates",
      items: report.testDelta.missingTestUpdates.map(
        (mapping) =>
          `${mapping.sourcePath}: ${mapping.candidateTestPaths.join(", ")}`,
      ),
    },
    {
      title: "Contract issues",
      items: report.contractIssues.map((issue) => issue.message),
    },
  ];
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
  for (const section of buildVerifyChangeSections(input)) {
    printSection(section.title, section.items);
  }
}
