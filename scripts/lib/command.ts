import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

type RunCommandOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  quiet?: boolean;
  allowFailure?: boolean;
};

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

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

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0 && !options.allowFailure) {
    throw new Error(
      `Command failed (${exitCode}): ${command} ${args.join(" ")}\n${stderr.trim()}`,
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
