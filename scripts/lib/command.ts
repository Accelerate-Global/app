import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

type RunCommandOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  quiet?: boolean;
  allowFailure?: boolean;
  stdinMode?: "inherit" | "ignore";
  timeoutMs?: number;
};

const KILL_GRACE_PERIOD_MS = 5_000;

function summarizeOutput(label: string, text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  const maxLength = 280;
  const summary =
    normalized.length > maxLength
      ? `${normalized.slice(0, maxLength - 1)}…`
      : normalized;

  return `${label}: ${summary}`;
}

function formatCommand(command: string, args: string[]) {
  return [command, ...args]
    .map((part) => (/[\s"]/u.test(part) ? JSON.stringify(part) : part))
    .join(" ");
}

function formatCommandError(input: {
  command: string;
  args: string[];
  exitCode: number;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timeoutMs?: number;
  timedOut: boolean;
}) {
  const details = [
    summarizeOutput("stderr", input.stderr),
    summarizeOutput("stdout", input.stdout),
  ].filter(Boolean);
  const signalSuffix = input.signal ? `, signal=${input.signal}` : "";

  if (input.timedOut) {
    return [
      `Command timed out after ${input.timeoutMs}ms: ${formatCommand(input.command, input.args)} (exit code=${input.exitCode}${signalSuffix})`,
      ...details,
    ].join("\n");
  }

  return [
    `Command failed (${input.exitCode}${signalSuffix}): ${formatCommand(input.command, input.args)}`,
    ...details,
  ].join("\n");
}

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
) {
  const stdinMode = options.stdinMode ?? "inherit";
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: [stdinMode, "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let completed = false;
  let timedOut = false;
  let timeoutHandle: NodeJS.Timeout | undefined;
  let killHandle: NodeJS.Timeout | undefined;

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    stdout += text;

    if (!options.quiet) {
      process.stdout.write(text);
    }
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    stderr += text;

    if (!options.quiet) {
      process.stderr.write(text);
    }
  });

  if (options.timeoutMs) {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killHandle = setTimeout(() => {
        if (!completed) {
          child.kill("SIGKILL");
        }
      }, KILL_GRACE_PERIOD_MS);
    }, options.timeoutMs);
  }

  let code: number | null;
  let signal: NodeJS.Signals | null;

  try {
    ({ code, signal } = await new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
    }>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (nextCode, nextSignal) => {
        completed = true;
        resolve({
          code: nextCode,
          signal: nextSignal,
        });
      });
    }));
  } finally {
    clearTimeout(timeoutHandle);
    clearTimeout(killHandle);
  }

  const exitCode = code ?? 1;

  if (timedOut) {
    throw new Error(
      formatCommandError({
        command,
        args,
        exitCode,
        signal,
        stdout,
        stderr,
        timeoutMs: options.timeoutMs,
        timedOut: true,
      }),
    );
  }

  if (exitCode !== 0 && !options.allowFailure) {
    throw new Error(
      formatCommandError({
        command,
        args,
        exitCode,
        signal,
        stdout,
        stderr,
        timedOut: false,
      }),
    );
  }

  return {
    stdout,
    stderr,
    exitCode,
  };
}

export function delay(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function loadEnvironmentFile(filePath: string) {
  const content = await readFile(filePath, "utf8");
  const environment: Record<string, string> = {};

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");

    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    const rawValue = line.slice(equalsIndex + 1).trim();
    const unquotedValue =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    environment[key] = unquotedValue;
  }

  return environment;
}
