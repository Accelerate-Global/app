"use client";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, type DragEvent } from "react";
import Papa from "papaparse";

import type {
  CsvColumn,
  DatasetSummary,
  DatasetUploadAuthorizationResponse,
} from "@/lib/api-types";
import {
  isCsvFile,
  MAX_CSV_BYTES,
  normalizeHeaders,
  rowArrayToRecord,
  ROW_BATCH_SIZE,
  sanitizeFileName,
} from "@/lib/csv";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type DatasetUploadClientProps = {
  targetDataset?: DatasetSummary | null;
};

type UploadState = {
  fileName: string;
  phase: "idle" | "uploading" | "parsing" | "ready" | "failed";
  progress: number;
  rowsParsed: number;
  message: string;
};

type DatasetResponse = {
  dataset: DatasetSummary;
};

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

async function parseHeader(file: File) {
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
    throw new Error(
      await getErrorMessage(response, "The upload could not be authorized."),
    );
  }

  return (await response.json()) as DatasetUploadAuthorizationResponse;
}

async function createDatasetRecord(input: {
  file: File;
  columns: CsvColumn[];
  blobPath: string;
}) {
  const response = await fetch("/api/datasets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: input.file.name,
      blobPath: input.blobPath,
      sizeBytes: input.file.size,
      columns: input.columns,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "The dataset record could not be created."),
    );
  }

  return ((await response.json()) as DatasetResponse).dataset;
}

async function replaceDatasetRecord(input: {
  datasetId: string;
  file: File;
  columns: CsvColumn[];
  blobPath: string;
}) {
  const response = await fetch(`/api/datasets/${input.datasetId}/replace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blobPath: input.blobPath,
      sizeBytes: input.file.size,
      columns: input.columns,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "The dataset could not be replaced."),
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
    throw new Error(
      await getErrorMessage(response, "A row batch could not be saved."),
    );
  }

  return ((await response.json()) as DatasetResponse).dataset;
}

async function markDatasetFailed(datasetId: string, error: string) {
  await fetch(`/api/datasets/${datasetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "failed", error }),
  });
}

async function parseAndPersistRows(input: {
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
      if (batch.length === 0) return null;

      const rows = batch;
      const startIndex = batchStartIndex;
      batch = [];
      batchStartIndex = rowIndex;
      return postRows({
        datasetId: input.datasetId,
        startIndex,
        rows,
      });
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error("CSV parsing failed."));
    };

    const processChunk = async (data: string[][]) => {
      if (settled) return;

      const records = data.filter((row) =>
        row.some((value) => String(value ?? "").trim() !== ""),
      );
      const rows = sawHeader ? records : records.slice(1);
      sawHeader = true;

      for (const row of rows) {
        if (batch.length === 0) {
          batchStartIndex = rowIndex;
        }
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
        pendingChunk = pendingChunk
          .then(() => processChunk(result.data))
          .catch(fail);
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
      error: (error) => fail(error),
    });
  });
}

export function DatasetUploadClient({
  targetDataset = null,
}: DatasetUploadClientProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [completedDataset, setCompletedDataset] = useState<DatasetSummary | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const isReplacing = targetDataset !== null;
  const isBusy =
    upload?.phase === "uploading" || upload?.phase === "parsing";

  async function handleFile(file: File) {
    let datasetId: string | null = null;
    const uploadFileName = isReplacing ? targetDataset.fileName : file.name;

    try {
      if (!isCsvFile(file)) {
        throw new Error("Choose a CSV file.");
      }

      if (file.size > MAX_CSV_BYTES) {
        throw new Error("CSV files can be up to 25MB.");
      }

      setCompletedDataset(null);
      setUpload({
        fileName: uploadFileName,
        phase: "uploading",
        progress: 2,
        rowsParsed: 0,
        message: isReplacing
          ? `Checking columns for ${targetDataset.fileName}`
          : "Checking columns",
      });

      const columns = await parseHeader(file);
      const uploadAuthorization = await authorizeUpload(file);

      setUpload((current) =>
        current
          ? {
              ...current,
              progress: 35,
              message: isReplacing
                ? `Uploading replacement for ${targetDataset.fileName}`
                : "Uploading CSV to Supabase",
            }
          : current,
      );

      const supabase = createSupabaseBrowserClient();
      const uploadResult = await supabase.storage
        .from(uploadAuthorization.bucket)
        .uploadToSignedUrl(
          uploadAuthorization.path,
          uploadAuthorization.token,
          file,
          {
            contentType: file.type || "text/csv",
            upsert: false,
          },
        );

      if (uploadResult.error) {
        throw uploadResult.error;
      }

      const nextDataset = isReplacing
        ? await replaceDatasetRecord({
            datasetId: targetDataset.id,
            file,
            columns,
            blobPath: uploadAuthorization.path,
          })
        : await createDatasetRecord({
            file,
            columns,
            blobPath: uploadAuthorization.path,
          });

      datasetId = nextDataset.id;

      setUpload({
        fileName: nextDataset.fileName,
        phase: "parsing",
        progress: 45,
        rowsParsed: 0,
        message: isReplacing
          ? `Saving rows for ${nextDataset.fileName}`
          : "Saving rows",
      });

      const finalDataset = await parseAndPersistRows({
        file,
        columns,
        datasetId: nextDataset.id,
        onProgress: (rowsParsed) => {
          setUpload((current) =>
            current
              ? {
                  ...current,
                  progress: Math.min(95, 45 + Math.floor(rowsParsed / 250)),
                  rowsParsed,
                  message: isReplacing
                    ? `Saving rows for ${nextDataset.fileName}`
                    : "Saving rows",
                }
              : current,
          );
        },
      });

      setCompletedDataset(finalDataset);
      setUpload({
        fileName: finalDataset.fileName,
        phase: "ready",
        progress: 100,
        rowsParsed: finalDataset.rowCount,
        message: isReplacing ? "Dataset replaced" : "Dataset ready",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isReplacing
            ? "The dataset replacement failed."
            : "The upload failed.";

      if (datasetId) {
        await markDatasetFailed(datasetId, message);
      }

      setCompletedDataset(null);
      setUpload({
        fileName: uploadFileName,
        phase: "failed",
        progress: 100,
        rowsParsed: 0,
        message,
      });
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (isBusy) {
      return;
    }

    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{isReplacing ? "Replace CSV" : "Upload CSV"}</CardTitle>
          <CardDescription>
            {isReplacing
              ? `Upload a new CSV to replace ${targetDataset.fileName}.`
              : "Upload a new CSV for everyone to view."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 p-6 text-center transition-colors",
              !isBusy && isDragging && "border-foreground bg-muted",
            )}
            onDragOver={(event) => {
              if (isBusy) {
                return;
              }

              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
              <UploadIcon className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Drop a CSV here</p>
              <p className="text-sm text-muted-foreground">Files up to 25MB.</p>
            </div>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              data-smoke-upload-input="dataset-upload"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <Button
              type="button"
              disabled={isBusy}
              onClick={() => inputRef.current?.click()}
            >
              Choose CSV
            </Button>
          </div>

          {upload ? (
            <div className="mt-4 space-y-3 rounded-lg border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{upload.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {upload.message}
                    {upload.rowsParsed > 0
                      ? ` · ${upload.rowsParsed.toLocaleString()} rows`
                      : ""}
                  </p>
                </div>
                {upload.phase === "ready" ? (
                  <CheckCircle2Icon className="size-5 text-emerald-600" />
                ) : upload.phase === "failed" ? (
                  <AlertCircleIcon className="size-5 text-destructive" />
                ) : (
                  <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                )}
              </div>
              <Progress value={upload.progress} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {completedDataset ? (
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>
            {isReplacing ? "Replacement complete" : "Upload complete"}
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{completedDataset.fileName} is ready.</span>
            <Link
              href={`/dashboard/datasets/${completedDataset.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              View dataset
            </Link>
            <Link
              href="/dashboard#datasets"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Dashboard
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {upload?.phase === "failed" ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Dataset update failed</AlertTitle>
          <AlertDescription>{upload.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
