import { Buffer } from "node:buffer";

import {
  createDatasetStoragePath,
  getApiConnectionRunArtifactStorageBucket,
  getDatasetStorageBucket,
} from "@/lib/dataset-storage";
import { logError } from "@/lib/error-logging";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type { PipelineArtifactKind } from "./types";

function assertSegment(value: string, label: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u.test(value)) {
    throw new Error(`Invalid pipeline ${label}.`);
  }
}

export function createPipelineArtifactStoragePath(input: {
  definitionKey: string;
  runId: string;
  kind: PipelineArtifactKind;
}) {
  assertSegment(input.definitionKey, "definition key");
  assertSegment(input.runId, "run id");
  const extension = input.kind === "rows-csv" ? "csv" : "json";
  return `pipeline-products/${input.definitionKey}/${input.runId}/${input.kind}.${extension}`;
}

export async function uploadPipelineArtifact(input: {
  definitionKey: string;
  runId: string;
  kind: PipelineArtifactKind;
  body: string;
}) {
  const storagePath = createPipelineArtifactStoragePath(input);
  const { error } = await createSupabaseAdminClient()
    .storage.from(getApiConnectionRunArtifactStorageBucket())
    .upload(storagePath, Buffer.from(input.body, "utf8"), {
      contentType: input.kind === "rows-csv" ? "text/csv; charset=utf-8" : "application/json",
      upsert: false,
    });
  if (error) {
    logError(`Failed to store pipeline ${input.kind} artifact`, error);
    throw new Error(`Could not store pipeline ${input.kind} artifact.`);
  }
  return storagePath;
}

export async function readPipelineArtifact(storagePath: string) {
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(getApiConnectionRunArtifactStorageBucket())
    .download(storagePath);
  if (error || !data) throw new Error("Could not read pipeline artifact.");
  return data.text();
}

export async function deletePipelineArtifacts(storagePaths: readonly string[]) {
  if (storagePaths.length === 0) return;
  const { error } = await createSupabaseAdminClient()
    .storage.from(getApiConnectionRunArtifactStorageBucket())
    .remove([...storagePaths]);
  if (error) {
    logError("Failed to clean up pipeline artifacts", error);
    throw new Error("Could not clean up pipeline artifacts.");
  }
}

export async function uploadPipelineDatasetBlob(input: {
  fileName: string;
  csv: string;
  storagePath?: string;
}) {
  const storagePath = input.storagePath ?? createDatasetStoragePath(input.fileName);
  const { error } = await createSupabaseAdminClient()
    .storage.from(getDatasetStorageBucket())
    .upload(storagePath, Buffer.from(input.csv, "utf8"), {
      contentType: "text/csv; charset=utf-8",
      upsert: false,
    });
  if (error) {
    logError("Failed to store pipeline dataset blob", error);
    throw new Error("Could not store pipeline dataset blob.");
  }
  return storagePath;
}

export async function deletePipelineDatasetBlob(storagePath: string) {
  const { error } = await createSupabaseAdminClient()
    .storage.from(getDatasetStorageBucket())
    .remove([storagePath]);
  if (error) {
    logError("Failed to clean up pipeline dataset blob", error);
    throw new Error("Could not clean up pipeline dataset blob.");
  }
}
