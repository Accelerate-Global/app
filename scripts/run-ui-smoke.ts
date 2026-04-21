import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  UI_SMOKE_TMP_DIR,
} from "../tests/ui/support/smoke-data";
import { parseGitStatusPorcelain } from "./lib/git-status";
import {
  buildUiSmokeCommandEnv,
  hasUsableSupabaseStatusOutput,
  parseSupabaseEnvOutput,
} from "./lib/ui-smoke-env";
import {
  buildUiSmokeGrepPattern,
  formatUiSmokeZeroMatchMessage,
  resolveUiSmokeSelection,
  type UiSmokeSelection,
} from "./lib/ui-smoke-selection";

function runCommand(
  command: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    captureOutput?: boolean;
    timeoutMs?: number;
  } = {},
) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: options.env ?? process.env,
      stdio: options.captureOutput ? ["inherit", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeoutId = options.timeoutMs
      ? setTimeout(() => {
          if (settled) {
            return;
          }

          settled = true;
          child.kill("SIGTERM");
          reject(
            new Error(
              `${command} ${args.join(" ")} timed out after ${options.timeoutMs}ms`,
            ),
          );
        }, options.timeoutMs)
      : null;

    function clearTimeoutIfNeeded() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    if (options.captureOutput) {
      child.stdout?.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });
    }

    child.on("exit", (code) => {
      if (settled) {
        clearTimeoutIfNeeded();
        return;
      }

      settled = true;
      clearTimeoutIfNeeded();

      if (code === 0) {
        resolve(stdout);
        return;
      }

      const capturedOutput = [stderr, stdout].filter(Boolean).join("\n");
      reject(
        new Error(
          `${command} ${args.join(" ")} exited with code ${code ?? "unknown"}${
            capturedOutput ? `\n${capturedOutput}` : ""
          }`,
        ),
      );
    });
    child.on("error", (error) => {
      if (settled) {
        clearTimeoutIfNeeded();
        return;
      }

      settled = true;
      clearTimeoutIfNeeded();
      reject(error);
    });
  });
}

export function parseRunUiSmokeArgs(argv: string[]) {
  const headed = argv.includes("--headed");
  const fullAfterTargeted = argv.includes("--targeted-and-full");
  const targeted = argv.includes("--targeted") || fullAfterTargeted;
  const baseSha = (() => {
    const index = argv.indexOf("--base");

    return index === -1 ? null : (argv[index + 1] ?? null);
  })();
  const headSha = (() => {
    const index = argv.indexOf("--head");

    return index === -1 ? null : (argv[index + 1] ?? null);
  })();

  if (Boolean(baseSha) !== Boolean(headSha)) {
    throw new Error("Pass both --base and --head together when running targeted UI smoke.");
  }

  return {
    headed,
    fullAfterTargeted,
    targeted,
    baseSha,
    headSha,
  };
}

function parseNullSeparatedPaths(output: string) {
  return output
    .split("\0")
    .map((token) => token.trim())
    .filter(Boolean);
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export const DEFAULT_SUPABASE_PORT_RELEASE_WAIT = {
  maxAttempts: 30,
  retryDelayMs: 2_000,
} as const;
export const DEFAULT_UI_SMOKE_SUPABASE_START_TIMEOUT_MS = 120_000;
export const CI_UI_SMOKE_SUPABASE_START_TIMEOUT_MS = 300_000;
export const UI_SMOKE_DB_RESET_ARGS = [
  "db",
  "reset",
  "--local",
  "--no-seed",
  "--yes",
] as const;

export function getUiSmokeSupabaseStartTimeoutMs(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return environment.CI ? CI_UI_SMOKE_SUPABASE_START_TIMEOUT_MS : DEFAULT_UI_SMOKE_SUPABASE_START_TIMEOUT_MS;
}

function createPipelineError(
  classification: "bootstrap" | "contract" | "product",
  message: string,
  error: unknown,
) {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`[${classification}] ${message}\n${detail}`);
}

async function canListenOnPort(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

async function assertSupabasePortsAvailable() {
  const requiredPorts = [54321, 54322, 54323, 54324, 54327];
  const busyPorts: number[] = [];

  for (const port of requiredPorts) {
    if (!(await canListenOnPort(port))) {
      busyPorts.push(port);
    }
  }

  if (busyPorts.length > 0) {
    throw new Error(
      `Local Supabase smoke run cannot start because these ports are already in use: ${busyPorts.join(", ")}. Stop the other local Supabase stack first, then rerun pnpm run test:ui:smoke.`,
    );
  }
}

async function waitForSupabasePortsAvailable(options?: {
  maxAttempts?: number;
  retryDelayMs?: number;
}) {
  let lastError: unknown = null;
  const maxAttempts = options?.maxAttempts ?? DEFAULT_SUPABASE_PORT_RELEASE_WAIT.maxAttempts;
  const retryDelayMs =
    options?.retryDelayMs ?? DEFAULT_SUPABASE_PORT_RELEASE_WAIT.retryDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await assertSupabasePortsAvailable();
      return;
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        throw error;
      }

      console.warn(
        `Local Supabase ports are still being released. Retrying in ${retryDelayMs}ms (${attempt}/${maxAttempts - 1}).`,
      );
      await sleep(retryDelayMs);
    }
  }

  throw lastError;
}

function isDockerPruneInProgressError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("a prune operation is already running")
  );
}

function isSupabaseStartupRaceError(error: unknown) {
  return (
    error instanceof Error &&
    (
      error.message.includes("container is not ready: starting") ||
      error.message.includes("error running container: exit 143") ||
      error.message.includes("timed out") ||
      error.message.includes("failed to inspect container health") ||
      error.message.includes("failed to read docker logs") ||
      error.message.includes("No such container") ||
      error.message.includes("failed to dial native") ||
      error.message.includes("connect: connection refused")
    )
  );
}

function isSupabaseStartRetryableError(error: unknown) {
  return (
    error instanceof Error &&
    (
      error.message.includes("ports are not available") ||
      error.message.includes("container name") ||
      isSupabaseStartupRaceError(error)
    )
  );
}

function isSupabaseDbResetRetryableError(error: unknown) {
  return (
    error instanceof Error &&
    (
      isSupabaseStartupRaceError(error) ||
      error.message.includes("supabase start is not running") ||
      error.message.includes("open supabase/.temp/profile")
    )
  );
}

function isLocalStackNotReadyError(error: unknown) {
  return (
    error instanceof Error &&
    (
      error.message.includes("relation \"public.signup_email_allowlist\" does not exist") ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("the database system is starting up") ||
      error.message.includes("connection refused")
    )
  );
}

async function runStage(
  classification: "bootstrap" | "contract" | "product",
  message: string,
  command: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    captureOutput?: boolean;
    timeoutMs?: number;
  } = {},
) {
  try {
    return await runCommand(command, args, options);
  } catch (error) {
    throw createPipelineError(classification, message, error);
  }
}

async function runStageWithRetry(input: {
  classification: "bootstrap" | "contract" | "product";
  message: string;
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  captureOutput?: boolean;
  timeoutMs?: number;
  attempts: number;
  retryDelayMs: number;
  shouldRetry: (error: unknown) => boolean;
  beforeRetry?: (error: unknown, attempt: number) => Promise<void>;
}) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= input.attempts; attempt += 1) {
    try {
      return await runStage(
        input.classification,
        input.message,
        input.command,
        input.args,
        {
          env: input.env,
          captureOutput: input.captureOutput,
          timeoutMs: input.timeoutMs,
        },
      );
    } catch (error) {
      lastError = error;

      if (attempt === input.attempts || !input.shouldRetry(error)) {
        throw error;
      }

      if (input.beforeRetry) {
        await input.beforeRetry(error, attempt);
      }

      console.warn(
        `${input.message} Retrying in ${input.retryDelayMs}ms (${attempt}/${input.attempts - 1}).`,
      );
      await sleep(input.retryDelayMs);
    }
  }

  throw lastError;
}

async function resetSupabaseAfterStartupFailure() {
  let stopTriggeredPrune = false;

  try {
    await runCommand("supabase", ["stop"], {
      captureOutput: true,
      timeoutMs: 120_000,
    });
  } catch (error) {
    stopTriggeredPrune = isDockerPruneInProgressError(error);
    console.warn(
      `Could not stop local Supabase stack before retry: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!stopTriggeredPrune) {
    try {
      await runCommand("docker", ["container", "prune", "-f"], {
        captureOutput: true,
        timeoutMs: 120_000,
      });
    } catch (error) {
      console.warn(
        `Could not prune stopped Docker containers before retry: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  await waitForSupabasePortsAvailable(DEFAULT_SUPABASE_PORT_RELEASE_WAIT);
  await sleep(3_000);
}

async function hasUsableLocalSupabaseStatus() {
  try {
    const statusOutput = await runCommand("supabase", ["status", "-o", "env"], {
      captureOutput: true,
      timeoutMs: 30_000,
    });

    return hasUsableSupabaseStatusOutput(statusOutput);
  } catch {
    return false;
  }
}

async function startLocalSupabaseStack() {
  const startTimeoutMs = getUiSmokeSupabaseStartTimeoutMs();

  try {
    await runStageWithRetry({
      classification: "bootstrap",
      message: "supabase start failed.",
      command: "supabase",
      args: ["start", "--ignore-health-check"],
      captureOutput: true,
      attempts: 3,
      retryDelayMs: 3_000,
      timeoutMs: startTimeoutMs,
      shouldRetry: isSupabaseStartRetryableError,
      beforeRetry: async () => {
        await resetSupabaseAfterStartupFailure();
      },
    });
  } catch (error) {
    if (!(await hasUsableLocalSupabaseStatus())) {
      throw error;
    }

    console.warn(
      "supabase start exited non-zero, but the local Supabase status is available. Continuing.",
    );
  }

  await sleep(3_000);
}

function printSelectionSummary(lines: string[]) {
  if (lines.length === 0) {
    return;
  }

  console.log("Targeted smoke selection:");
  for (const line of lines) {
    console.log(`- ${line}`);
  }
}

export type UiSmokeSuitePlan = {
  kind: "targeted" | "full";
  grepPattern: string | null;
  projectNames: string[];
};

export type UiSmokeRunPlan = {
  selection: UiSmokeSelection | null;
  suites: UiSmokeSuitePlan[];
  summary: string[];
};

export function buildUiSmokeRunPlan(input: {
  changedFiles: string[];
  targeted: boolean;
  fullAfterTargeted: boolean;
}) {
  const selection = input.targeted
    ? resolveUiSmokeSelection(input.changedFiles)
    : null;

  if (selection?.mode === "none") {
    return {
      selection,
      suites: [],
      summary: [],
    } satisfies UiSmokeRunPlan;
  }

  if (!selection) {
    return {
      selection: null,
      suites: [
        {
          kind: "full",
          grepPattern: null,
          projectNames: [],
        },
      ],
      summary: [],
    } satisfies UiSmokeRunPlan;
  }

  if (selection.mode === "full") {
    return {
      selection,
      suites: [
        {
          kind: "full",
          grepPattern: null,
          projectNames: [],
        },
      ],
      summary: selection.summary,
    } satisfies UiSmokeRunPlan;
  }

  const grepPattern = buildUiSmokeGrepPattern(selection);
  const suites: UiSmokeSuitePlan[] = [
    {
      kind: "targeted",
      grepPattern,
      projectNames: selection.projectNames,
    },
  ];

  if (input.fullAfterTargeted) {
    suites.push({
      kind: "full",
      grepPattern: null,
      projectNames: [],
    });
  }

  return {
    selection,
    suites,
    summary: selection.summary,
  } satisfies UiSmokeRunPlan;
}

export function resolveUiSmokeChangedFiles(input: {
  targeted: boolean;
  baseSha: string | null;
  headSha: string | null;
  diffFiles: string[];
  statusFiles: string[];
}) {
  if (!input.targeted) {
    return [];
  }

  if (input.baseSha && input.headSha) {
    return input.diffFiles;
  }

  return input.statusFiles;
}

async function getChangedFilesForRunPlan(input: {
  targeted: boolean;
  baseSha: string | null;
  headSha: string | null;
}) {
  if (!input.targeted) {
    return [];
  }

  if (input.baseSha && input.headSha) {
    return parseNullSeparatedPaths(
      await runCommand(
        "git",
        ["diff", "--name-only", "-z", `${input.baseSha}...${input.headSha}`],
        { captureOutput: true },
      ),
    );
  }

  return parseGitStatusPorcelain(
    await runCommand(
      "git",
      ["status", "--porcelain=v1", "--untracked-files=all", "-z"],
      { captureOutput: true },
    ),
  ).map((file) => file.path);
}

async function validateTargetedSelection(input: {
  grepPattern: string;
  projectNames: string[];
  targetedSelection: NonNullable<ReturnType<typeof resolveUiSmokeSelection>>;
}) {
  const playwrightArgs = [
    "exec",
    "playwright",
    "test",
    "-c",
    "playwright.smoke.config.ts",
    "--list",
    "--grep",
    input.grepPattern,
  ];

  for (const projectName of input.projectNames) {
    playwrightArgs.push("--project", projectName);
  }

  try {
    await runCommand("pnpm", playwrightArgs, { captureOutput: true });
  } catch (error) {
    throw createPipelineError(
      "contract",
      formatUiSmokeZeroMatchMessage({
        grepPattern: input.grepPattern,
        selection: input.targetedSelection,
      }),
      error,
    );
  }
}

async function main() {
  const { headed, fullAfterTargeted, targeted, baseSha, headSha } =
    parseRunUiSmokeArgs(process.argv);
  const changedFiles = await getChangedFilesForRunPlan({
    targeted,
    baseSha,
    headSha,
  });
  const runPlan = buildUiSmokeRunPlan({
    changedFiles,
    targeted,
    fullAfterTargeted,
  });

  if (runPlan.selection?.mode === "none") {
    console.log(
      "No targeted UI smoke routes or journeys matched the current diff. Running smoke:check only.",
    );
    await runStage(
      "contract",
      "UI smoke contract validation failed.",
      "pnpm",
      ["run", "smoke:check"],
    );
    return;
  }

  if (runPlan.summary.length > 0) {
    printSelectionSummary(runPlan.summary);
  }
  const targetedSuite = runPlan.suites.find((suite) => suite.kind === "targeted");

  if (
    runPlan.selection?.mode === "targeted" &&
    targetedSuite?.grepPattern
  ) {
    await validateTargetedSelection({
      grepPattern: targetedSuite.grepPattern,
      projectNames: targetedSuite.projectNames,
      targetedSelection: runPlan.selection,
    });
  }

  await mkdir(UI_SMOKE_TMP_DIR, { recursive: true });
  try {
    await waitForSupabasePortsAvailable();
  } catch (error) {
    throw createPipelineError(
      "bootstrap",
      "Local Supabase ports are unavailable.",
      error,
    );
  }
  await sleep(3_000);
  await startLocalSupabaseStack();
  await runStageWithRetry({
    classification: "bootstrap",
    message: "supabase db reset failed.",
    command: "supabase",
    args: [...UI_SMOKE_DB_RESET_ARGS],
    captureOutput: true,
    attempts: 3,
    retryDelayMs: 2_000,
    timeoutMs: 120_000,
    shouldRetry: isSupabaseDbResetRetryableError,
    beforeRetry: async () => {
      await resetSupabaseAfterStartupFailure();
      await startLocalSupabaseStack();
    },
  });
  const statusOutput = await runStage(
    "bootstrap",
    "supabase status failed.",
    "supabase",
    ["status", "-o", "env"],
    { captureOutput: true },
  );
  const playwrightTmpDir = path.join(UI_SMOKE_TMP_DIR, "playwright-tmp");

  await mkdir(playwrightTmpDir, { recursive: true });
  const smokeEnv = {
    ...buildUiSmokeCommandEnv(parseSupabaseEnvOutput(statusOutput)),
    TMPDIR: playwrightTmpDir,
  };

  await runStageWithRetry({
    classification: "bootstrap",
    message: "UI smoke preflight failed.",
    command: "pnpm",
    args: ["run", "smoke:preflight"],
    env: smokeEnv,
    attempts: 5,
    retryDelayMs: 2_000,
    shouldRetry: isLocalStackNotReadyError,
  });
  await runStageWithRetry({
    classification: "bootstrap",
    message: "UI smoke bootstrap failed.",
    command: "pnpm",
    args: ["run", "smoke:bootstrap"],
    env: smokeEnv,
    attempts: 5,
    retryDelayMs: 2_000,
    shouldRetry: isLocalStackNotReadyError,
  });
  await runStage(
    "contract",
    "UI smoke contract validation failed.",
    "pnpm",
    ["run", "smoke:check"],
    { env: smokeEnv },
  );
  await runStage("product", "Next build failed before browser smoke.", "pnpm", ["build"], {
    env: smokeEnv,
  });

  for (const suite of runPlan.suites) {
    const playwrightArgs = [
      "exec",
      "playwright",
      "test",
      "-c",
      "playwright.smoke.config.ts",
    ];

    if (suite.grepPattern) {
      playwrightArgs.push("--grep", suite.grepPattern);
    }

    for (const projectName of suite.projectNames) {
      playwrightArgs.push("--project", projectName);
    }

    if (headed) {
      playwrightArgs.push("--headed");
    }

    try {
      await runCommand("pnpm", playwrightArgs, { env: smokeEnv });
    } catch (error) {
      throw createPipelineError(
        "product",
        `${
          suite.kind === "targeted" ? "Targeted" : "Full"
        } Playwright UI smoke suite failed. Review the classified failures above.`,
        error,
      );
    }
  }
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
