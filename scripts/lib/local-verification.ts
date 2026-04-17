import {
  verificationCommandCatalog,
  type VerificationCommandId,
} from "../../config/change-impact";
import type { VerifyChangeReport } from "./verify-change";
import { runCommand } from "./command";
import { hasUsableSupabaseStatusOutput } from "./ui-smoke-env";
import {
  isReceiptCommandId,
  isVerificationSatisfied,
  recordVerificationSuccess,
  type ReceiptCommandId,
  type VerificationReceipt,
} from "./verification-receipts";

export type LocalVerificationMode = "change-run" | "ship-local";

export type VerificationStep =
  | {
      kind: "command";
      commandId: VerificationCommandId;
    }
  | {
      kind: "combined-ui-smoke";
    };

export type LocalVerificationPlan = {
  reusedCommands: VerificationCommandId[];
  steps: VerificationStep[];
};

const smokeCheckCommandId = "smoke:check";
const targetedSmokeCommandId = "test:ui:smoke:targeted";
const fullSmokeCommandId = "test:ui:smoke";
const smokeCommandIds = new Set<VerificationCommandId>([
  smokeCheckCommandId,
  targetedSmokeCommandId,
  fullSmokeCommandId,
]);
const localSupabaseCommandIds = new Set<VerificationCommandId>([
  targetedSmokeCommandId,
  fullSmokeCommandId,
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

async function hasUsableLocalSupabaseStatus() {
  try {
    const status = await runCommand("supabase", ["status", "-o", "env"], {
      quiet: true,
    });

    return hasUsableSupabaseStatusOutput(status.stdout);
  } catch {
    return false;
  }
}

async function startLocalSupabaseStack(context: string) {
  console.log(`Starting local Supabase stack ${context}`);

  try {
    await runCommand("supabase", ["start", "--ignore-health-check"]);
  } catch (error) {
    if (!(await hasUsableLocalSupabaseStatus())) {
      throw error;
    }

    console.warn(
      `Supabase start exited non-zero ${context}, but local status is available. Continuing.`,
    );
  }
}

function getReceiptCommandIdsForSuccessfulStep(step: VerificationStep): ReceiptCommandId[] {
  if (step.kind === "combined-ui-smoke") {
    return [
      smokeCheckCommandId,
      targetedSmokeCommandId,
      fullSmokeCommandId,
    ];
  }

  switch (step.commandId) {
    case targetedSmokeCommandId:
      return [smokeCheckCommandId, targetedSmokeCommandId];
    case fullSmokeCommandId:
      return [
        smokeCheckCommandId,
        targetedSmokeCommandId,
        fullSmokeCommandId,
      ];
    default:
      return isReceiptCommandId(step.commandId) ? [step.commandId] : [];
  }
}

function getSmokePlan(input: {
  mode: LocalVerificationMode;
  receipt: VerificationReceipt | null;
  report: VerifyChangeReport;
}) {
  const reusedCommands: VerificationCommandId[] = [];
  const steps: VerificationStep[] = [];
  const selectionRequiresFullOnly = input.report.targetedSmoke.mode === "full";
  const needsSmokeCheck = input.report.requiredCommands.includes(smokeCheckCommandId);
  const needsTargetedSmoke =
    !selectionRequiresFullOnly &&
    (
      input.report.requiredCommands.includes(targetedSmokeCommandId) ||
      (input.mode === "ship-local" && input.report.targetedSmoke.mode === "targeted")
    );
  const needsFullSmoke =
    input.report.requiredCommands.includes(fullSmokeCommandId) ||
    (input.mode === "ship-local" && input.report.targetedSmoke.mode === "targeted");
  const smokeCheckSatisfied =
    needsSmokeCheck &&
    isVerificationSatisfied(input.receipt, smokeCheckCommandId);
  const targetedSmokeSatisfied =
    needsTargetedSmoke &&
    isVerificationSatisfied(input.receipt, targetedSmokeCommandId);
  const fullSmokeSatisfied =
    needsFullSmoke &&
    isVerificationSatisfied(input.receipt, fullSmokeCommandId);

  if (needsSmokeCheck && smokeCheckSatisfied) {
    reusedCommands.push(smokeCheckCommandId);
  }

  if (needsTargetedSmoke && targetedSmokeSatisfied) {
    reusedCommands.push(targetedSmokeCommandId);
  }

  if (needsFullSmoke && fullSmokeSatisfied) {
    reusedCommands.push(fullSmokeCommandId);
  }

  if (needsTargetedSmoke && needsFullSmoke) {
    if (!targetedSmokeSatisfied && !fullSmokeSatisfied) {
      steps.push({ kind: "combined-ui-smoke" });
    } else if (!fullSmokeSatisfied) {
      steps.push({
        kind: "command",
        commandId: fullSmokeCommandId,
      });
    }
  } else if (needsFullSmoke && !fullSmokeSatisfied) {
    steps.push({
      kind: "command",
      commandId: fullSmokeCommandId,
    });
  } else if (needsTargetedSmoke && !targetedSmokeSatisfied) {
    steps.push({
      kind: "command",
      commandId: targetedSmokeCommandId,
    });
  }

  if (needsSmokeCheck && !smokeCheckSatisfied && steps.length === 0) {
    steps.unshift({
      kind: "command",
      commandId: smokeCheckCommandId,
    });
  }

  return {
    reusedCommands,
    steps,
  };
}

export function buildLocalVerificationPlan(input: {
  mode: LocalVerificationMode;
  receipt: VerificationReceipt | null;
  report: VerifyChangeReport;
}) {
  const reusedCommands: VerificationCommandId[] = [];
  const steps: VerificationStep[] = [];
  const smokePlan = getSmokePlan(input);
  let smokePlanInserted = false;

  for (const commandId of input.report.requiredCommands) {
    if (smokeCommandIds.has(commandId)) {
      if (!smokePlanInserted) {
        steps.push(...smokePlan.steps);
        reusedCommands.push(...smokePlan.reusedCommands);
        smokePlanInserted = true;
      }

      continue;
    }

    if (isReceiptCommandId(commandId) && isVerificationSatisfied(input.receipt, commandId)) {
      reusedCommands.push(commandId);
      continue;
    }

    steps.push({
      kind: "command",
      commandId,
    });
  }

  if (!smokePlanInserted) {
    steps.push(...smokePlan.steps);
    reusedCommands.push(...smokePlan.reusedCommands);
  }

  return {
    reusedCommands: [...new Set(reusedCommands)],
    steps,
  } satisfies LocalVerificationPlan;
}

function getStepLabel(step: VerificationStep) {
  if (step.kind === "combined-ui-smoke") {
    return "node --import tsx scripts/run-ui-smoke.ts --targeted-and-full";
  }

  return verificationCommandCatalog[step.commandId].command;
}

async function runVerificationStep(step: VerificationStep) {
  if (step.kind === "combined-ui-smoke") {
    console.log(`\nRunning ${getStepLabel(step)}`);
    await runCommand("node", [
      "--import",
      "tsx",
      "scripts/run-ui-smoke.ts",
      "--targeted-and-full",
    ]);
    return;
  }

  console.log(`\nRunning ${verificationCommandCatalog[step.commandId].command}`);

  if (step.commandId === "verify:test-delta") {
    console.log("verify:test-delta passed via verify:change preflight.");
    return;
  }

  const invocation = toCommandInvocation(step.commandId);

  await runCommand(invocation.command, invocation.args);
}

export async function executeLocalVerificationPlan(input: {
  rootDir: string;
  treeSha: string;
  changedFiles: string[];
  plan: LocalVerificationPlan;
}) {
  const shortTreeSha = input.treeSha.slice(0, 12);

  for (const commandId of input.plan.reusedCommands) {
    console.log(
      `Reused prior pass for ${verificationCommandCatalog[commandId].command} on tracked tree ${shortTreeSha}.`,
    );
  }

  if (input.plan.steps.length === 0) {
    console.log(`All required local checks already passed for tracked tree ${shortTreeSha}.`);
    return;
  }

  for (const step of input.plan.steps) {
    const needsLocalSupabase =
      step.kind === "combined-ui-smoke" ||
      (step.kind === "command" && localSupabaseCommandIds.has(step.commandId));

    if (needsLocalSupabase) {
      await stopLocalSupabaseStack(`before ${getStepLabel(step)}`);

      if (step.kind === "command" && step.commandId === "db:security") {
        await startLocalSupabaseStack(`before ${getStepLabel(step)}`);
      }
    }

    try {
      await runVerificationStep(step);
    } finally {
      if (needsLocalSupabase) {
        await stopLocalSupabaseStack(`after ${getStepLabel(step)}`);
      }
    }

    const successfulCommandIds = getReceiptCommandIdsForSuccessfulStep(step);

    if (successfulCommandIds.length > 0) {
      await recordVerificationSuccess({
        rootDir: input.rootDir,
        treeSha: input.treeSha,
        changedFiles: input.changedFiles,
        commandIds: successfulCommandIds,
      });
    }
  }
}
