import { collectVerifyChangeReport, printVerifyChangeReport } from "./lib/verify-change-report";

async function main() {
  const collection = await collectVerifyChangeReport();
  printVerifyChangeReport(collection);
  process.exitCode = collection.report.exitCode;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
