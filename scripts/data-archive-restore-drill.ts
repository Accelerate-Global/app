import { runIsolatedDatabaseRestoreDrill } from "@/lib/data-archive/restore-drill";

async function main() {
  const databaseUrl = process.env.DATA_ARCHIVE_RESTORE_DRILL_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATA_ARCHIVE_RESTORE_DRILL_DATABASE_URL is required.");
  }
  const result = await runIsolatedDatabaseRestoreDrill(databaseUrl);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  const code = error instanceof Error
    ? error.message.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 128)
    : "archive-restore-drill-failed";
  process.stderr.write(`Data archive restore drill failed (${code}).\n`);
  process.exitCode = 1;
});
