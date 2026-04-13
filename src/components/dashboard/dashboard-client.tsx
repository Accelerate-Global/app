"use client";

import { put } from "@vercel/blob/client";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";
import Papa from "papaparse";
import { useRef, useState, type DragEvent } from "react";

import { DatasetsGrid } from "@/components/dashboard/datasets-grid";
import type {
  BlobUploadTokenResponse,
  CsvColumn,
  DatasetSummary,
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type DashboardClientProps = {
  initialDatasets: DatasetSummary[];
};

type UploadState = {
  fileName: string;
  phase: "idle" | "uploading" | "parsing" | "ready" | "failed";
  progress: number;
  rowsParsed: number;
  message: string;
};

type DatasetListResponse = {
  datasets: DatasetSummary[];
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

async function createBlobToken(file: File) {
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

  return (await response.json()) as BlobUploadTokenResponse;
}

async function createDataset(input: {
  file: File;
  columns: CsvColumn[];
  blobUrl: string;
  blobPath: string;
}) {
  const response = await fetch("/api/datasets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: input.file.name,
      blobUrl: input.blobUrl,
      blobPath: input.blobPath,
      sizeBytes: input.file.size,
      columns: input.columns,
    }),
  });

  if (!response.ok) {
    throw new Error("The dataset record could not be created.");
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
    throw new Error("A row batch could not be saved.");
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
        void pendingChunk.then(async () => {
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
        }).catch(fail);
      },
      error: (error) => fail(error),
    });
  });
}

export function DashboardClient({ initialDatasets }: DashboardClientProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [datasets, setDatasets] = useState(initialDatasets);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function refreshDatasets() {
    const response = await fetch("/api/datasets");
    if (!response.ok) return;
    const payload = (await response.json()) as DatasetListResponse;
    setDatasets(payload.datasets);
  }

  async function handleFile(file: File) {
    let datasetId: string | null = null;

    try {
      if (!isCsvFile(file)) {
        throw new Error("Choose a CSV file.");
      }

      if (file.size > MAX_CSV_BYTES) {
        throw new Error("CSV files can be up to 25MB.");
      }

      setUpload({
        fileName: file.name,
        phase: "uploading",
        progress: 2,
        rowsParsed: 0,
        message: "Checking columns",
      });

      const columns = await parseHeader(file);
      const blobUpload = await createBlobToken(file);
      let blobUrl = blobUpload.mode === "local-dev" ? blobUpload.blobUrl : "";
      let blobPath = blobUpload.pathname;

      if (blobUpload.mode === "local-dev") {
        setUpload((current) =>
          current
            ? {
                ...current,
                progress: 40,
                message: "Local testing mode: skipping Blob storage",
              }
            : current,
        );
      } else {
        const blob = await put(blobUpload.pathname, file, {
          access: "private",
          token: blobUpload.clientToken,
          contentType: file.type || "text/csv",
          multipart: file.size > 8 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => {
            setUpload((current) =>
              current
                ? {
                    ...current,
                    progress: Math.max(5, Math.round(percentage * 0.4)),
                    message: "Uploading CSV",
                  }
                : current,
            );
          },
        });
        blobUrl = blob.url;
        blobPath = blob.pathname;
      }

      const dataset = await createDataset({
        file,
        columns,
        blobUrl,
        blobPath,
      });
      datasetId = dataset.id;
      setDatasets((current) => [dataset, ...current]);

      setUpload({
        fileName: file.name,
        phase: "parsing",
        progress: 45,
        rowsParsed: 0,
        message: "Saving rows",
      });

      const finalDataset = await parseAndPersistRows({
        file,
        columns,
        datasetId: dataset.id,
        onProgress: (rowsParsed) => {
          setUpload((current) =>
            current
              ? {
                  ...current,
                  progress: Math.min(95, 45 + Math.floor(rowsParsed / 250)),
                  rowsParsed,
                  message: "Saving rows",
                }
              : current,
          );
        },
      });

      setDatasets((current) =>
        current.map((item) =>
          item.id === finalDataset.id ? finalDataset : item,
        ),
      );
      setUpload({
        fileName: file.name,
        phase: "ready",
        progress: 100,
        rowsParsed: finalDataset.rowCount,
        message: "Dataset ready",
      });
      await refreshDatasets();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The upload failed.";

      if (datasetId) {
        await markDatasetFailed(datasetId, message);
        await refreshDatasets();
      }

      setUpload({
        fileName: file.name,
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
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload CSV</CardTitle>
          <CardDescription>
            Save a private file and turn its rows into a table you can return
            to later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 p-6 text-center transition-colors",
              isDragging && "border-foreground bg-muted",
            )}
            onDragOver={(event) => {
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
              <p className="text-sm text-muted-foreground">
                Files up to 25MB are uploaded privately.
              </p>
            </div>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <Button type="button" onClick={() => inputRef.current?.click()}>
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
                    {upload.rowsParsed > 0 ? ` · ${upload.rowsParsed} rows` : ""}
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

      {upload?.phase === "failed" ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Upload failed</AlertTitle>
          <AlertDescription>{upload.message}</AlertDescription>
        </Alert>
      ) : null}

      <DatasetsGrid datasets={datasets} />
    </div>
  );
}
