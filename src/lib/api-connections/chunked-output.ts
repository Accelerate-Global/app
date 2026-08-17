import {
  checksumApiConnectionArtifact,
  parseApiConnectionRawChunkManifest,
  parseApiConnectionRowsArtifact,
  parseApiConnectionRowsChunkManifest,
  type ApiConnectionArtifactChunk,
  type ApiConnectionRawChunkManifest,
  type ApiConnectionRowsChunkManifest,
  UTF8_BOM,
} from "@/lib/api-connection-output";
import type { ApiConnectionRunMode, CsvColumn } from "@/lib/api-types";
import { escapeCsvCell } from "@/lib/csv";
import {
  API_CONNECTION_RUN_ARTIFACT_CONTENT_TYPE,
  createApiConnectionRunChunkStoragePath,
  createApiConnectionRunManifestStoragePath,
  getApiConnectionRunArtifactReadBuckets,
  getApiConnectionRunArtifactStorageBucket,
  type ApiConnectionRunChunkKind,
} from "@/lib/dataset-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const encoder = new TextEncoder();

export async function downloadApiConnectionArtifactText(path: string) {
  const supabase = createSupabaseAdminClient();

  for (const bucket of getApiConnectionRunArtifactReadBuckets()) {
    const result = await supabase.storage.from(bucket).download(path);

    if (!result.error) return result.data.text();
    if (result.error.status !== 404) throw result.error;
  }

  throw Object.assign(new Error("API connection run artifact was not found."), {
    status: 404,
  });
}

async function uploadImmutableArtifact(input: {
  path: string;
  content: string;
}) {
  const supabase = createSupabaseAdminClient();
  const result = await supabase.storage
    .from(getApiConnectionRunArtifactStorageBucket())
    .upload(
      input.path,
      new Blob([input.content], {
        type: API_CONNECTION_RUN_ARTIFACT_CONTENT_TYPE,
      }),
      {
        contentType: API_CONNECTION_RUN_ARTIFACT_CONTENT_TYPE,
        upsert: false,
      },
    );

  if (result.error) {
    const retained = await downloadApiConnectionArtifactText(input.path).catch(
      () => null,
    );
    if (retained !== input.content) throw result.error;
  }

  return {
    path: input.path,
    sizeBytes: Buffer.byteLength(input.content),
    checksum: checksumApiConnectionArtifact(input.content),
  };
}

export async function uploadApiConnectionRunChunk(input: {
  runId: string;
  kind: ApiConnectionRunChunkKind;
  page: number;
  rowCount: number;
  content: string;
}): Promise<ApiConnectionArtifactChunk> {
  const uploaded = await uploadImmutableArtifact({
    path: createApiConnectionRunChunkStoragePath(input),
    content: input.content,
  });

  return {
    page: input.page,
    rowCount: input.rowCount,
    ...uploaded,
  };
}

export async function uploadApiConnectionRunChunkManifests(input: {
  runId: string;
  connectionId: string;
  mode: ApiConnectionRunMode;
  responseFormat: "json" | "csv";
  responseDataPath: string;
  httpStatus: number | null;
  rowCount: number;
  columns: CsvColumn[];
  rawChunks: ApiConnectionArtifactChunk[];
  rowsChunks: ApiConnectionArtifactChunk[];
}) {
  const rawManifest: ApiConnectionRawChunkManifest = {
    schemaVersion: 1,
    kind: "api-connection-raw-chunks",
    runId: input.runId,
    connectionId: input.connectionId,
    mode: input.mode,
    responseFormat: input.responseFormat,
    responseDataPath: input.responseDataPath,
    httpStatus: input.httpStatus,
    rowCount: input.rowCount,
    chunks: input.rawChunks,
  };
  const rowsManifest: ApiConnectionRowsChunkManifest = {
    schemaVersion: 1,
    kind: "api-connection-rows-chunks",
    columns: input.columns,
    rowCount: input.rowCount,
    chunks: input.rowsChunks,
  };
  const rawContent = JSON.stringify(rawManifest);
  const rowsContent = JSON.stringify(rowsManifest);
  const [raw, rows] = await Promise.all([
    uploadImmutableArtifact({
      path: createApiConnectionRunManifestStoragePath({
        runId: input.runId,
        kind: "raw",
      }),
      content: rawContent,
    }),
    uploadImmutableArtifact({
      path: createApiConnectionRunManifestStoragePath({
        runId: input.runId,
        kind: "rows",
      }),
      content: rowsContent,
    }),
  ]);

  return { raw, rows, rawManifest, rowsManifest };
}

export function readRowsChunkManifest(value: string) {
  return parseApiConnectionRowsChunkManifest(value);
}

export function readRawChunkManifest(value: string) {
  return parseApiConnectionRawChunkManifest(value);
}

function streamText(
  write: (enqueue: (value: string) => void) => Promise<void>,
) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await write((value) => controller.enqueue(encoder.encode(value)));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export function createRawChunkDownloadStream(
  manifest: ApiConnectionRawChunkManifest,
) {
  return streamText(async (enqueue) => {
    const metadata = {
      runId: manifest.runId,
      connectionId: manifest.connectionId,
      mode: manifest.mode,
      responseFormat: manifest.responseFormat,
      responseDataPath: manifest.responseDataPath,
      httpStatus: manifest.httpStatus,
      rowCount: manifest.rowCount,
    };
    const fields = Object.entries(metadata).map(
      ([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`,
    );
    enqueue(`{${fields.join(",")},"rawResponse":"[`);
    let hasRecords = false;

    for (const chunk of manifest.chunks) {
      const body = (await downloadApiConnectionArtifactText(chunk.path)).trim();
      if (checksumApiConnectionArtifact(body) !== chunk.checksum) {
        throw new Error("A raw API connection chunk checksum is invalid.");
      }
      if (!body.startsWith("[") || !body.endsWith("]")) {
        throw new Error("A raw API connection chunk is invalid.");
      }
      const inner = body.slice(1, -1);
      if (!inner || chunk.rowCount === 0) continue;
      if (hasRecords) enqueue(",");
      enqueue(JSON.stringify(inner).slice(1, -1));
      hasRecords = true;
    }

    enqueue(`]"}`);
  });
}

export function createRowsChunkCsvDownloadStream(
  manifest: ApiConnectionRowsChunkManifest,
) {
  return streamText(async (enqueue) => {
    enqueue(UTF8_BOM);
    enqueue(
      `${manifest.columns.map((column) => escapeCsvCell(column.label)).join(",")}\r\n`,
    );

    for (const chunk of manifest.chunks) {
      const content = await downloadApiConnectionArtifactText(chunk.path);
      if (checksumApiConnectionArtifact(content) !== chunk.checksum) {
        throw new Error("An API connection rows chunk checksum is invalid.");
      }
      const artifact = parseApiConnectionRowsArtifact(content);
      for (const row of artifact.rows) {
        enqueue(
          `${manifest.columns
            .map((column) => escapeCsvCell(row[column.key] ?? ""))
            .join(",")}\r\n`,
        );
      }
    }
  });
}
