import { randomUUID } from "node:crypto";

import { sanitizeFileName } from "@/lib/csv";
import { getSupabaseConfig } from "@/lib/supabase/config";

const DATASET_STORAGE_PATH_PREFIX = "datasets/csv/";
const DEFAULT_DATASET_STORAGE_BUCKET = "datasets";

export function getDatasetStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_DATASET_STORAGE_BUCKET;
}

export function createDatasetStoragePath(fileName: string) {
  return `${DATASET_STORAGE_PATH_PREFIX}${randomUUID()}-${sanitizeFileName(fileName)}`;
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
