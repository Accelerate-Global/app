import { randomUUID } from "node:crypto";

import { sanitizeFileName } from "@/lib/csv";
import { getSupabaseConfig } from "@/lib/supabase/config";

const DATASET_STORAGE_PATH_PREFIX = "datasets/csv/";
const API_CONNECTION_RUN_OUTPUT_PATH_PREFIX = "api-connection-runs/";
const IMB_FORMING_OUTPUT_PATH_PREFIX = "imb-forming-runs/";
const PARTNER_EXPORT_RUN_OUTPUT_PATH_PREFIX = "partner-export-runs/";
const REFERENCE_RESOURCE_PATH_PREFIX = "reference-resources/";
const DEFAULT_DATASET_STORAGE_BUCKET = "datasets";
const DEFAULT_API_CONNECTION_RUN_ARTIFACT_BUCKET = "api-connection-artifacts";
const DEFAULT_PARTNER_EXPORT_ARTIFACT_BUCKET = "partner-export-artifacts";
const DEFAULT_REFERENCE_RESOURCE_ARTIFACT_BUCKET = "reference-resource-artifacts";

export const API_CONNECTION_RUN_ARTIFACT_CONTENT_TYPE = "application/json";

export function getDatasetStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_DATASET_STORAGE_BUCKET;
}

export function getApiConnectionRunArtifactStorageBucket() {
  return (
    process.env.SUPABASE_API_CONNECTION_ARTIFACT_BUCKET?.trim() ||
    DEFAULT_API_CONNECTION_RUN_ARTIFACT_BUCKET
  );
}

export function getPartnerExportArtifactStorageBucket() {
  return (
    process.env.SUPABASE_PARTNER_EXPORT_ARTIFACT_BUCKET?.trim() ||
    DEFAULT_PARTNER_EXPORT_ARTIFACT_BUCKET
  );
}

export function getReferenceResourceArtifactStorageBucket() {
  return (
    process.env.SUPABASE_REFERENCE_RESOURCE_ARTIFACT_BUCKET?.trim() ||
    DEFAULT_REFERENCE_RESOURCE_ARTIFACT_BUCKET
  );
}

export function getApiConnectionRunArtifactReadBuckets() {
  return Array.from(
    new Set([getApiConnectionRunArtifactStorageBucket(), getDatasetStorageBucket()]),
  );
}

export function createDatasetStoragePath(fileName: string) {
  return `${DATASET_STORAGE_PATH_PREFIX}${randomUUID()}-${sanitizeFileName(fileName)}`;
}

export function createApiConnectionRunOutputStoragePath(
  runId: string,
  fileName: string,
) {
  return `${API_CONNECTION_RUN_OUTPUT_PATH_PREFIX}${runId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

export type ImbFormingArtifactKind = "rows" | "findings" | "manifest" | "csv";

export function createImbFormingArtifactStoragePath(input: {
  sourceRunId: string;
  formingRunId: string;
  kind: ImbFormingArtifactKind;
}) {
  const extension = input.kind === "csv" ? "csv" : "json";
  return `${IMB_FORMING_OUTPUT_PATH_PREFIX}${input.sourceRunId}/${input.formingRunId}/${input.kind}.${extension}`;
}

export function createPartnerExportRunOutputStoragePath(
  runId: string,
  fileName: string,
) {
  return `${PARTNER_EXPORT_RUN_OUTPUT_PATH_PREFIX}${runId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

export type ReferenceResourceArtifactKind =
  | "raw-manifest"
  | "normalized"
  | "csv"
  | "validation"
  | "diff";

export function createReferenceResourceArtifactStoragePath(input: {
  resourceKey: string;
  versionId: string;
  kind: ReferenceResourceArtifactKind;
}) {
  const extension = input.kind === "csv" ? "csv" : "json";
  return `${REFERENCE_RESOURCE_PATH_PREFIX}${sanitizeFileName(input.resourceKey)}/${input.versionId}/${input.kind}.${extension}`;
}

export function isReferenceResourceArtifactStoragePath(path: string) {
  return path.startsWith(REFERENCE_RESOURCE_PATH_PREFIX);
}

export function isDatasetStoragePath(path: string) {
  return path.startsWith(DATASET_STORAGE_PATH_PREFIX);
}

export function getDatasetStorageObjectUrl(path: string) {
  const { supabaseUrl } = getSupabaseConfig();

  return new URL(
    `/storage/v1/object/${getDatasetStorageBucket()}/${path}`,
    supabaseUrl,
  ).toString();
}
