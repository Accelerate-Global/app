import Papa from "papaparse";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  CsvColumn,
  DatasetClassification,
  DatasetSummary,
  DatasetUploadAuthorizationResponse,
} from "@/lib/api-types";
import {
  withAnalyticsContext,
  type AppAnalyticsContext,
  type DatasetUploadFailureStage,
} from "@/lib/analytics";
import { trackAppEvent } from "@/lib/analytics-client";
import {
  isCsvFile,
  MAX_CSV_BYTES,
  normalizeHeaders,
  rowArrayToRecord,
  ROW_BATCH_SIZE,
  sanitizeFileName,
} from "@/lib/csv";

type DatasetResponse = { dataset: DatasetSummary };

async function responseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

export async function parseDatasetCsvHeader(file: File) {
  if (!isCsvFile(file)) throw new Error("Choose a CSV file.");
  if (file.size > MAX_CSV_BYTES) throw new Error("CSV files can be up to 25MB.");

  return new Promise<CsvColumn[]>((resolve, reject) => {
    Papa.parse<string[]>(file, {
      preview: 1,
      skipEmptyLines: "greedy",
      complete: (result) => {
        const header = result.data[0];
        if (!header?.length) {
          reject(new Error("CSV header row is empty."));
          return;
        }
        resolve(normalizeHeaders(header));
      },
      error: (error) => reject(error),
    });
  });
}

async function authorizeUpload(file: File) {
  const response = await fetch("/api/blob/upload-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: sanitizeFileName(file.name),
      sizeBytes: file.size,
      contentType: file.type || "text/csv",
    }),
  });
  if (!response.ok) {
    throw new Error(await responseError(response, "The upload could not be authorized."));
  }
  return (await response.json()) as DatasetUploadAuthorizationResponse;
}

async function createDataset(input: {
  file: File;
  datasetName: string;
  columns: CsvColumn[];
  blobPath: string;
  classification: DatasetClassification;
  isWorkspaceVisible: boolean;
}) {
  const response = await fetch("/api/datasets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: input.datasetName,
      blobPath: input.blobPath,
      sizeBytes: input.file.size,
      columns: input.columns,
      classification: input.classification,
      isWorkspaceVisible: input.isWorkspaceVisible,
    }),
  });
  if (!response.ok) {
    throw new Error(
      await responseError(response, "The dataset record could not be created."),
    );
  }
  return ((await response.json()) as DatasetResponse).dataset;
}

async function postRows(input: {
  datasetId: string;
  startIndex: number;
  rows: Record<string, string>[];
  isFinalBatch?: boolean;
  totalRows?: number;
}) {
  const response = await fetch(`/api/datasets/${input.datasetId}/rows/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await responseError(response, "A row batch could not be saved."));
  }
  return ((await response.json()) as DatasetResponse).dataset;
}

async function markFailed(datasetId: string, error: string) {
  await fetch(`/api/datasets/${datasetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "failed", error }),
  });
}

async function persistRows(input: {
  file: File;
  columns: CsvColumn[];
  datasetId: string;
  onProgress: (rowsParsed: number) => void;
}) {
  return new Promise<DatasetSummary>((resolve, reject) => {
    let sawHeader = false;
    let rowIndex = 0;
    let batchStartIndex = 0;
    let batch: Record<string, string>[] = [];
    let settled = false;
    let pendingChunk = Promise.resolve();

    const flushBatch = async () => {
      if (batch.length === 0) return;
      const rows = batch;
      const startIndex = batchStartIndex;
      batch = [];
      batchStartIndex = rowIndex;
      await postRows({ datasetId: input.datasetId, startIndex, rows });
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error("CSV parsing failed."));
    };
    const processChunk = async (data: string[][]) => {
      const records = data.filter((row) =>
        row.some((value) => String(value ?? "").trim() !== ""),
      );
      const rows = sawHeader ? records : records.slice(1);
      sawHeader = true;
      for (const row of rows) {
        if (batch.length === 0) batchStartIndex = rowIndex;
        batch.push(rowArrayToRecord(row, input.columns));
        rowIndex += 1;
        if (batch.length >= ROW_BATCH_SIZE) {
          await flushBatch();
          input.onProgress(rowIndex);
        }
      }
      input.onProgress(rowIndex);
    };

    Papa.parse<string[]>(input.file, {
      worker: true,
      skipEmptyLines: "greedy",
      chunk: (result) => {
        pendingChunk = pendingChunk.then(() => processChunk(result.data)).catch(fail);
      },
      complete: () => {
        void pendingChunk
          .then(async () => {
            if (settled) return;
            await flushBatch();
            const dataset = await postRows({
              datasetId: input.datasetId,
              startIndex: rowIndex,
              rows: [],
              isFinalBatch: true,
              totalRows: rowIndex,
            });
            settled = true;
            resolve(dataset);
          })
          .catch(fail);
      },
      error: fail,
    });
  });
}

export async function uploadNewDatasetCsv(input: {
  file: File;
  datasetName: string;
  columns: CsvColumn[];
  classification: DatasetClassification;
  isWorkspaceVisible: boolean;
  analyticsContext?: AppAnalyticsContext;
  onProgress: (progress: number, rowsParsed: number, message: string) => void;
}) {
  let datasetId: string | null = null;
  let rowsParsed = 0;
  let failureStage: DatasetUploadFailureStage = "authorize";
  const startedAt = Date.now();
  if (input.analyticsContext) {
    trackAppEvent(
      "dataset_upload_started",
      withAnalyticsContext(input.analyticsContext, {
        source_surface: "dataset_onboarding",
        success: true,
        file_size_bytes: input.file.size,
      }),
    );
  }
  try {
    input.onProgress(10, 0, "Authorizing upload");
    const authorization = await authorizeUpload(input.file);
    failureStage = "blob_upload";
    input.onProgress(30, 0, "Uploading CSV");
    const uploadResult = await createSupabaseBrowserClient()
      .storage.from(authorization.bucket)
      .uploadToSignedUrl(authorization.path, authorization.token, input.file, {
        contentType: input.file.type || "text/csv",
        upsert: false,
      });
    if (uploadResult.error) throw uploadResult.error;

    failureStage = "dataset_create";
    input.onProgress(45, 0, "Creating dataset");
    const dataset = await createDataset({
      ...input,
      blobPath: authorization.path,
    });
    datasetId = dataset.id;
    failureStage = "row_persist";
    const completedDataset = await persistRows({
      file: input.file,
      columns: input.columns,
      datasetId,
      onProgress: (nextRowsParsed) => {
        rowsParsed = nextRowsParsed;
        input.onProgress(
          Math.min(95, 50 + Math.floor(nextRowsParsed / 250)),
          nextRowsParsed,
          "Saving rows",
        );
      },
    });
    if (input.analyticsContext) {
      trackAppEvent(
        "dataset_upload_completed",
        withAnalyticsContext(input.analyticsContext, {
          source_surface: "dataset_onboarding",
          success: true,
          dataset_id: completedDataset.id,
          file_size_bytes: input.file.size,
          column_count: input.columns.length,
          row_count: completedDataset.rowCount,
          duration_ms: Date.now() - startedAt,
        }),
      );
    }
    return completedDataset;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The upload failed.";
    if (datasetId) {
      failureStage = "mark_failed";
      await markFailed(datasetId, message);
    }
    if (input.analyticsContext) {
      trackAppEvent(
        "dataset_upload_failed",
        withAnalyticsContext(input.analyticsContext, {
          source_surface: "dataset_onboarding",
          success: false,
          error_code: `${failureStage}_failed`,
          duration_ms: Date.now() - startedAt,
          dataset_id: datasetId ?? undefined,
          file_size_bytes: input.file.size,
          column_count: input.columns.length,
          row_count: rowsParsed || undefined,
          failure_stage: failureStage,
        }),
      );
    }
    throw error;
  }
}
