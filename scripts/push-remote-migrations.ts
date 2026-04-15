import path from "node:path";

import { loadEnvironmentFile, runCommand } from "./lib/command";

async function main() {
  const envFromFile = await loadEnvironmentFile(
    path.join(process.cwd(), ".env.local"),
  ).catch(() => ({} as Record<string, string>));
  const databaseUrl = process.env.DATABASE_URL ?? envFromFile.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required in the environment or .env.local.");
  }

  const password = new URL(databaseUrl).password;

  if (!password) {
    throw new Error("DATABASE_URL must include the remote database password.");
  }

  await runCommand("supabase", ["db", "push", "--include-all", "-p", password]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
