import { mkdir } from "node:fs/promises";
import path from "node:path";

import { runCommand } from "./lib/command";

async function main() {
  const temporaryDirectory = path.join(process.cwd(), ".tmp", "vitest-tmp");
  await mkdir(temporaryDirectory, { recursive: true });
  const commandEnvironment = {
    ...process.env,
    TMPDIR: temporaryDirectory,
  };
  const commands = [
    {
      label: "lint",
      promise: runCommand("pnpm", ["run", "lint"], { env: commandEnvironment }),
    },
    {
      label: "test",
      promise: runCommand("pnpm", ["run", "test"], { env: commandEnvironment }),
    },
    {
      label: "build",
      promise: runCommand("pnpm", ["run", "build"], { env: commandEnvironment }),
    },
  ];

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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
