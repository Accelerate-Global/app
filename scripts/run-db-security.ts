import { pathToFileURL } from "node:url";

import { delay, runCommand } from "./lib/command";

const supabaseStatusTimeoutMs = 120_000;
const supabaseStatusPollMs = 2_000;

type CommandResult = Awaited<ReturnType<typeof runCommand>>;

function getCommandOutput(result: CommandResult) {
  return `${result.stdout}\n${result.stderr}`;
}

function isSupabaseLifecycleRace(result: CommandResult) {
  if (result.exitCode === 0) {
    return false;
  }

  const output = getCommandOutput(result);

  return (
    /supabase_[a-z_]+_online container is not ready: starting/u.test(output) ||
    /No such container: supabase_[a-z_]+_online/u.test(output)
  );
}

async function waitForSupabaseStatus(label: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < supabaseStatusTimeoutMs) {
    const status = await runCommand("supabase", ["status"], {
      allowFailure: true,
      quiet: true,
      stdinMode: "ignore",
    });

    if (status.exitCode === 0) {
      return;
    }

    await delay(supabaseStatusPollMs);
  }

  throw new Error(`Timed out waiting for local Supabase status after ${label}.`);
}

async function runSupabaseLifecycleCommand(label: string, args: string[]) {
  const result = await runCommand("supabase", args, {
    allowFailure: true,
  });

  if (result.exitCode === 0) {
    return;
  }

  if (!isSupabaseLifecycleRace(result)) {
    throw new Error(`Supabase ${label} failed.`);
  }

  console.warn(
    `Supabase ${label} hit a local health-check race; waiting for the stack to settle.`,
  );
  await waitForSupabaseStatus(label);
}

export async function runDbSecurity() {
  await runSupabaseLifecycleCommand("start", ["start", "--ignore-health-check"]);
  await runSupabaseLifecycleCommand("db reset", [
    "db",
    "reset",
    "--local",
    "--no-seed",
    "--yes",
  ]);
  await runCommand("pnpm", ["run", "db:security:started"]);
}

function isMainModule(metaUrl: string) {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
}

if (isMainModule(import.meta.url)) {
  void runDbSecurity().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
