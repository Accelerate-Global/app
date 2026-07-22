import { Buffer } from "node:buffer";

import {
  createImbFormingArtifactStoragePath,
  getApiConnectionRunArtifactStorageBucket,
} from "@/lib/dataset-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type { ImbFormingArtifactKind } from "./types";

export async function uploadImbFormingArtifact(input: {
  sourceRunId: string;
  formingRunId: string;
  kind: ImbFormingArtifactKind;
  body: string;
}) {
  const path = createImbFormingArtifactStoragePath(input);
  const contentType =
    input.kind === "csv" ? "text/csv; charset=utf-8" : "application/json";
  const { error } = await createSupabaseAdminClient()
    .storage.from(getApiConnectionRunArtifactStorageBucket())
    .upload(path, Buffer.from(input.body, "utf8"), {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Could not store IMB forming ${input.kind} artifact.`);
  }

  return path;
}

export async function readImbFormingArtifact(path: string) {
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(getApiConnectionRunArtifactStorageBucket())
    .download(path);

  if (error || !data) {
    throw new Error("Could not read IMB forming artifact.");
  }

  return data.text();
}

export async function deleteImbFormingArtifacts(paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await createSupabaseAdminClient()
    .storage.from(getApiConnectionRunArtifactStorageBucket())
    .remove(paths);
  if (error) {
    throw new Error("Could not clean up IMB forming artifacts.");
  }
}
