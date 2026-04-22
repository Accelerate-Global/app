import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runCommand } from "./lib/command";

type VerifyAppCommand = {
  label: string;
  promise: Promise<Awaited<ReturnType<typeof runCommand>>>;
};

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
      promise: runCommand(
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
      promise: runCommand("pnpm", ["run", "test"], { env: commandEnvironment }),
    });
  }

  if (selectedTasks.build) {
    commands.push({
      label: "build",
      promise: runCommand("pnpm", ["run", "build"], { env: commandEnvironment }),
    });
  }

  if (commands.length === 0) {
    console.log("verify:app skipped; no app subtasks were selected.");
    return;
  }

  const results = await Promise.allSettled(commands.map((command) => command.promise));
  const failures = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [`${commands[index]?.label ?? "unknown"}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`]
      : [],
  );

  if (failures.length > 0) {
    throw new Error(`verify:app failed.\n${failures.join("\n")}`);
  }

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
