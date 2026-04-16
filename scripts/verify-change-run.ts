import { verificationCommandCatalog, type VerificationCommandId } from "../config/change-impact";
import { runCommand } from "./lib/command";
import { collectVerifyChangeReport, printVerifyChangeReport } from "./lib/verify-change-report";

function toCommandInvocation(commandId: VerificationCommandId) {
  const [command, ...args] = verificationCommandCatalog[commandId].command.split(" ");
  return { command, args };
}

async function main() {
  const collection = await collectVerifyChangeReport();
  printVerifyChangeReport(collection);

  if (collection.report.exitCode !== 0) {
    process.exitCode = 1;
    return;
  }

  for (const commandId of collection.report.requiredCommands) {
    if (commandId === "verify:test-delta") {
      console.log(`\nRunning ${verificationCommandCatalog[commandId].command}`);
      console.log("verify:test-delta passed via verify:change preflight.");
      continue;
    }

    const invocation = toCommandInvocation(commandId);
    console.log(`\nRunning ${verificationCommandCatalog[commandId].command}`);
    await runCommand(invocation.command, invocation.args);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
