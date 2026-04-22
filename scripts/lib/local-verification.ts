import {
  verificationCommandCatalog,
  type SupabaseLifecycle,
  type VerificationCommandId,
} from "../../config/change-impact";
import type { VerifyChangeReport } from "./verify-change";
import { runCommand } from "./command";
import {
  isReceiptCommandId,
  isVerificationSatisfied,
  recordVerificationSuccess,
  type ReceiptCommandId,
  type VerificationReceipt,
} from "./verification-receipts";
import { recordVerificationTiming } from "./verification-timing";

export type LocalVerificationMode = "change-run" | "ship-local";
export type UiSmokeDiffRefs = {
  baseRef: string;
  headRef: string;
};

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

function toCommandInvocation(
  commandId: VerificationCommandId,
) {
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
}

async function pruneStoppedDockerContainers(context: string) {
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

function getStepSupabaseLifecycle(step: VerificationStep): SupabaseLifecycle {
  if (step.kind === "combined-ui-smoke") {
    return "prestart-required";
  }

  return verificationCommandCatalog[step.commandId].supabaseLifecycle;
}

function getStepTimingName(step: VerificationStep) {
  if (step.kind === "combined-ui-smoke") {
    return "test:ui:smoke:targeted+full";
  }

  return step.commandId;
}

function getCombinedUiSmokeCommandArgs(uiSmokeDiff?: UiSmokeDiffRefs) {
  const args = [
    "--import",
    "tsx",
    "scripts/run-ui-smoke.ts",
    "--targeted-and-full",
  ];

  if (uiSmokeDiff) {
    args.push("--base", uiSmokeDiff.baseRef, "--head", uiSmokeDiff.headRef);
  }

  return args;
}

function getCombinedUiSmokeLabel(uiSmokeDiff?: UiSmokeDiffRefs) {
  return `node ${getCombinedUiSmokeCommandArgs(uiSmokeDiff).join(" ")}`;
}

async function runVerificationStep(
  step: VerificationStep,
  options?: {
    uiSmokeDiff?: UiSmokeDiffRefs;
  },
) {
  if (step.kind === "combined-ui-smoke") {
    console.log(`\nRunning ${getCombinedUiSmokeLabel(options?.uiSmokeDiff)}`);
    await runCommand("node", getCombinedUiSmokeCommandArgs(options?.uiSmokeDiff));
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
  uiSmokeDiff?: UiSmokeDiffRefs;
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
    const supabaseLifecycle = getStepSupabaseLifecycle(step);
    const needsLocalSupabase = supabaseLifecycle !== "none";
    const stepStartedAt = Date.now();

    if (needsLocalSupabase) {
      await stopLocalSupabaseStack(`before ${getStepLabel(step)}`);
    }

    let stepError: unknown = null;

    try {
      await runVerificationStep(step, {
        uiSmokeDiff: input.uiSmokeDiff,
      });
    } catch (error) {
      stepError = error;
    } finally {
      if (needsLocalSupabase) {
        await stopLocalSupabaseStack(`after ${getStepLabel(step)}`);
      }
    }

    if (stepError) {
      await recordVerificationTiming({
        rootDir: input.rootDir,
        treeSha: input.treeSha,
        changedFiles: input.changedFiles,
        scope: "command",
        name: getStepTimingName(step),
        durationMs: Date.now() - stepStartedAt,
        status: "failed",
      });

      if (needsLocalSupabase) {
        await pruneStoppedDockerContainers(`after ${getStepLabel(step)} failed`);
      }

      throw stepError;
    }

    await recordVerificationTiming({
      rootDir: input.rootDir,
      treeSha: input.treeSha,
      changedFiles: input.changedFiles,
      scope: "command",
      name: getStepTimingName(step),
      durationMs: Date.now() - stepStartedAt,
      status: "passed",
    });

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
