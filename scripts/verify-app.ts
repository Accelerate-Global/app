import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runCommand } from "./lib/command";

export const VERIFY_APP_TEST_ARGS = [
  "exec",
  "vitest",
  "run",
  "--maxWorkers=1",
] as const;

type VerifyAppCommand = {
  label: string;
  run: () => Promise<unknown>;
};

export async function runVerifyAppCommands(commands: VerifyAppCommand[]) {
  const failures: string[] = [];

  for (const command of commands) {
    try {
      await command.run();
    } catch (error) {
      failures.push(
        `${command.label}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(`verify:app failed.\n${failures.join("\n")}`);
  }
}

export function parseVerifyAppArgs(argv: string[]) {
  const lint = argv.includes("--lint");
  const test = argv.includes("--test");
  const build = argv.includes("--build");

  if (!lint && !test && !build) {
    return {
      lint: true,
      test: true,
      build: true,
    };
  }

  return {
    lint,
    test,
    build,
  };
}

async function main() {
  const selectedTasks = parseVerifyAppArgs(process.argv);
  const temporaryDirectory = path.join(process.cwd(), ".tmp", "vitest-tmp");
  const eslintCacheDirectory = path.join(process.cwd(), ".tmp", "eslint");
  const nextCacheDirectory = path.join(process.cwd(), ".next", "cache");
  await mkdir(temporaryDirectory, { recursive: true });
  await mkdir(eslintCacheDirectory, { recursive: true });
  await mkdir(nextCacheDirectory, { recursive: true });
  const commandEnvironment = {
    ...process.env,
    TMPDIR: temporaryDirectory,
  };
  const commands: VerifyAppCommand[] = [];

  if (selectedTasks.lint) {
    commands.push({
      label: "lint",
      run: () => runCommand(
        "pnpm",
        [
          "exec",
          "eslint",
          ".",
          "--cache",
          "--cache-location",
          path.join(".tmp", "eslint", ".eslintcache"),
        ],
        { env: commandEnvironment },
      ),
    });
  }

  if (selectedTasks.test) {
    commands.push({
      label: "test",
      run: () =>
        runCommand("pnpm", [...VERIFY_APP_TEST_ARGS], {
          env: commandEnvironment,
        }),
    });
  }

  if (selectedTasks.build) {
    commands.push({
      label: "build",
      run: () =>
        runCommand("pnpm", ["run", "build"], { env: commandEnvironment }),
    });
  }

  if (commands.length === 0) {
    console.log("verify:app skipped; no app subtasks were selected.");
    return;
  }

  await runVerifyAppCommands(commands);

  console.log("verify:app passed.");
}

function isMainModule(metaUrl: string) {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
