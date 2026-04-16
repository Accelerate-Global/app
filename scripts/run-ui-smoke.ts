import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

import {
  UI_SMOKE_TMP_DIR,
} from "../tests/ui/support/smoke-data";
import { parseGitStatusPorcelain } from "./lib/git-status";
import {
  buildUiSmokeCommandEnv,
  parseSupabaseEnvOutput,
} from "./lib/ui-smoke-env";
import {
  buildUiSmokeGrepPattern,
  resolveUiSmokeSelection,
} from "./lib/ui-smoke-selection";

function runCommand(
  command: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    captureOutput?: boolean;
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

    if (options.captureOutput) {
      child.stdout?.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });
    }

    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} exited with code ${code ?? "unknown"}${
            stderr ? `\n${stderr}` : ""
          }`,
        ),
      );
    });
    child.on("error", reject);
  });
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

async function runStage(
  classification: "bootstrap" | "contract" | "product",
  message: string,
  command: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    captureOutput?: boolean;
  } = {},
) {
  try {
    return await runCommand(command, args, options);
  } catch (error) {
    throw createPipelineError(classification, message, error);
  }
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

async function main() {
  const headed = process.argv.includes("--headed");
  const targeted = process.argv.includes("--targeted");
  const changedFiles = targeted
    ? parseGitStatusPorcelain(
        await runCommand(
          "git",
          ["status", "--porcelain=v1", "--untracked-files=all", "-z"],
          { captureOutput: true },
        ),
      ).map((file) => file.path)
    : [];
  const targetedSelection = targeted
    ? resolveUiSmokeSelection(changedFiles)
    : null;

  if (targetedSelection?.mode === "none") {
    console.log("No targeted UI smoke routes or journeys matched the current worktree.");
    return;
  }

  if (targetedSelection) {
    printSelectionSummary(targetedSelection.summary);
  }

  await mkdir(UI_SMOKE_TMP_DIR, { recursive: true });
  try {
    await assertSupabasePortsAvailable();
  } catch (error) {
    throw createPipelineError(
      "bootstrap",
      "Local Supabase ports are unavailable.",
      error,
    );
  }
  await runStage("bootstrap", "supabase start failed.", "supabase", ["start"]);
  await runStage(
    "bootstrap",
    "supabase db reset failed.",
    "supabase",
    ["db", "reset", "--local", "--yes"],
  );
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

  await runStage(
    "bootstrap",
    "UI smoke preflight failed.",
    "pnpm",
    ["run", "smoke:preflight"],
    { env: smokeEnv },
  );
  await runStage(
    "bootstrap",
    "UI smoke bootstrap failed.",
    "pnpm",
    ["run", "smoke:bootstrap"],
    { env: smokeEnv },
  );
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

  const playwrightArgs = [
    "exec",
    "playwright",
    "test",
    "-c",
    "playwright.smoke.config.ts",
  ];
  const grepPattern =
    targetedSelection?.mode === "targeted"
      ? buildUiSmokeGrepPattern(targetedSelection)
      : null;

  if (grepPattern) {
    playwrightArgs.push("--grep", grepPattern);
  }

  for (const projectName of targetedSelection?.mode === "targeted"
    ? targetedSelection.projectNames
    : []) {
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
      "Playwright UI smoke suite failed. Review the classified failures above.",
      error,
    );
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
