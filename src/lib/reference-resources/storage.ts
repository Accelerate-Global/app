import { Buffer } from "node:buffer";

import {
  createReferenceResourceArtifactStoragePath,
  getReferenceResourceArtifactStorageBucket,
  type ReferenceResourceArtifactKind,
} from "@/lib/dataset-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ReferenceResourceArtifactManifest = Partial<
  Record<ReferenceResourceArtifactKind, string>
>;

export async function uploadReferenceResourceArtifact(input: {
  resourceKey: string;
  versionId: string;
  kind: ReferenceResourceArtifactKind;
  body: string;
}) {
  const path = createReferenceResourceArtifactStoragePath(input);
  const contentType = input.kind === "csv" ? "text/csv" : "application/json";
  const { error } = await createSupabaseAdminClient()
    .storage.from(getReferenceResourceArtifactStorageBucket())
    .upload(path, Buffer.from(input.body, "utf8"), {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Could not store reference resource ${input.kind} artifact.`);
  }

  return path;
}

export async function deleteReferenceResourceArtifacts(paths: string[]) {
  if (paths.length === 0) {
    return;
  }

  const { error } = await createSupabaseAdminClient()
    .storage.from(getReferenceResourceArtifactStorageBucket())
    .remove(paths);

  if (error) {
    throw new Error("Could not clean up reference resource artifacts.");
  }
}

export async function referenceResourceArtifactExists(path: string) {
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(getReferenceResourceArtifactStorageBucket())
    .download(path);
  return !error && Boolean(data);
}

export async function readReferenceResourceArtifact(path: string) {
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(getReferenceResourceArtifactStorageBucket())
    .download(path);
  if (error || !data) {
    throw new Error("Could not read reference resource artifact.");
  }
  return data.text();
}
