import { resolve } from "node:path";

import { z } from "zod";

type ArchiveEnvironment = Record<string, string | undefined>;

const absolutePath = z.string().min(2).refine((value) => value.startsWith("/"), {
  message: "must be an absolute path",
});

const workerEnvironmentSchema = z.object({
  DATA_ARCHIVE_PROJECT_REF: z.string().min(8).max(80).regex(/^[a-z0-9]+$/),
  DATA_ARCHIVE_STATE_DIR: absolutePath,
  DATA_ARCHIVE_STAGING_DIR: absolutePath,
  DATA_ARCHIVE_TREE_DIR: absolutePath,
  DATA_ARCHIVE_RESTIC_REPOSITORY: absolutePath,
  DATA_ARCHIVE_RECEIPT_URL: z.string().url().startsWith("https://"),
  DATA_ARCHIVE_RECEIPT_KEY_FILE: absolutePath,
  DATA_ARCHIVE_SUPABASE_URL: z.string().url().startsWith("https://"),
  DATA_ARCHIVE_STORAGE_AUTH_EMAIL_FILE: absolutePath,
  DATA_ARCHIVE_STORAGE_AUTH_PASSWORD_FILE: absolutePath,
  DATA_ARCHIVE_SUPABASE_ANON_KEY_FILE: absolutePath,
  DATA_ARCHIVE_DATASET_BUCKET: z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9._-]*$/).default("datasets"),
  DATA_ARCHIVE_ARTIFACT_BUCKET: z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9._-]*$/).default("api-connection-artifacts"),
  DATA_ARCHIVE_ALERT_STATE_FILE: absolutePath,
  DATA_ARCHIVE_LAST_SUCCESS_FILE: absolutePath,
  DATA_ARCHIVE_RESEND_API_KEY_FILE: absolutePath,
  DATA_ARCHIVE_ALERT_FROM_FILE: absolutePath,
  DATA_ARCHIVE_ALERT_RECIPIENT_FILE: absolutePath,
  DATA_ARCHIVE_ALERT_DETAILS_URL: z.string().url().startsWith("https://"),
  DATA_ARCHIVE_ARCHIVE_LIMIT_BYTES: z.coerce.number().int().positive().default(50 * 1024 ** 3),
  DATA_ARCHIVE_ARCHIVE_WARNING_BYTES: z.coerce.number().int().positive().default(40 * 1024 ** 3),
  DATA_ARCHIVE_ARCHIVE_CRITICAL_BYTES: z.coerce.number().int().positive().default(45 * 1024 ** 3),
  DATA_ARCHIVE_CHECK_SUBSET: z.string().regex(/^(?:[1-9]|[1-9][0-9]|100)%$/).default("5%"),
  PGPASSFILE: absolutePath,
  PGHOST: z.string().min(1).max(255),
  PGPORT: z.coerce.number().int().min(1).max(65535).default(5432),
  PGDATABASE: z.string().min(1).max(63).default("postgres"),
  PGUSER: z.string().min(1).max(63).default("data_archive_backup_reader"),
  PGSSLMODE: z.enum(["verify-full", "verify-ca"]).default("verify-full"),
  PGSSLROOTCERT: absolutePath,
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_ENDPOINT_URL_S3: z.string().url().startsWith("https://"),
  AWS_DEFAULT_REGION: z.string().min(1).default("local"),
  RESTIC_PASSWORD_FILE: absolutePath,
  TZ: z.literal("America/Los_Angeles"),
});

export type ArchiveWorkerConfig = {
  projectRef: string;
  stateDirectory: string;
  stagingDirectory: string;
  archiveTreeDirectory: string;
  resticRepository: string;
  receiptUrl: string;
  receiptKeyFile: string;
  supabaseUrl: string;
  storageAuthEmailFile: string;
  storageAuthPasswordFile: string;
  supabaseAnonKeyFile: string;
  datasetBucket: string;
  artifactBucket: string;
  alertStateFile: string;
  lastSuccessFile: string;
  directAlertCredentialFiles: {
    apiKey: string;
    sender: string;
    recipient: string;
    detailsUrl: string;
  };
  archiveLimitBytes: number;
  archiveWarningBytes: number;
  archiveCriticalBytes: number;
  checkSubset: string;
  databaseEnvironment: ArchiveEnvironment;
  storageEnvironment: ArchiveEnvironment;
  resticEnvironment: ArchiveEnvironment;
};

export function readArchiveWorkerConfig(
  environment: ArchiveEnvironment = process.env,
): ArchiveWorkerConfig {
  const value = workerEnvironmentSchema.parse(environment);
  const archivePaths = [
    value.DATA_ARCHIVE_STATE_DIR,
    value.DATA_ARCHIVE_STAGING_DIR,
    value.DATA_ARCHIVE_TREE_DIR,
    value.DATA_ARCHIVE_RESTIC_REPOSITORY,
  ].map((path) => resolve(path));
  if (new Set(archivePaths).size !== archivePaths.length) {
    throw new Error("archive_worker_paths_must_be_distinct");
  }
  if (!(value.DATA_ARCHIVE_ARCHIVE_WARNING_BYTES < value.DATA_ARCHIVE_ARCHIVE_CRITICAL_BYTES)) {
    throw new Error("archive_warning_must_be_below_critical");
  }
  if (!(value.DATA_ARCHIVE_ARCHIVE_CRITICAL_BYTES < value.DATA_ARCHIVE_ARCHIVE_LIMIT_BYTES)) {
    throw new Error("archive_critical_must_be_below_limit");
  }
  return {
    projectRef: value.DATA_ARCHIVE_PROJECT_REF,
    stateDirectory: value.DATA_ARCHIVE_STATE_DIR,
    stagingDirectory: value.DATA_ARCHIVE_STAGING_DIR,
    archiveTreeDirectory: value.DATA_ARCHIVE_TREE_DIR,
    resticRepository: value.DATA_ARCHIVE_RESTIC_REPOSITORY,
    receiptUrl: value.DATA_ARCHIVE_RECEIPT_URL,
    receiptKeyFile: value.DATA_ARCHIVE_RECEIPT_KEY_FILE,
    supabaseUrl: value.DATA_ARCHIVE_SUPABASE_URL,
    storageAuthEmailFile: value.DATA_ARCHIVE_STORAGE_AUTH_EMAIL_FILE,
    storageAuthPasswordFile: value.DATA_ARCHIVE_STORAGE_AUTH_PASSWORD_FILE,
    supabaseAnonKeyFile: value.DATA_ARCHIVE_SUPABASE_ANON_KEY_FILE,
    datasetBucket: value.DATA_ARCHIVE_DATASET_BUCKET,
    artifactBucket: value.DATA_ARCHIVE_ARTIFACT_BUCKET,
    alertStateFile: value.DATA_ARCHIVE_ALERT_STATE_FILE,
    lastSuccessFile: value.DATA_ARCHIVE_LAST_SUCCESS_FILE,
    directAlertCredentialFiles: {
      apiKey: value.DATA_ARCHIVE_RESEND_API_KEY_FILE,
      sender: value.DATA_ARCHIVE_ALERT_FROM_FILE,
      recipient: value.DATA_ARCHIVE_ALERT_RECIPIENT_FILE,
      detailsUrl: value.DATA_ARCHIVE_ALERT_DETAILS_URL,
    },
    archiveLimitBytes: value.DATA_ARCHIVE_ARCHIVE_LIMIT_BYTES,
    archiveWarningBytes: value.DATA_ARCHIVE_ARCHIVE_WARNING_BYTES,
    archiveCriticalBytes: value.DATA_ARCHIVE_ARCHIVE_CRITICAL_BYTES,
    checkSubset: value.DATA_ARCHIVE_CHECK_SUBSET,
    databaseEnvironment: {
      PGPASSFILE: value.PGPASSFILE,
      PGHOST: value.PGHOST,
      PGPORT: String(value.PGPORT),
      PGDATABASE: value.PGDATABASE,
      PGUSER: value.PGUSER,
      PGSSLMODE: value.PGSSLMODE,
      PGSSLROOTCERT: value.PGSSLROOTCERT,
    },
    storageEnvironment: {
      AWS_ACCESS_KEY_ID: value.AWS_ACCESS_KEY_ID,
      AWS_ENDPOINT_URL_S3: value.AWS_ENDPOINT_URL_S3,
      AWS_DEFAULT_REGION: value.AWS_DEFAULT_REGION,
    },
    resticEnvironment: {
      RESTIC_REPOSITORY: value.DATA_ARCHIVE_RESTIC_REPOSITORY,
      RESTIC_PASSWORD_FILE: value.RESTIC_PASSWORD_FILE,
    },
  };
}
