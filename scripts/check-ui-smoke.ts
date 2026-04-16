import { analyzeUiSmokeContracts } from "./lib/ui-smoke-contract";

async function main() {
  const report = await analyzeUiSmokeContracts({
    rootDir: process.cwd(),
    writeFixtureManifest: true,
  });

  if (report.issues.length > 0) {
    throw new Error(
      [
        "UI smoke contract check failed:",
        ...report.issues.map((issue) => `- ${issue.message}`),
      ].join("\n"),
    );
  }

  console.log(
    `UI smoke contract OK: ${report.pageFiles.length} pages, ${report.componentBaseNames.length} shared components.`,
  );
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[contract] ${message}`);
  process.exitCode = 1;
});
