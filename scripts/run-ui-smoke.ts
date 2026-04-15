import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";

import {
  UI_SMOKE_BASE_URL,
  UI_SMOKE_TMP_DIR,
  UI_SMOKE_USERS,
} from "../tests/ui/support/smoke-data";

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

function parseEnvOutput(output: string) {
  const entries: Record<string, string> = {};

  for (const line of output.split(/\r?\n/u)) {
    const match = line.match(/^(?:export\s+)?([A-Z0-9_]+)=(.+)$/u);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
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

function buildSmokeEnv(statusEnv: Record<string, string>) {
  const supabaseUrl =
    statusEnv.NEXT_PUBLIC_SUPABASE_URL ??
    statusEnv.API_URL ??
    statusEnv.SUPABASE_URL;
  const publishableKey =
    statusEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    statusEnv.ANON_KEY ??
    statusEnv.PUBLISHABLE_KEY;
  const serviceRoleKey =
    statusEnv.SUPABASE_SERVICE_ROLE_KEY ?? statusEnv.SERVICE_ROLE_KEY;
  const secretKey =
    statusEnv.SUPABASE_SECRET_KEY ?? statusEnv.SECRET_KEY;
  const databaseUrl = statusEnv.DATABASE_URL ?? statusEnv.DB_URL;

  if (!supabaseUrl || !publishableKey || (!serviceRoleKey && !secretKey) || !databaseUrl) {
    throw new Error(
      "Could not derive local Supabase env values from `supabase status -o env`.",
    );
  }

  return {
    ...process.env,
    UI_SMOKE_ENABLED: "1",
    UI_SMOKE_BASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publishableKey,
    ...(secretKey ? { SUPABASE_SECRET_KEY: secretKey } : {}),
    ...(serviceRoleKey ? { SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey } : {}),
    DATABASE_URL: databaseUrl,
    DATASET_ADMIN_EMAIL: UI_SMOKE_USERS.admin.email,
    SUPABASE_STORAGE_BUCKET: "datasets",
  };
}

async function main() {
  const headed = process.argv.includes("--headed");

  await mkdir(UI_SMOKE_TMP_DIR, { recursive: true });
  await assertSupabasePortsAvailable();
  await runCommand("supabase", ["start"]);
  await runCommand("supabase", ["db", "reset", "--local", "--yes"]);

  const statusOutput = await runCommand(
    "supabase",
    ["status", "-o", "env"],
    { captureOutput: true },
  );
  const smokeEnv = buildSmokeEnv(parseEnvOutput(statusOutput));

  await runCommand("pnpm", ["run", "smoke:bootstrap"], { env: smokeEnv });
  await runCommand("pnpm", ["run", "smoke:check"], { env: smokeEnv });
  await runCommand("pnpm", ["build"], { env: smokeEnv });
  await runCommand(
    "pnpm",
    [
      "exec",
      "playwright",
      "test",
      "-c",
      "playwright.smoke.config.ts",
      ...(headed ? ["--headed"] : []),
    ],
    { env: smokeEnv },
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
