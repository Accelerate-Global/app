import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  UI_SMOKE_BASE_URL,
  UI_SMOKE_TMP_DIR,
} from "../tests/ui/support/smoke-data";
import { formatUnknownError } from "./lib/format-error";
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
import {
  type UiSmokeBootstrapScope,
} from "../config/change-impact";

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

export function parseRunUiSmokeArgs(
  argv: string[],
  environment: NodeJS.ProcessEnv = process.env,
) {
  const headed = argv.includes("--headed");
  const fullAfterTargeted = argv.includes("--targeted-and-full");
  const targeted = argv.includes("--targeted") || fullAfterTargeted;
  const skipBuild =
    argv.includes("--skip-build") ||
    environment.UI_SMOKE_SKIP_BUILD === "1";
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
    skipBuild,
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

function parseLineSeparatedTokens(output: string) {
  return output
    .split("\n")
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
export const DEFAULT_UI_SMOKE_APP_PORT_RELEASE_WAIT = {
  maxAttempts: 15,
  retryDelayMs: 1_000,
} as const;
export const DEFAULT_SUPABASE_STATUS_OUTPUT_RETRY = {
  attempts: 5,
  retryDelayMs: 2_000,
} as const;
export const DEFAULT_UI_SMOKE_PROJECT_GROUP_RETRY = {
  attempts: 2,
  retryDelayMs: 3_000,
} as const;
export const DEFAULT_UI_SMOKE_SUPABASE_START_TIMEOUT_MS = 120_000;
export const CI_UI_SMOKE_SUPABASE_START_TIMEOUT_MS = 300_000;
const UI_SMOKE_APP_PORT = Number(new URL(UI_SMOKE_BASE_URL).port || "3100");
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
  const detail = formatUnknownError(error);
  return new Error(`[${classification}] ${message}\n${detail}`);
}

export function isUiSmokeEnvironmentFailure(error: unknown) {
  const detail = formatUnknownError(error);

  return (
    detail.includes("ECONNREFUSED 127.0.0.1:54321") ||
    detail.includes("connect ECONNREFUSED 127.0.0.1:54321") ||
    detail.includes("page.goto: net::ERR_CONNECTION_REFUSED") ||
    detail.includes("supabase start is not running") ||
    detail.includes("Local Supabase ports are unavailable")
  );
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

async function waitForPortAvailable(
  port: number,
  options?: {
    maxAttempts?: number;
    retryDelayMs?: number;
  },
) {
  let lastError: unknown = null;
  const maxAttempts = options?.maxAttempts ?? DEFAULT_UI_SMOKE_APP_PORT_RELEASE_WAIT.maxAttempts;
  const retryDelayMs =
    options?.retryDelayMs ?? DEFAULT_UI_SMOKE_APP_PORT_RELEASE_WAIT.retryDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (await canListenOnPort(port)) {
      return;
    }

    lastError = new Error(`Port ${port} is still in use.`);

    if (attempt === maxAttempts) {
      throw lastError;
    }

    await sleep(retryDelayMs);
  }

  throw lastError;
}

async function listListeningProcessIds(port: number) {
  try {
    return parseLineSeparatedTokens(
      await runCommand(
        "lsof",
        ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
        {
          captureOutput: true,
          timeoutMs: 30_000,
        },
      ),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("exited with code 1")
    ) {
      return [];
    }

    throw error;
  }
}

async function ensureUiSmokeAppPortAvailable() {
  if (await canListenOnPort(UI_SMOKE_APP_PORT)) {
    return;
  }

  const processIds = await listListeningProcessIds(UI_SMOKE_APP_PORT);

  if (processIds.length === 0) {
    await waitForPortAvailable(UI_SMOKE_APP_PORT);
    return;
  }

  console.warn(
    `Port ${UI_SMOKE_APP_PORT} is already in use. Stopping stale UI smoke web server process(es): ${processIds.join(", ")}.`,
  );

  for (const processId of processIds) {
    try {
      process.kill(Number(processId), "SIGTERM");
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ESRCH"
      ) {
        throw error;
      }
    }
  }

  try {
    await waitForPortAvailable(UI_SMOKE_APP_PORT);
  } catch {
    for (const processId of processIds) {
      try {
        process.kill(Number(processId), "SIGKILL");
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !("code" in error) ||
          error.code !== "ESRCH"
        ) {
          throw error;
        }
      }
    }

    await waitForPortAvailable(UI_SMOKE_APP_PORT);
  }
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
      error.message.includes("error running container: exit 1") ||
      error.message.includes("error running container: exit 143") ||
      error.message.includes("failed to start docker container") ||
      (
        error.message.includes("network ") &&
        error.message.includes(" not found")
      ) ||
      error.message.includes("timed out") ||
      error.message.includes("failed to inspect container health") ||
      error.message.includes("failed to read docker logs") ||
      error.message.includes("No such container") ||
      error.message.includes("failed to dial native") ||
      error.message.includes("connect: connection refused")
    )
  );
}

export function isSupabaseStartRetryableError(error: unknown) {
  return (
    isDockerPruneInProgressError(error) ||
    (
      error instanceof Error &&
      (
        error.message.includes("ports are not available") ||
        error.message.includes("container name") ||
        isSupabaseStartupRaceError(error)
      )
    )
  );
}

export function isSupabaseDbResetRetryableError(error: unknown) {
  return (
    error instanceof Error &&
    (
      isSupabaseStartupRaceError(error) ||
      error.message.includes("supabase start is not running") ||
      error.message.includes("open supabase/.temp/profile") ||
      error.message.includes("DatabaseSchemaMismatch") ||
      error.message.includes("database schema is out of sync")
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

function isNextBuildAlreadyRunningError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Another next build process is already running")
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
  // Docker sometimes keeps container/network prune work in-flight briefly after
  // Supabase reports the stack stopped. Give it extra time before retrying.
  await sleep(10_000);
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

async function getLocalSupabaseStatusOutput() {
  let lastOutput = "";

  for (
    let attempt = 1;
    attempt <= DEFAULT_SUPABASE_STATUS_OUTPUT_RETRY.attempts;
    attempt += 1
  ) {
    const statusOutput = await runStage(
      "bootstrap",
      "supabase status failed.",
      "supabase",
      ["status", "-o", "env"],
      { captureOutput: true },
    );

    if (hasUsableSupabaseStatusOutput(statusOutput)) {
      return statusOutput;
    }

    lastOutput = statusOutput;

    if (attempt === DEFAULT_SUPABASE_STATUS_OUTPUT_RETRY.attempts) {
      break;
    }

    console.warn(
      "supabase status env output was incomplete. Retrying in " +
        `${DEFAULT_SUPABASE_STATUS_OUTPUT_RETRY.retryDelayMs}ms ` +
        `(${attempt}/${DEFAULT_SUPABASE_STATUS_OUTPUT_RETRY.attempts - 1}).`,
    );
    await sleep(DEFAULT_SUPABASE_STATUS_OUTPUT_RETRY.retryDelayMs);
  }

  throw createPipelineError(
    "bootstrap",
    "supabase status env output was incomplete.",
    new Error(lastOutput || "No Supabase status env output was returned."),
  );
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

async function resetAndBootstrapUiSmokeEnvironment(input: {
  smokeEnv: NodeJS.ProcessEnv;
  bootstrapScope: UiSmokeBootstrapScope;
}) {
  await resetSupabaseAfterStartupFailure();
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

  const statusOutput = await getLocalSupabaseStatusOutput();
  const nextSmokeEnv = {
    ...buildUiSmokeCommandEnv(parseSupabaseEnvOutput(statusOutput)),
    TMPDIR: input.smokeEnv.TMPDIR,
  };

  await runStageWithRetry({
    classification: "bootstrap",
    message: "UI smoke preflight failed.",
    command: "pnpm",
    args: ["run", "smoke:preflight"],
    env: nextSmokeEnv,
    attempts: 5,
    retryDelayMs: 2_000,
    shouldRetry: isLocalStackNotReadyError,
  });
  await runStageWithRetry({
    classification: "bootstrap",
    message: "UI smoke bootstrap failed.",
    command: "pnpm",
    args: [...getSmokeBootstrapArgs(input.bootstrapScope)],
    env: nextSmokeEnv,
    attempts: 5,
    retryDelayMs: 2_000,
    shouldRetry: isLocalStackNotReadyError,
  });

  return nextSmokeEnv;
}

async function runPlaywrightSuiteWithRecovery(input: {
  suite: UiSmokeSuitePlan;
  projectGroup: string[];
  smokeEnv: NodeJS.ProcessEnv;
  headed: boolean;
  bootstrapScope: UiSmokeBootstrapScope;
}) {
  let smokeEnv = input.smokeEnv;

  for (
    let attempt = 1;
    attempt <= DEFAULT_UI_SMOKE_PROJECT_GROUP_RETRY.attempts;
    attempt += 1
  ) {
    await ensureUiSmokeAppPortAvailable();

    const playwrightArgs = [
      "exec",
      "playwright",
      "test",
      ...input.suite.testPaths,
      "-c",
      "playwright.smoke.config.ts",
    ];

    if (input.suite.grepPattern) {
      playwrightArgs.push("--grep", input.suite.grepPattern);
    }

    for (const projectName of input.projectGroup) {
      playwrightArgs.push("--project", projectName);
    }

    if (input.headed) {
      playwrightArgs.push("--headed");
    }

    try {
      await runCommand("pnpm", playwrightArgs, {
        env: smokeEnv,
        captureOutput: true,
      });
      return smokeEnv;
    } catch (error) {
      const environmentFailure = isUiSmokeEnvironmentFailure(error);

      if (
        !environmentFailure ||
        attempt === DEFAULT_UI_SMOKE_PROJECT_GROUP_RETRY.attempts
      ) {
        throw createPipelineError(
          environmentFailure ? "bootstrap" : "product",
          `${
            input.suite.kind === "targeted" ? "Targeted" : "Full"
          } Playwright UI smoke suite failed. Review the classified failures above.`,
          error,
        );
      }

      console.warn(
        "Playwright smoke lost the local app or Supabase stack. Resetting the local stack before retrying this project group.",
      );
      smokeEnv = await resetAndBootstrapUiSmokeEnvironment({
        smokeEnv,
        bootstrapScope: input.bootstrapScope,
      });
      await sleep(DEFAULT_UI_SMOKE_PROJECT_GROUP_RETRY.retryDelayMs);
    }
  }

  return smokeEnv;
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
  testPaths: string[];
};

export const UI_SMOKE_PROJECT_ORDER = [
  "desktop-anonymous",
  "desktop-pro",
  "desktop-basic",
  "desktop-admin",
  "mobile-anonymous",
  "mobile-pro",
  "mobile-basic",
  "mobile-admin",
] as const;

export type UiSmokeRunPlan = {
  selection: UiSmokeSelection | null;
  suites: UiSmokeSuitePlan[];
  bootstrapScope: UiSmokeBootstrapScope;
  summary: string[];
};

const ROUTE_SWEEP_SPEC_PATH = "tests/ui/00-route-sweep.spec.ts";

function resolveRunBootstrapScope(input: {
  selection: UiSmokeSelection | null;
  fullAfterTargeted: boolean;
}) {
  if (!input.selection || input.selection.mode === "full" || input.fullAfterTargeted) {
    return "full" satisfies UiSmokeBootstrapScope;
  }

  return input.selection.bootstrapScope ?? "full";
}

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
      bootstrapScope: "full",
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
          testPaths: [],
        },
      ],
      bootstrapScope: "full",
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
          testPaths: [],
        },
      ],
      bootstrapScope: "full",
      summary: selection.summary,
    } satisfies UiSmokeRunPlan;
  }

  const grepPattern = buildUiSmokeGrepPattern(selection);
  const targetedTestPaths =
    selection.routeIds.length > 0 && selection.testPaths.length > 0
      ? [ROUTE_SWEEP_SPEC_PATH, ...selection.testPaths]
      : selection.testPaths;
  const suites: UiSmokeSuitePlan[] = [
    {
      kind: "targeted",
      grepPattern,
      projectNames: selection.projectNames,
      testPaths: targetedTestPaths,
    },
  ];

  if (input.fullAfterTargeted) {
    suites.push({
      kind: "full",
      grepPattern: null,
      projectNames: [],
      testPaths: [],
    });
  }

  return {
    selection,
    suites,
    bootstrapScope: resolveRunBootstrapScope({
      selection,
      fullAfterTargeted: input.fullAfterTargeted,
    }),
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

export function getSmokeBootstrapArgs(scope: UiSmokeBootstrapScope) {
  return ["run", "smoke:bootstrap", "--", "--scope", scope] as const;
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
  grepPattern: string | null;
  projectNames: string[];
  testPaths: string[];
  targetedSelection: NonNullable<ReturnType<typeof resolveUiSmokeSelection>>;
}) {
  const playwrightArgs = [
    "exec",
    "playwright",
    "test",
    ...input.testPaths,
    "-c",
    "playwright.smoke.config.ts",
    "--list",
  ];

  if (input.grepPattern) {
    playwrightArgs.push("--grep", input.grepPattern);
  }

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

export function expandUiSmokeSuiteProjects(
  suite: UiSmokeSuitePlan,
): string[][] {
  const projectNames =
    suite.projectNames.length > 0
      ? suite.projectNames
      : [...UI_SMOKE_PROJECT_ORDER];

  return projectNames.map((projectName) => [projectName]);
}

async function main() {
  const {
    headed,
    fullAfterTargeted,
    targeted,
    skipBuild,
    baseSha,
    headSha,
  } =
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
    targetedSuite &&
    (targetedSuite.grepPattern || targetedSuite.testPaths.length > 0)
  ) {
    await validateTargetedSelection({
      grepPattern: targetedSuite.grepPattern,
      projectNames: targetedSuite.projectNames,
      testPaths: targetedSuite.testPaths,
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
  const statusOutput = await getLocalSupabaseStatusOutput();
  const playwrightTmpDir = path.join(UI_SMOKE_TMP_DIR, "playwright-tmp");

  await mkdir(playwrightTmpDir, { recursive: true });
  let smokeEnv: NodeJS.ProcessEnv = {
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
    args: [...getSmokeBootstrapArgs(runPlan.bootstrapScope)],
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

  if (skipBuild) {
    console.log("Skipping Next build before browser smoke because verify:app already passed on this tracked tree.");
  } else {
    await runStageWithRetry({
      classification: "product",
      message: "Next build failed before browser smoke.",
      command: "pnpm",
      args: ["build"],
      env: smokeEnv,
      attempts: 5,
      retryDelayMs: 2_000,
      shouldRetry: isNextBuildAlreadyRunningError,
    });
  }

  for (const suite of runPlan.suites) {
    for (const projectGroup of expandUiSmokeSuiteProjects(suite)) {
      smokeEnv = await runPlaywrightSuiteWithRecovery({
        suite,
        projectGroup,
        smokeEnv,
        headed,
        bootstrapScope: runPlan.bootstrapScope,
      });
    }
  }
}

function isMainModule(metaUrl: string) {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
}

if (isMainModule(import.meta.url)) {
  void main().catch((error) => {
    console.error(formatUnknownError(error));
    process.exitCode = 1;
  });
}
