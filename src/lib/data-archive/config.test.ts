import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { readArchiveWorkerConfig } from "./config";

function environment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    DATA_ARCHIVE_PROJECT_REF: "uuyntfbqksnclyvlpecx",
    DATA_ARCHIVE_STATE_DIR: "/var/lib/ax-data-archive",
    DATA_ARCHIVE_STAGING_DIR: "/var/cache/ax-data-archive",
    DATA_ARCHIVE_TREE_DIR: "/srv/ax-data-archive/current",
    DATA_ARCHIVE_RESTIC_REPOSITORY: "/srv/ax-data-archive/restic",
    DATA_ARCHIVE_RECEIPT_URL:
      "https://data.accelerateglobal.org/api/internal/archive-receipts",
    DATA_ARCHIVE_RECEIPT_KEY_FILE: "/etc/ax-data-archive/receipt-key",
    DATA_ARCHIVE_SUPABASE_URL: "https://example.supabase.co",
    DATA_ARCHIVE_STORAGE_AUTH_EMAIL_FILE: "/etc/ax-data-archive/storage-email",
    DATA_ARCHIVE_STORAGE_AUTH_PASSWORD_FILE: "/etc/ax-data-archive/storage-password",
    DATA_ARCHIVE_SUPABASE_ANON_KEY_FILE: "/etc/ax-data-archive/supabase-anon-key",
    DATA_ARCHIVE_ALERT_STATE_FILE: "/var/lib/ax-data-archive/alerts.json",
    DATA_ARCHIVE_LAST_SUCCESS_FILE: "/var/lib/ax-data-archive/last-success",
    DATA_ARCHIVE_RESEND_API_KEY_FILE: "/etc/ax-data-archive/resend-api-key",
    DATA_ARCHIVE_ALERT_FROM_FILE: "/etc/ax-data-archive/alert-from",
    DATA_ARCHIVE_ALERT_RECIPIENT_FILE: "/etc/ax-data-archive/alert-recipient",
    DATA_ARCHIVE_ALERT_DETAILS_URL: "https://data.accelerateglobal.org",
    PGPASSFILE: "/etc/ax-data-archive/pgpass",
    PGHOST: "db.example.supabase.co",
    PGPORT: "5432",
    PGDATABASE: "postgres",
    PGUSER: "data_archive_backup_reader",
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt",
    AWS_ACCESS_KEY_ID: "storage-reader",
    AWS_ENDPOINT_URL_S3: "https://example.supabase.co/storage/v1/s3",
    AWS_DEFAULT_REGION: "us-east-1",
    RESTIC_PASSWORD_FILE: "/etc/ax-data-archive/restic-password",
    TZ: "America/Los_Angeles",
    ...overrides,
  };
}

describe("Samson archive worker configuration", () => {
  it("ships every third-party runtime dependency used by worker commands", async () => {
    const workerPackage = JSON.parse(
      await readFile("infra/samson-data-archive/worker-package.json", "utf8"),
    ) as { dependencies?: Record<string, string> };
    expect(workerPackage.dependencies).toMatchObject({
      "@supabase/supabase-js": expect.any(String),
      "drizzle-orm": expect.any(String),
      postgres: expect.any(String),
      tsx: expect.any(String),
      zod: expect.any(String),
    });
  });

  it("pins a checksum-verified Node 22 runtime for current Supabase libraries", async () => {
    const [provisioning, service, missedService] = await Promise.all([
      readFile("infra/samson-data-archive/provision-guest.sh", "utf8"),
      readFile("infra/samson-data-archive/ax-data-archive.service", "utf8"),
      readFile("infra/samson-data-archive/ax-data-archive-missed.service", "utf8"),
    ]);
    expect(provisioning).toContain("node_version=22.23.2");
    expect(provisioning).toContain(
      "node_sha256=d60acfe00a2932254bb0ad20e01b0d74397a0875595de719654b214f4b03f307",
    );
    expect(service).toContain("ExecStart=/usr/local/bin/node --jitless");
    expect(service).toContain("MemoryDenyWriteExecute=true");
    expect(missedService).toContain("ExecStart=/usr/local/bin/node --jitless");
    expect(missedService).toContain("MemoryDenyWriteExecute=true");
  });

  it("avoids the WebAssembly-backed built-in fetch in the JIT-less worker", async () => {
    const [runner, alerts, client] = await Promise.all([
      readFile("src/lib/data-archive/archive-runner.ts", "utf8"),
      readFile("src/lib/data-archive/alerts.ts", "utf8"),
      readFile("src/lib/data-archive/http-client.ts", "utf8"),
    ]);
    expect(runner).toContain("fetchImpl: archiveFetch");
    expect(runner).toContain('readPinnedToolVersion("supabase")');
    expect(alerts).toContain("input.fetchImpl ?? archiveFetch");
    expect(client).toContain('from "node:https"');
    expect(client).not.toContain("WebAssembly");
  });

  it("separates database, Storage, and Restic secrets into inherited environments", () => {
    const config = readArchiveWorkerConfig(environment());
    expect(config.databaseEnvironment).toMatchObject({
      PGUSER: "data_archive_backup_reader",
      PGPASSFILE: "/etc/ax-data-archive/pgpass",
    });
    expect(config.storageEnvironment).not.toHaveProperty("AWS_SESSION_TOKEN");
    expect(config.datasetBucket).toBe("datasets");
    expect(config.artifactBucket).toBe("api-connection-artifacts");
    expect(config.storageAuthPasswordFile).toBe(
      "/etc/ax-data-archive/storage-password",
    );
    expect(config.directAlertCredentialFiles).toEqual({
      apiKey: "/etc/ax-data-archive/resend-api-key",
      sender: "/etc/ax-data-archive/alert-from",
      recipient: "/etc/ax-data-archive/alert-recipient",
      detailsUrl: "https://data.accelerateglobal.org",
    });
    expect(config.resticEnvironment).toEqual({
      RESTIC_REPOSITORY: "/srv/ax-data-archive/restic",
      RESTIC_PASSWORD_FILE: "/etc/ax-data-archive/restic-password",
    });
    expect(Object.values(config.directAlertCredentialFiles)).not.toContain(
      "resend-secret",
    );
  });

  it("requires TLS, Pacific scheduling, distinct paths, and ordered thresholds", () => {
    expect(() => readArchiveWorkerConfig(environment({ PGSSLMODE: "disable" }))).toThrow();
    expect(() => readArchiveWorkerConfig(environment({ TZ: "UTC" }))).toThrow();
    expect(() =>
      readArchiveWorkerConfig(
        environment({
          DATA_ARCHIVE_TREE_DIR: "/srv/archive",
          DATA_ARCHIVE_RESTIC_REPOSITORY: "/srv/archive",
        }),
      ),
    ).toThrow("archive_worker_paths_must_be_distinct");
    expect(() =>
      readArchiveWorkerConfig(environment({
        DATA_ARCHIVE_ARCHIVE_WARNING_BYTES: "48",
        DATA_ARCHIVE_ARCHIVE_CRITICAL_BYTES: "45",
        DATA_ARCHIVE_ARCHIVE_LIMIT_BYTES: "50",
      })),
    ).toThrow("archive_warning_must_be_below_critical");
  });

  it("rejects non-HTTPS receipt and Storage endpoints", () => {
    expect(() =>
      readArchiveWorkerConfig(environment({
        DATA_ARCHIVE_RECEIPT_URL: "http://example.test/archive",
      })),
    ).toThrow();
    expect(() =>
      readArchiveWorkerConfig(environment({
        AWS_ENDPOINT_URL_S3: "http://example.test/storage/v1/s3",
      })),
    ).toThrow();
  });
});
