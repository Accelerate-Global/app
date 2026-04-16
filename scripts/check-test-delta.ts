import { evaluateTestImpact, formatMissingTestUpdate, formatTestDeltaMapping } from "./lib/test-impact";
import { runCommand } from "./lib/command";
import { parseGitStatusPorcelain } from "./lib/git-status";

function parseNullSeparatedPaths(output: string) {
  return output
    .split("\0")
    .map((token) => token.trim())
    .filter(Boolean);
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

async function getChangedFiles() {
  const baseSha = process.env.VERIFY_TEST_DELTA_BASE_SHA;
  const headSha = process.env.VERIFY_TEST_DELTA_HEAD_SHA;

  if (baseSha && headSha) {
    const { stdout } = await runCommand(
      "git",
      ["diff", "--name-only", "-z", baseSha, headSha],
      { quiet: true },
    );

    return parseNullSeparatedPaths(stdout);
  }

  const { stdout } = await runCommand(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all", "-z"],
    { quiet: true },
  );

  return parseGitStatusPorcelain(stdout).map((file) => file.path);
}

async function main() {
  const changedFiles = await getChangedFiles();
  const report = await evaluateTestImpact({
    rootDir: process.cwd(),
    changedFiles,
  });

  printSection("Changed files", report.changedFiles);
  printSection("Changed tests", report.changedTestFiles);
  printSection(
    "Covered source changes",
    report.mappings.map(formatTestDeltaMapping),
  );
  printSection(
    "Missing test updates",
    report.missingTestUpdates.map(formatMissingTestUpdate),
  );

  process.exitCode = report.exitCode;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
