import { Buffer } from "node:buffer";

import {
  createPartnerExportRunOutputStoragePath,
  getPartnerExportArtifactStorageBucket,
} from "@/lib/dataset-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type { PartnerExportArtifactKind } from "./types";

function getArtifactFileName(kind: PartnerExportArtifactKind, csvFileName: string) {
  if (kind === "csv") {
    return csvFileName;
  }

  return kind === "crosswalk" ? "crosswalk.json" : "validation.json";
}

function getArtifactContentType(kind: PartnerExportArtifactKind) {
  return kind === "csv" ? "text/csv" : "application/json";
}

export async function uploadPartnerExportArtifact(input: {
  runId: string;
  kind: PartnerExportArtifactKind;
  csvFileName: string;
  body: string;
}) {
  const path = createPartnerExportRunOutputStoragePath(
    input.runId,
    getArtifactFileName(input.kind, input.csvFileName),
  );
  const bucket = getPartnerExportArtifactStorageBucket();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(bucket).upload(
    path,
    Buffer.from(input.body, "utf8"),
    {
      contentType: getArtifactContentType(input.kind),
      upsert: false,
    },
  );

  if (error) {
    throw new Error(`Could not store partner export ${input.kind} artifact.`);
  }

  return path;
}

export async function deletePartnerExportArtifacts(paths: string[]) {
  if (paths.length === 0) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(getPartnerExportArtifactStorageBucket())
    .remove(paths);

  if (error) {
    throw new Error("Could not clean up partner export artifacts.");
  }
}

export async function downloadPartnerExportArtifact(path: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(getPartnerExportArtifactStorageBucket())
    .download(path);

  if (error || !data) {
    return null;
  }

  return data.arrayBuffer();
}
