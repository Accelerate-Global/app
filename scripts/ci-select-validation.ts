import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  resolveChangeImpact,
  selectCiAppQualityTasks,
  selectCiPreinstallValidation,
  shouldRunAppQualityOnCi,
  type VerificationCommandId,
} from "../config/change-impact";
import { runCommand } from "./lib/command";
import { resolveUiSmokeSelection } from "./lib/ui-smoke-selection";
import { parseGitStatusPorcelain } from "./lib/git-status";

const uiSmokeCommandIds = new Set<VerificationCommandId>([
  "smoke:check",
  "test:ui:smoke:targeted",
  "test:ui:smoke",
]);

export type CiValidationSelection = {
  changedFiles: string[];
  appQuality: boolean;
  appLint: boolean;
  appTest: boolean;
  appBuild: boolean;
  databaseSecurity: boolean;
  dependencyAudit: boolean;
  uiSmoke: boolean;
  uiSmokeMode: "none" | "targeted" | "full";
  uiSmokeBrowser: boolean;
  matchedDomains: string[];
  requiredCommands: VerificationCommandId[];
  uiSmokeSummary: string[];
};

function readFlag(name: string) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function parseNullSeparatedPaths(output: string) {
  return output
    .split("\0")
    .map((token) => token.trim())
    .filter(Boolean);
}

export function selectCiValidation(changedFiles: string[]): CiValidationSelection {
  const impact = resolveChangeImpact(changedFiles);
  const preinstallSelection = selectCiPreinstallValidation(changedFiles);
  const appTaskSelection = selectCiAppQualityTasks(changedFiles);
  const uiSmokeSelection = resolveUiSmokeSelection(changedFiles);
  const uiSmokeContractRequired =
    impact.requiredCommands.some((commandId) => uiSmokeCommandIds.has(commandId));
  const uiSmoke =
    preinstallSelection.runUiSmoke &&
    (uiSmokeContractRequired || uiSmokeSelection.mode !== "none");
  const uiSmokeMode = !uiSmoke
    ? "none"
    : impact.requiredCommands.includes("test:ui:smoke") || uiSmokeSelection.mode === "full"
      ? "full"
      : "targeted";

  return {
    changedFiles: impact.changedFiles,
    appQuality: shouldRunAppQualityOnCi(impact.changedFiles),
    appLint: appTaskSelection.lint,
    appTest: appTaskSelection.test,
    appBuild: appTaskSelection.build,
    databaseSecurity: preinstallSelection.runDatabaseSecurity,
    dependencyAudit: preinstallSelection.runDependencyAudit,
    uiSmoke,
    uiSmokeMode,
    uiSmokeBrowser:
      uiSmokeMode === "full" || uiSmokeSelection.mode === "targeted",
    matchedDomains: impact.domains.map((domain) => domain.label),
    requiredCommands: impact.requiredCommands,
    uiSmokeSummary: uiSmokeSelection.summary,
  };
}

async function getChangedFiles(input: { baseSha: string | null; headSha: string | null }) {
  if (Boolean(input.baseSha) !== Boolean(input.headSha)) {
    throw new Error("Pass both --base and --head together when selecting CI validation.");
  }

  if (input.baseSha && input.headSha) {
    const { stdout } = await runCommand(
      "git",
      ["diff", "--name-only", "-z", `${input.baseSha}...${input.headSha}`],
      { quiet: true, stdinMode: "ignore" },
    );

    return parseNullSeparatedPaths(stdout);
  }

  const { stdout } = await runCommand(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all", "-z"],
    { quiet: true, stdinMode: "ignore" },
  );

  return parseGitStatusPorcelain(stdout).map((file) => file.path);
}

async function writeGitHubOutputs(selection: CiValidationSelection) {
  const outputPath = process.env.GITHUB_OUTPUT;

  if (!outputPath) {
    return;
  }

  const lines = [
    `app_quality=${selection.appQuality}`,
    `app_lint=${selection.appLint}`,
    `app_test=${selection.appTest}`,
    `app_build=${selection.appBuild}`,
    `database_security=${selection.databaseSecurity}`,
    `dependency_audit=${selection.dependencyAudit}`,
    `ui_smoke=${selection.uiSmoke}`,
    `ui_smoke_mode=${selection.uiSmokeMode}`,
    `ui_smoke_browser=${selection.uiSmokeBrowser}`,
  ];

  await appendFile(outputPath, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const baseSha = readFlag("--base");
  const headSha = readFlag("--head");
  const changedFiles = await getChangedFiles({ baseSha, headSha });
  const selection = selectCiValidation(changedFiles);

  console.log(`Changed files: ${selection.changedFiles.length}`);
  console.log(`App Quality: ${selection.appQuality}`);
  console.log(
    `App Quality Tasks: lint=${selection.appLint} test=${selection.appTest} build=${selection.appBuild}`,
  );
  console.log(`Database Security: ${selection.databaseSecurity}`);
  console.log(`Dependency Audit: ${selection.dependencyAudit}`);
  console.log(`UI Smoke: ${selection.uiSmokeMode}`);

  if (selection.matchedDomains.length > 0) {
    console.log(`Matched domains: ${selection.matchedDomains.join(", ")}`);
  }

  if (selection.uiSmokeSummary.length > 0) {
    console.log("UI smoke selection:");
    for (const line of selection.uiSmokeSummary) {
      console.log(`- ${line}`);
    }
  }

  await writeGitHubOutputs(selection);
}

function isMainModule(metaUrl: string) {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
}

if (isMainModule(import.meta.url)) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
