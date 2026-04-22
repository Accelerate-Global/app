import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(__dirname, "..", "config", "change-impact.manifest.json");

function readFlag(name) {
  const index = process.argv.indexOf(name);

  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function parseNullSeparatedPaths(output) {
  return output
    .split("\0")
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function normalizeChangedFiles(changedFiles) {
  return [...new Set(changedFiles.map(normalizePath))].sort();
}

function matchesAnyPattern(filePath, patterns) {
  return patterns.some((pattern) =>
    path.matchesGlob ? path.matchesGlob(filePath, pattern) : filePath === pattern,
  );
}

function matchesChangedFiles(changedFiles, patterns) {
  return changedFiles.some((filePath) => matchesAnyPattern(filePath, patterns));
}

function getChangedFiles({ baseSha, headSha }) {
  if (Boolean(baseSha) !== Boolean(headSha)) {
    throw new Error(
      "Pass both --base and --head together when selecting preinstall CI validation.",
    );
  }

  if (baseSha && headSha) {
    return parseNullSeparatedPaths(
      execFileSync("git", ["diff", "--name-only", "-z", `${baseSha}...${headSha}`], {
        encoding: "utf8",
      }),
    );
  }

  const output = execFileSync(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all", "-z"],
    { encoding: "utf8" },
  );

  return output
    .split("\0")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((entry) => entry.slice(3));
}

function writeGitHubOutputs(selection) {
  const outputPath = process.env.GITHUB_OUTPUT;

  if (!outputPath) {
    return;
  }

  const lines = [
    `run_app_quality=${selection.runAppQuality}`,
    `run_ui_smoke=${selection.runUiSmoke}`,
    `run_database_security=${selection.runDatabaseSecurity}`,
    `run_dependency_audit=${selection.runDependencyAudit}`,
  ];

  appendFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
}

function main() {
  const baseSha = readFlag("--base");
  const headSha = readFlag("--head");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const changedFiles = normalizeChangedFiles(getChangedFiles({ baseSha, headSha }));
  const preinstallWorkflows = manifest.ci.preinstallWorkflows;
  const selection = {
    runAppQuality: matchesChangedFiles(
      changedFiles,
      preinstallWorkflows.appQualityPatterns,
    ),
    runUiSmoke: matchesChangedFiles(
      changedFiles,
      preinstallWorkflows.uiSmokePatterns,
    ),
    runDatabaseSecurity: matchesChangedFiles(
      changedFiles,
      preinstallWorkflows.databaseSecurityPatterns,
    ),
    runDependencyAudit: matchesChangedFiles(
      changedFiles,
      preinstallWorkflows.dependencyAuditPatterns,
    ),
  };

  console.log(`Changed files: ${changedFiles.length}`);
  console.log(`Run App Quality: ${selection.runAppQuality}`);
  console.log(`Run UI Smoke: ${selection.runUiSmoke}`);
  console.log(`Run Database Security: ${selection.runDatabaseSecurity}`);
  console.log(`Run Dependency Audit: ${selection.runDependencyAudit}`);

  writeGitHubOutputs(selection);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
