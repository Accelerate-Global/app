import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import postgres from "postgres";

import { getPostgresConnectionConfig } from "@/lib/postgres-connection";

import { runArchiveCommand } from "./backup-engine";

const verificationQueries = {
  authUsers: "select count(*)::integer as count from auth.users",
  storageBuckets: "select count(*)::integer as count from storage.buckets",
  storageObjects: "select count(*)::integer as count from storage.objects",
  migrations:
    "select count(*)::integer as count from supabase_migrations.schema_migrations",
  datasets: "select count(*)::integer as count from public.datasets",
  apiRuns: "select count(*)::integer as count from private.api_connection_runs",
  archiveRuns:
    "select count(*)::integer as count from private.data_archive_backup_runs",
} as const;

const fingerprintQueries = {
  authUsers:
    "select md5(coalesce(jsonb_agg(to_jsonb(source) order by source.id)::text, '[]')) as fingerprint from auth.users as source",
  storageObjects:
    "select md5(coalesce(jsonb_agg(to_jsonb(source) order by source.id)::text, '[]')) as fingerprint from storage.objects as source",
  migrations:
    "select md5(coalesce(jsonb_agg(to_jsonb(source) order by source.version)::text, '[]')) as fingerprint from supabase_migrations.schema_migrations as source",
  archiveCatalog:
    "select md5(coalesce(jsonb_agg(to_jsonb(source) order by source.id)::text, '[]')) as fingerprint from private.data_archive_packages as source",
} as const;

function commandEnvironment(databaseUrl: string): Record<string, string> {
  const url = new URL(databaseUrl);
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.replace(/^\//, "") || "postgres",
    PGSSLMODE: url.hostname === "127.0.0.1" || url.hostname === "localhost"
      ? "disable"
      : "require",
  };
}

function databaseUrlFor(sourceUrl: string, database: string): string {
  const value = new URL(sourceUrl);
  value.pathname = `/${database}`;
  return value.toString();
}

async function counts(databaseUrl: string) {
  const connection = getPostgresConnectionConfig(databaseUrl);
  const db = postgres(connection.databaseUrl, {
    ...connection.options,
    max: 1,
    prepare: false,
  });
  try {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(verificationQueries).map(async ([key, query]) => {
          const rows = await db.unsafe<{ count: number }[]>(query);
          return [key, rows[0]?.count ?? -1] as const;
        }),
      ),
    );
  } finally {
    await db.end({ timeout: 5 });
  }
}

async function fingerprints(databaseUrl: string) {
  const connection = getPostgresConnectionConfig(databaseUrl);
  const db = postgres(connection.databaseUrl, {
    ...connection.options,
    max: 1,
    prepare: false,
  });
  try {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(fingerprintQueries).map(async ([key, query]) => {
          const rows = await db.unsafe<{ fingerprint: string }[]>(query);
          return [key, rows[0]?.fingerprint ?? ""] as const;
        }),
      ),
    );
  } finally {
    await db.end({ timeout: 5 });
  }
}

export async function runIsolatedDatabaseRestoreDrill(databaseUrl: string) {
  const startedAt = Date.now();
  const root = await mkdtemp(join(tmpdir(), "ax-archive-restore-drill-"));
  const dumpPath = join(root, "project.dump");
  const rolesPath = join(root, "roles.sql");
  const restoreListPath = join(root, "restore.list");
  const filteredRestoreListPath = join(root, "restore.filtered.list");
  const restoreDatabase = `archive_restore_${randomUUID().replaceAll("-", "")}`;
  const environment = commandEnvironment(databaseUrl);
  const sourceDatabase = environment.PGDATABASE;
  const targetUrl = databaseUrlFor(databaseUrl, restoreDatabase);
  let created = false;
  try {
    const [sourceCounts, sourceFingerprints] = await Promise.all([
      counts(databaseUrl),
      fingerprints(databaseUrl),
    ]);
    await runArchiveCommand({
      command: "pg_dumpall",
      args: ["--roles-only", "--no-role-passwords"],
      env: environment,
      stdoutPath: rolesPath,
    });
    await runArchiveCommand({
      command: "pg_dump",
      args: ["--format=custom", "--no-owner", "--no-privileges", "--dbname", sourceDatabase],
      env: environment,
      stdoutPath: dumpPath,
    });
    await runArchiveCommand({
      command: "createdb",
      args: ["--template=template0", restoreDatabase],
      env: environment,
    });
    created = true;
    await runArchiveCommand({
      command: "pg_restore",
      args: ["--list", dumpPath],
      env: environment,
      stdoutPath: restoreListPath,
    });
    const restoreList = await readFile(restoreListPath, "utf8");
    const filteredRestoreList = restoreList
      .split("\n")
      .filter((line) => !/\b(?:pg_cron|cron)\b/i.test(line))
      .join("\n");
    await writeFile(filteredRestoreListPath, filteredRestoreList, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await runArchiveCommand({
      command: "pg_restore",
      args: [
        "--exit-on-error",
        "--no-owner",
        "--no-privileges",
        "--use-list",
        filteredRestoreListPath,
        "--dbname",
        restoreDatabase,
        dumpPath,
      ],
      env: environment,
    });
    const [targetCounts, targetFingerprints] = await Promise.all([
      counts(targetUrl),
      fingerprints(targetUrl),
    ]);
    if (JSON.stringify(sourceCounts) !== JSON.stringify(targetCounts)) {
      throw new Error("archive_restore_drill_count_mismatch");
    }
    if (JSON.stringify(sourceFingerprints) !== JSON.stringify(targetFingerprints)) {
      throw new Error("archive_restore_drill_checksum_mismatch");
    }
    const rolesBytes = (await stat(rolesPath)).size;
    const dumpBytes = (await stat(dumpPath)).size;
    if (rolesBytes === 0 || dumpBytes === 0) {
      throw new Error("archive_restore_drill_dump_empty");
    }
    return {
      ok: true,
      tableCounts: targetCounts,
      representativeFingerprintsVerified: Object.keys(targetFingerprints).length,
      rolesInventoryBytes: rolesBytes,
      compressedDatabaseBytes: dumpBytes,
      recoveryTimeMs: Date.now() - startedAt,
      temporaryDatabaseRemoved: true,
    };
  } finally {
    if (created) {
      await runArchiveCommand({
        command: "dropdb",
        args: ["--force", restoreDatabase],
        env: environment,
      }).catch(() => undefined);
    }
    await rm(root, { recursive: true, force: true });
  }
}
