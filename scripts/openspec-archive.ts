import { runCommand } from "./lib/command";

function readArguments() {
  return process.argv.slice(2).filter((argument) => argument !== "--");
}

function readChangeName(arguments_: string[]) {
  return arguments_.find((argument) => !argument.startsWith("-"));
}

async function main() {
  const arguments_ = readArguments();
  const changeName = readChangeName(arguments_);

  if (!changeName) {
    throw new Error("Usage: pnpm run spec:archive -- <change-id> [--skip-specs]");
  }

  const passthroughFlags = arguments_.filter(
    (argument) => argument !== changeName,
  );

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
