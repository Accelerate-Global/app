import { Buffer } from "node:buffer";

import {
  getDatasetStorageBucket,
  getDatasetStorageObjectUrl,
} from "@/lib/dataset-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type { AxIdentityArtifactKind } from "./types";

const PREFIX = "identity-registry-runs";

export function createAxIdentityArtifactPath(runId: string, kind: AxIdentityArtifactKind) {
  const extension = kind === "csv" ? "csv" : "json";
  return `${PREFIX}/${runId}/${kind}.${extension}`;
}

export async function uploadAxIdentityArtifact(input: {
  runId: string;
  kind: AxIdentityArtifactKind;
  body: string;
}) {
  const path = createAxIdentityArtifactPath(input.runId, input.kind);
  const contentType = input.kind === "csv" ? "text/csv" : "application/json";
  const { error } = await createSupabaseAdminClient()
    .storage.from(getDatasetStorageBucket())
    .upload(path, Buffer.from(input.body, "utf8"), { contentType, upsert: false });

  if (error) throw new Error(`Could not store AX identity ${input.kind} artifact.`);
  return path;
}

export async function readAxIdentityArtifact(path: string) {
  if (!path.startsWith(`${PREFIX}/`)) throw new Error("Invalid AX identity artifact path.");
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(getDatasetStorageBucket())
    .download(path);
  if (error || !data) throw new Error("Could not read AX identity artifact.");
  return data.text();
}

export async function deleteAxIdentityArtifacts(paths: readonly string[]) {
  if (paths.length === 0) return;
  const { error } = await createSupabaseAdminClient()
    .storage.from(getDatasetStorageBucket())
    .remove([...paths]);
  if (error) throw new Error("Could not clean up AX identity artifacts.");
}

export function getAxIdentityArtifactUrl(path: string) {
  return getDatasetStorageObjectUrl(path);
}
