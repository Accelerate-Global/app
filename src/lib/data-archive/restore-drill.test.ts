import { describe, expect, it } from "vitest";

import { runIsolatedDatabaseRestoreDrill } from "./restore-drill";

const databaseUrl = process.env.DATA_ARCHIVE_RESTORE_DRILL_DATABASE_URL;

describe("isolated data archive database restore", () => {
  it.skipIf(!databaseUrl)(
    "restores Auth, Storage metadata, migrations, catalog, and application tables",
    async () => {
      await expect(runIsolatedDatabaseRestoreDrill(databaseUrl!)).resolves.toMatchObject({
        ok: true,
        temporaryDatabaseRemoved: true,
        tableCounts: expect.objectContaining({
          authUsers: expect.any(Number),
          storageObjects: expect.any(Number),
          migrations: expect.any(Number),
          archiveRuns: expect.any(Number),
        }),
      });
    },
    120_000,
  );
});
