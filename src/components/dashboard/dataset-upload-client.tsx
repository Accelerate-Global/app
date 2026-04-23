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
  DatasetClassification,
  DatasetSummary,
  DatasetUploadAuthorizationResponse,
} from "@/lib/api-types";
import {
  buildAnalyticsContext,
  type AnalyticsWorkspaceRole,
  type DatasetUploadFailureStage,
  withAnalyticsContext,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DATASET_CLASSIFICATION_OPTIONS,
  getDatasetClassification,
  getDatasetTagStyle,
  hasExactDatasetClassificationTag,
} from "@/lib/dataset-tags";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type DatasetUploadClientProps = {
  targetDataset?: DatasetSummary | null;
  preferredClassification?: DatasetClassification | null;
  actorOwnerId?: string;
  workspaceRole?: AnalyticsWorkspaceRole;
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
  classification: DatasetClassification;
}) {
  const response = await fetch("/api/datasets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: input.file.name,
      blobPath: input.blobPath,
      sizeBytes: input.file.size,
      columns: input.columns,
      classification: input.classification,
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
  classification: DatasetClassification;
}) {
  const response = await fetch(`/api/datasets/${input.datasetId}/replace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blobPath: input.blobPath,
      sizeBytes: input.file.size,
      columns: input.columns,
      classification: input.classification,
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

function DatasetClassificationSelect({
  value,
  disabled,
  onChange,
}: {
  value: DatasetClassification | null;
  disabled: boolean;
  onChange: (value: DatasetClassification) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="dataset-classification">Dataset classification</Label>
      <Select
        value={value ?? undefined}
        onValueChange={(nextValue) => {
          if (nextValue === "PGAC" || nextValue === "PGIC") {
            onChange(nextValue);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger
          id="dataset-classification"
          aria-label="Dataset classification"
          data-smoke-dataset-classification
        >
          <SelectValue placeholder="Select PGAC or PGIC" />
        </SelectTrigger>
        <SelectContent>
          {DATASET_CLASSIFICATION_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span
                className="inline-block size-2.5 rounded-full border border-border"
                style={getDatasetTagStyle(option.color)}
              />
              <span>{option.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function DatasetUploadClient({
  targetDataset = null,
  preferredClassification = null,
  actorOwnerId = "anonymous",
  workspaceRole = "anonymous",
}: DatasetUploadClientProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [completedDataset, setCompletedDataset] = useState<DatasetSummary | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const sourceDatasetClassification =
    targetDataset &&
    targetDataset.backingDatasetId === null &&
    hasExactDatasetClassificationTag(targetDataset.tags)
      ? getDatasetClassification(targetDataset.tags)
      : null;
  const [classification, setClassification] = useState<DatasetClassification | null>(
    () => sourceDatasetClassification ?? preferredClassification,
  );
  const isReplacing = targetDataset !== null;
  const isBusy =
    upload?.phase === "uploading" || upload?.phase === "parsing";
  const isClassificationLocked = sourceDatasetClassification !== null;
  const isReadyForFileSelection = isClassificationLocked || classification !== null;
  const analyticsContext = buildAnalyticsContext({
    route: "upload",
    actorOwnerId,
    workspaceRole,
  });
  const classificationHelpText = isReplacing
    ? targetDataset.backingDatasetId
      ? preferredClassification
        ? "Replacing this derived view creates a new source dataset. The classification is prefilled from its current backing dataset and can be changed here."
        : "Replacing this derived view creates a new source dataset. Choose PGAC or PGIC before uploading."
      : isClassificationLocked
        ? `This source dataset keeps its current ${sourceDatasetClassification} classification during replacement.`
        : "Choose PGAC or PGIC before replacing this dataset."
    : "Choose PGAC or PGIC before uploading a new source dataset.";

  async function handleFile(file: File) {
    let datasetId: string | null = null;
    let columnCount: number | undefined;
    let rowsParsed = 0;
    let failureStage: DatasetUploadFailureStage = "validation";
    const uploadFileName = isReplacing ? targetDataset.fileName : file.name;
    const startTime = Date.now();

    trackAppEvent(
      "dataset_upload_started",
      withAnalyticsContext(analyticsContext, {
        source_surface: "dataset_upload",
        success: true,
        file_size_bytes: file.size,
        replace_target_dataset_id: targetDataset?.id,
      }),
    );

    try {
      if (!classification) {
        setCompletedDataset(null);
        setUpload({
          fileName: uploadFileName,
          phase: "failed",
          progress: 0,
          rowsParsed: 0,
          message: "Choose PGAC or PGIC before uploading a dataset.",
        });
        return;
      }

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

      failureStage = "header_parse";
      const columns = await parseHeader(file);
      columnCount = columns.length;
      failureStage = "authorize";
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

      failureStage = isReplacing ? "dataset_replace" : "dataset_create";
      const nextDataset = isReplacing
        ? await replaceDatasetRecord({
            datasetId: targetDataset.id,
            file,
            columns,
            blobPath: uploadAuthorization.path,
            classification,
          })
        : await createDatasetRecord({
            file,
            columns,
            blobPath: uploadAuthorization.path,
            classification,
          });

      datasetId = nextDataset.id;
      failureStage = "row_persist";

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
        onProgress: (nextRowsParsed) => {
          rowsParsed = nextRowsParsed;
          setUpload((current) =>
            current
              ? {
                  ...current,
                  progress: Math.min(95, 45 + Math.floor(nextRowsParsed / 250)),
                  rowsParsed: nextRowsParsed,
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
      if (isReplacing) {
        trackAppEvent(
          "dataset_replaced",
          withAnalyticsContext(analyticsContext, {
            source_surface: "dataset_upload",
            success: true,
            dataset_id: finalDataset.id,
            replace_target_dataset_id: targetDataset.id,
            file_size_bytes: file.size,
            column_count: columnCount ?? finalDataset.columns.length,
            row_count: finalDataset.rowCount,
            duration_ms: Date.now() - startTime,
          }),
        );
      } else {
        trackAppEvent(
          "dataset_upload_completed",
          withAnalyticsContext(analyticsContext, {
            source_surface: "dataset_upload",
            success: true,
            dataset_id: finalDataset.id,
            file_size_bytes: file.size,
            column_count: columnCount ?? finalDataset.columns.length,
            row_count: finalDataset.rowCount,
            duration_ms: Date.now() - startTime,
          }),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isReplacing
            ? "The dataset replacement failed."
            : "The upload failed.";

      if (datasetId) {
        failureStage = "mark_failed";
        await markDatasetFailed(datasetId, message);
      }

      trackAppEvent(
        "dataset_upload_failed",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_upload",
          success: false,
          error_code:
            !isCsvFile(file)
              ? "invalid_file_type"
              : file.size > MAX_CSV_BYTES
                ? "file_too_large"
                : `${failureStage}_failed`,
          duration_ms: Date.now() - startTime,
          dataset_id: datasetId ?? targetDataset?.id,
          file_size_bytes: file.size,
          column_count: columnCount,
          row_count: rowsParsed || undefined,
          replace_target_dataset_id: targetDataset?.id,
          failure_stage: failureStage,
        }),
      );

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
    if (isBusy || !isReadyForFileSelection) {
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
          <div className="mb-4 space-y-2">
            <DatasetClassificationSelect
              value={classification}
              disabled={isBusy || isClassificationLocked}
              onChange={(nextClassification) => {
                setClassification(nextClassification);
                if (
                  upload?.phase === "failed" &&
                  upload.message === "Choose PGAC or PGIC before uploading a dataset."
                ) {
                  setUpload(null);
                }
              }}
            />
            <p className="text-sm text-muted-foreground">{classificationHelpText}</p>
          </div>
          <div
            className={cn(
              "flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 p-6 text-center transition-colors",
              !isReadyForFileSelection && "cursor-not-allowed opacity-60",
              !isBusy && isDragging && "border-foreground bg-muted",
            )}
            onDragOver={(event) => {
              if (isBusy || !isReadyForFileSelection) {
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
              disabled={isBusy || !isReadyForFileSelection}
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
