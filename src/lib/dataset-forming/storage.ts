import { Buffer } from "node:buffer";

import {
  createImbFormingArtifactStoragePath,
  getApiConnectionRunArtifactStorageBucket,
} from "@/lib/dataset-storage";
import { logError } from "@/lib/error-logging";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type { DatasetFormingArtifactKind } from "./types";

const GENERIC_FORMING_OUTPUT_PATH_PREFIX = "dataset-forming-runs/";

function assertSafeStorageSegment(value: string, label: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u.test(value)) {
    throw new Error(`Invalid dataset forming ${label}.`);
  }
}

export function createDatasetFormingArtifactStoragePath(input: {
  engineKey: string;
  sourceRunId: string;
  formingRunId: string;
  kind: DatasetFormingArtifactKind;
}) {
  assertSafeStorageSegment(input.sourceRunId, "source run id");
  assertSafeStorageSegment(input.formingRunId, "run id");
  if (input.engineKey === "imb") {
    return createImbFormingArtifactStoragePath(input);
  }
  assertSafeStorageSegment(input.engineKey, "engine key");
  const extension = input.kind === "csv" ? "csv" : "json";
  return `${GENERIC_FORMING_OUTPUT_PATH_PREFIX}${input.engineKey}/${input.sourceRunId}/${input.formingRunId}/${input.kind}.${extension}`;
}

export async function uploadDatasetFormingArtifact(
  input: {
    engineKey: string;
    sourceRunId: string;
    formingRunId: string;
    kind: DatasetFormingArtifactKind;
    body: string;
  },
  errorLabel = "dataset forming",
) {
  const path = createDatasetFormingArtifactStoragePath(input);
  const contentType =
    input.kind === "csv" ? "text/csv; charset=utf-8" : "application/json";
  const { error } = await createSupabaseAdminClient()
    .storage.from(getApiConnectionRunArtifactStorageBucket())
    .upload(path, Buffer.from(input.body, "utf8"), {
      contentType,
      upsert: false,
    });

  if (error) {
    logError(`Failed to store ${errorLabel} ${input.kind} artifact`, error);
    throw new Error(`Could not store ${errorLabel} ${input.kind} artifact.`);
  }

  return path;
}

export async function readDatasetFormingArtifact(
  path: string,
  errorLabel = "dataset forming",
) {
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(getApiConnectionRunArtifactStorageBucket())
    .download(path);

  if (error || !data) {
    throw new Error(`Could not read ${errorLabel} artifact.`);
  }

  return data.text();
}

export async function deleteDatasetFormingArtifacts(
  paths: string[],
  errorLabel = "dataset forming",
) {
  if (paths.length === 0) return;
  const { error } = await createSupabaseAdminClient()
    .storage.from(getApiConnectionRunArtifactStorageBucket())
    .remove(paths);
  if (error) {
    throw new Error(`Could not clean up ${errorLabel} artifacts.`);
  }
}
