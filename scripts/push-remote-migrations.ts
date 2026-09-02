import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadEnvironmentFile, runCommand } from "./lib/command";

export function buildRemoteMigrationPushInvocation(
  databaseUrl: string,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const password = decodeURIComponent(new URL(databaseUrl).password);

  if (!password) {
    throw new Error("DATABASE_URL must include the remote database password.");
  }

  return {
    command: "supabase",
    args: ["db", "push", "--include-all"],
    options: {
      env: {
        ...environment,
        SUPABASE_DB_PASSWORD: password,
      },
    },
  } as const;
}

async function main() {
  const envFromFile = await loadEnvironmentFile(
    path.join(process.cwd(), ".env.local"),
  ).catch(() => ({} as Record<string, string>));
  const databaseUrl = process.env.DATABASE_URL ?? envFromFile.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required in the environment or .env.local.");
  }

  const invocation = buildRemoteMigrationPushInvocation(databaseUrl);
  await runCommand(
    invocation.command,
    [...invocation.args],
    invocation.options,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
