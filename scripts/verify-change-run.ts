import { verificationCommandCatalog, type VerificationCommandId } from "../config/change-impact";
import { runCommand } from "./lib/command";
import { collectVerifyChangeReport, printVerifyChangeReport } from "./lib/verify-change-report";

const localSupabaseCommandIds = new Set<VerificationCommandId>([
  "test:ui:smoke",
  "test:ui:smoke:targeted",
  "db:security",
]);

function toCommandInvocation(commandId: VerificationCommandId) {
  const [command, ...args] = verificationCommandCatalog[commandId].command.split(" ");
  return { command, args };
}

async function stopLocalSupabaseStack(context: string) {
  try {
    console.log(`Stopping local Supabase stack ${context}`);
    await runCommand("supabase", ["stop"]);
  } catch (error) {
    console.warn(
      `Could not stop local Supabase stack ${context}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  try {
    console.log(`Pruning stopped Docker containers ${context}`);
    await runCommand("docker", ["container", "prune", "-f"]);
  } catch (error) {
    console.warn(
      `Could not prune stopped Docker containers ${context}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function startLocalSupabaseStack(context: string) {
  console.log(`Starting local Supabase stack ${context}`);
  await runCommand("supabase", ["start"]);
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

    if (
      commandId === "test:ui:smoke:targeted" &&
      collection.report.targetedSmoke.mode === "full" &&
      collection.report.requiredCommands.includes("test:ui:smoke")
    ) {
      console.log(`\nSkipping ${verificationCommandCatalog[commandId].command}`);
      console.log(
        "Targeted smoke resolves to the same full suite already required by pnpm run test:ui:smoke.",
      );
      continue;
    }

    const invocation = toCommandInvocation(commandId);
    console.log(`\nRunning ${verificationCommandCatalog[commandId].command}`);

    if (localSupabaseCommandIds.has(commandId)) {
      await stopLocalSupabaseStack(
        `before ${verificationCommandCatalog[commandId].command}`,
      );

      if (commandId === "db:security") {
        await startLocalSupabaseStack(
          `before ${verificationCommandCatalog[commandId].command}`,
        );
      }
    }

    try {
      await runCommand(invocation.command, invocation.args);
    } finally {
      if (localSupabaseCommandIds.has(commandId)) {
        await stopLocalSupabaseStack(
          `after ${verificationCommandCatalog[commandId].command}`,
        );
      }
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
