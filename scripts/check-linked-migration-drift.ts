import { readdir } from "node:fs/promises";

import postgres from "postgres";

import { getSupabaseMigrationDrift } from "@/lib/release-process";

import { loadEnvironmentFile } from "./lib/command";

async function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  try {
    const environment = await loadEnvironmentFile(".env.local");
    if (environment.DATABASE_URL) {
      return environment.DATABASE_URL;
    }
  } catch {
    // Ignore missing .env.local and fall through to the final error.
  }

  throw new Error("DATABASE_URL is required via the environment or .env.local.");
}

async function getLocalMigrationVersions() {
  const entries = await readdir("supabase/migrations", { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name.match(/^(\d{14})_/)?.[1] ?? null)
    .filter((version): version is string => version !== null)
    .sort();
}

async function getRemoteMigrationVersions(databaseUrl: string) {
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  try {
    const rows = await sql<{ version: string }[]>`
      select version::text
      from supabase_migrations.schema_migrations
      order by version
    `;

    return rows.map((row) => row.version);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  const databaseUrl = await getDatabaseUrl();
  const [localVersions, remoteVersions] = await Promise.all([
    getLocalMigrationVersions(),
    getRemoteMigrationVersions(databaseUrl),
  ]);
  const allVersions = [...new Set([...localVersions, ...remoteVersions])].sort();
  const drift = getSupabaseMigrationDrift(
    allVersions.map((version) => ({
      localVersion: localVersions.includes(version) ? version : null,
      remoteVersion: remoteVersions.includes(version) ? version : null,
    })),
  );

  if (drift.hasDrift) {
    if (drift.localOnly.length > 0) {
      console.error(
        `Remote is missing tracked migrations: ${drift.localOnly.join(", ")}`,
      );
    }

    if (drift.remoteOnly.length > 0) {
      console.error(
        `Local repo is missing remote migrations: ${drift.remoteOnly.join(", ")}`,
      );
    }

    process.exit(1);
  }

  console.log("Linked migration history matches the tracked repo migrations.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
