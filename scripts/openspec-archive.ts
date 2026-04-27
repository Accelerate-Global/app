import { runCommand } from "./lib/command";

function readChangeName() {
  return process.argv.slice(2).find((argument) => !argument.startsWith("-"));
}

async function main() {
  const changeName = readChangeName();

  if (!changeName) {
    throw new Error("Usage: pnpm run spec:archive -- <change-id> [--skip-specs]");
  }

  const passthroughFlags = process.argv
    .slice(2)
    .filter((argument) => argument !== changeName);

  await runCommand("openspec", [
    "archive",
    changeName,
    "--yes",
    ...passthroughFlags,
  ]);
  await runCommand("pnpm", ["run", "spec:validate"]);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
