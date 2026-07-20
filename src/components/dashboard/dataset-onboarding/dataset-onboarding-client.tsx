"use client";

import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CopyIcon,
  DatabaseIcon,
  FileSpreadsheetIcon,
  FileUpIcon,
  Loader2Icon,
  LockIcon,
  RefreshCcwIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { GoogleSheetsHeaderSelection } from "@/components/dashboard/google-sheets-header-selection";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  DATASET_PRIVATE_TAG,
  getDatasetTagStyle,
} from "@/lib/dataset-tags";
import type {
  ApiConnectionRun,
  ApiConnectionRunDetailResponse,
  ApiConnectionRunResponse,
  DatasetClassification,
  GoogleSheetsConnectionConnectResponse,
  GoogleSheetsConnectionPreviewResponse,
  GoogleSheetsHeaderPreviewResponse,
  GoogleSheetsHeaderSelectionInput,
} from "@/lib/api-types";
import { cn } from "@/lib/utils";
import {
  createInitialDatasetOnboardingState,
  datasetOnboardingReducer,
  type OnboardingSource,
  type OnboardingStage,
} from "./dataset-onboarding-reducer";
import { parseDatasetCsvHeader, uploadNewDatasetCsv } from "./csv-upload-operation";

type DatasetOnboardingClientProps = {
  serviceAccountEmail: string | null;
  initialSource?: OnboardingSource | null;
};

type ImportResult = {
  key: string;
  name: string;
  connectionId: string | null;
  runId: string | null;
  datasetId: string | null;
  status: "connecting" | "queued" | "importing" | "ready" | "failed";
  error: string | null;
};

const steps: Array<{ stage: OnboardingStage; label: string }> = [
  { stage: "source", label: "Source" },
  { stage: "connect", label: "Connect" },
  { stage: "structure", label: "Structure" },
  { stage: "details", label: "Details" },
  { stage: "review", label: "Review" },
  { stage: "import", label: "Import" },
];

function stepIndex(stage: OnboardingStage) {
  if (stage === "complete") return steps.length - 1;
  return Math.max(0, steps.findIndex((step) => step.stage === stage));
}

async function errorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

function importProgress(status: ImportResult["status"]) {
  return {
    connecting: 10,
    queued: 30,
    importing: 65,
    ready: 100,
    failed: 100,
  }[status];
}

function sourceLabel(source: OnboardingSource | null) {
  return source === "google-sheets" ? "Google Sheet" : "CSV file";
}

export function DatasetOnboardingClient({
  serviceAccountEmail,
  initialSource = null,
}: DatasetOnboardingClientProps) {
  const [state, dispatch] = useReducer(
    datasetOnboardingReducer,
    initialSource,
    createInitialDatasetOnboardingState,
  );
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [headerBusyIds, setHeaderBusyIds] = useState<number[]>([]);
  const [expandedHeaderIds, setExpandedHeaderIds] = useState<number[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [csvProgress, setCsvProgress] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const accessRequestKey = useRef(0);

  useEffect(() => {
    headingRef.current?.focus();
  }, [state.stage]);

  const currentStep = stepIndex(state.stage);
  const selectedSheets = useMemo(
    () =>
      state.preview?.sheets.filter((sheet) =>
        state.selectedSheetIds.includes(sheet.sheetId),
      ) ?? [],
    [state.preview, state.selectedSheetIds],
  );
  const datasetNames =
    state.source === "google-sheets"
      ? state.selectedSheetIds.map((sheetId) => state.datasetNames[sheetId]?.trim() ?? "")
      : [state.csvDatasetName.trim()];
  const hasInvalidNames =
    datasetNames.some((name) => !name) ||
    new Set(datasetNames.map((name) => name.toLocaleLowerCase())).size !==
      datasetNames.length;

  function goBack() {
    setError(null);
    const previousStage = steps[Math.max(0, currentStep - 1)]?.stage ?? "source";
    dispatch({ type: "set-stage", stage: previousStage });
  }

  async function checkAccess(event: FormEvent) {
    event.preventDefault();
    if (!state.spreadsheetUrl.trim() || !serviceAccountEmail) return;

    setIsBusy(true);
    setError(null);
    const requestKey = ++accessRequestKey.current;
    dispatch({ type: "access-started", requestKey });
    try {
      const response = await fetch(
        "/api/admin/api-connections/google-sheets/check-access",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spreadsheetUrl: state.spreadsheetUrl.trim() }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await errorMessage(response, "Google Sheets access could not be checked."),
        );
      }
      const payload = (await response.json()) as GoogleSheetsConnectionPreviewResponse;
      dispatch({ type: "access-succeeded", requestKey, preview: payload.preview });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Access check failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function loadHeaderPreview(
    sheetId: number,
    selection?: GoogleSheetsHeaderSelectionInput,
  ) {
    setHeaderBusyIds((current) => [...new Set([...current, sheetId])]);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/api-connections/google-sheets/header-preview",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spreadsheetUrl: state.preview?.spreadsheetUrl,
            sheetId,
            ...(selection ? { selection } : {}),
          }),
        },
      );
      if (!response.ok) {
        throw new Error(await errorMessage(response, "Headers could not be detected."));
      }
      const payload = (await response.json()) as GoogleSheetsHeaderPreviewResponse;
      const nextSelection = selection ?? {
        sheetId,
        mode: payload.preview.selected.mode,
        startRow: payload.preview.selected.startRow,
        endRow: payload.preview.selected.endRow,
      };
      dispatch({
        type: "header-loaded",
        sheetId,
        preview: payload.preview,
        selection: nextSelection,
      });
      if (payload.preview.selected.confidence !== "high") {
        setExpandedHeaderIds((current) => [...new Set([...current, sheetId])]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Header detection failed.");
    } finally {
      setHeaderBusyIds((current) => current.filter((id) => id !== sheetId));
    }
  }

  function toggleSheet(sheetId: number, title: string) {
    const isSelected = state.selectedSheetIds.includes(sheetId);
    dispatch({
      type: "toggle-sheet",
      sheetId,
      defaultName: `${state.preview?.spreadsheetTitle ?? "Google Sheet"} - ${title}`,
    });
    if (!isSelected) void loadHeaderPreview(sheetId);
  }

  async function chooseCsv(file: File) {
    setIsBusy(true);
    setError(null);
    try {
      const columns = await parseDatasetCsvHeader(file);
      dispatch({
        type: "set-csv",
        file,
        columns,
        datasetName: file.name.replace(/\.csv$/iu, ""),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CSV validation failed.");
    } finally {
      setIsBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function updateResult(key: string, updates: Partial<ImportResult>) {
    setImportResults((current) =>
      current.map((result) =>
        result.key === key ? { ...result, ...updates } : result,
      ),
    );
  }

  async function pollRun(resultKey: string, connectionId: string, run: ApiConnectionRun) {
    let currentRun = run;
    while (currentRun.status === "queued" || currentRun.status === "running") {
      updateResult(resultKey, {
        status: currentRun.status === "queued" ? "queued" : "importing",
      });
      await new Promise((resolve) => setTimeout(resolve, 750));
      const response = await fetch(
        `/api/admin/api-connections/${connectionId}/runs/${currentRun.id}`,
      );
      if (!response.ok) {
        throw new Error(await errorMessage(response, "Import progress could not be loaded."));
      }
      currentRun = ((await response.json()) as ApiConnectionRunDetailResponse).run;
    }
    if (currentRun.status === "success" && currentRun.datasetId) {
      updateResult(resultKey, {
        status: "ready",
        datasetId: currentRun.datasetId,
        runId: currentRun.id,
        error: null,
      });
      return;
    }
    throw new Error(currentRun.errorMessage || "The import failed.");
  }

  async function startImport(result: ImportResult) {
    if (!result.connectionId) return false;
    updateResult(result.key, { status: "queued", error: null });
    try {
      const response = await fetch(
        `/api/admin/api-connections/${result.connectionId}/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ importEnabled: true }),
        },
      );
      if (!response.ok) {
        throw new Error(await errorMessage(response, "The import could not be started."));
      }
      const payload = (await response.json()) as ApiConnectionRunResponse;
      updateResult(result.key, { runId: payload.run.id, status: "queued" });
      await pollRun(result.key, result.connectionId, payload.run);
      return true;
    } catch (caught) {
      updateResult(result.key, {
        status: "failed",
        error: caught instanceof Error ? caught.message : "The import failed.",
      });
      return false;
    }
  }

  async function importGoogleSheets() {
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/api-connections/google-sheets/connect",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spreadsheetUrl: state.preview?.spreadsheetUrl,
            selectedSheetIds: state.selectedSheetIds,
            headerSelections: state.selectedSheetIds.map(
              (sheetId) => state.headerSelections[sheetId],
            ),
            datasetSettings: state.selectedSheetIds.map((sheetId) => ({
              sheetId,
              datasetName: state.datasetNames[sheetId].trim(),
            })),
            datasetClassification: state.classification,
            isWorkspaceVisible: state.isWorkspaceVisible,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(await errorMessage(response, "Sources could not be connected."));
      }
      const connections = ((await response.json()) as GoogleSheetsConnectionConnectResponse)
        .connections;
      const nextResults = connections.map((connection): ImportResult => ({
        key: connection.id,
        name: connection.datasetName,
        connectionId: connection.id,
        runId: null,
        datasetId: connection.targetDatasetId,
        status: "queued",
        error: null,
      }));
      setImportResults(nextResults);
      dispatch({ type: "lock-import" });
      await Promise.all(nextResults.map((result) => startImport(result)));
      dispatch({ type: "complete" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connection failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function importCsv() {
    if (!state.csvFile) return;
    setIsBusy(true);
    setError(null);
    dispatch({ type: "lock-import" });
    const key = "csv-upload";
    setImportResults([
      {
        key,
        name: state.csvDatasetName,
        connectionId: null,
        runId: null,
        datasetId: null,
        status: "importing",
        error: null,
      },
    ]);
    try {
      const dataset = await uploadNewDatasetCsv({
        file: state.csvFile,
        datasetName: state.csvDatasetName.trim(),
        columns: state.csvColumns,
        classification: state.classification,
        isWorkspaceVisible: state.isWorkspaceVisible,
        onProgress: (progress) => setCsvProgress(progress),
      });
      updateResult(key, { status: "ready", datasetId: dataset.id });
    } catch (caught) {
      updateResult(key, {
        status: "failed",
        error: caught instanceof Error ? caught.message : "The upload failed.",
      });
    } finally {
      dispatch({ type: "complete" });
      setIsBusy(false);
    }
  }

  function renderSource() {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          className="rounded-2xl border bg-background p-5 text-left transition-colors hover:border-foreground/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => dispatch({ type: "select-source", source: "google-sheets" })}
        >
          <FileSpreadsheetIcon className="mb-4 size-7" />
          <span className="block text-lg font-semibold">Google Sheet</span>
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">
            Keep the Sheet in Google and refresh the imported dataset later.
          </span>
        </button>
        <button
          type="button"
          className="rounded-2xl border bg-background p-5 text-left transition-colors hover:border-foreground/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => dispatch({ type: "select-source", source: "csv" })}
        >
          <FileUpIcon className="mb-4 size-7" />
          <span className="block text-lg font-semibold">CSV file</span>
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">
            Upload a reviewed snapshot from your computer.
          </span>
        </button>
      </div>
    );
  }

  function renderConnect() {
    if (state.source === "csv") {
      return (
        <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
          <FileUpIcon className="mx-auto mb-3 size-7" />
          <p className="font-medium">Choose a CSV file</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We will review its columns before anything is uploaded. Files up to 25MB.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            data-smoke-upload-input="dataset-onboarding-csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void chooseCsv(file);
            }}
          />
          <Button
            type="button"
            className="mt-5"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            {isBusy ? <Loader2Icon className="animate-spin" /> : <FileUpIcon />}
            Choose CSV
          </Button>
        </div>
      );
    }

    return (
      <form className="space-y-5" onSubmit={checkAccess}>
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">1</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Share the Sheet as Viewer</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                This grants the app read access to the source. It does not decide who
                can see the imported dataset.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 overflow-hidden text-ellipsis rounded-md border bg-background px-3 py-2 text-xs">
                  {serviceAccountEmail ?? "Google Sheets service account is not configured"}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!serviceAccountEmail}
                  onClick={() =>
                    serviceAccountEmail &&
                    navigator.clipboard?.writeText(serviceAccountEmail)
                  }
                >
                  <CopyIcon /> Copy app email
                </Button>
              </div>
            </div>
          </div>
        </div>
        <label className="block space-y-2">
          <span className="flex items-center gap-3 font-medium">
            <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">2</span>
            Paste the Google Sheet link
          </span>
          <input
            aria-label="Google Sheet link"
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={state.spreadsheetUrl}
            onChange={(event) =>
              dispatch({ type: "set-spreadsheet-url", value: event.target.value })
            }
          />
        </label>
        {!serviceAccountEmail ? (
          <Alert variant="destructive">
            <AlertTitle>Google Sheets access is not configured</AlertTitle>
            <AlertDescription>
              Configure the app service account before connecting a Sheet.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!serviceAccountEmail || !state.spreadsheetUrl.trim() || isBusy}
          >
            {isBusy ? <Loader2Icon className="animate-spin" /> : <ShieldCheckIcon />}
            Check access
          </Button>
        </div>
      </form>
    );
  }

  function renderStructure() {
    if (state.source === "csv") {
      return (
        <div className="space-y-5">
          <Alert>
            <CheckCircle2Icon />
            <AlertTitle>{state.csvFile?.name} is ready to review</AlertTitle>
            <AlertDescription>
              Nothing has been uploaded. We found {state.csvColumns.length} columns in
              the first row.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-2">
            {state.csvColumns.slice(0, 12).map((column) => (
              <Badge key={column.key} variant="secondary">{column.label}</Badge>
            ))}
            {state.csvColumns.length > 12 ? (
              <Badge variant="outline">+{state.csvColumns.length - 12} more</Badge>
            ) : null}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => dispatch({ type: "set-stage", stage: "details" })}>
              Review dataset details
            </Button>
          </div>
        </div>
      );
    }

    const structureReady =
      state.selectedSheetIds.length > 0 &&
      headerBusyIds.length === 0 &&
      state.selectedSheetIds.every(
        (sheetId) => state.headerPreviews[sheetId] && state.headerSelections[sheetId],
      );
    return (
      <div className="space-y-5">
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>Access confirmed</AlertTitle>
          <AlertDescription>
            {state.preview?.spreadsheetTitle} is readable. Choose the tabs that should
            become datasets.
          </AlertDescription>
        </Alert>
        <div className="grid gap-2 sm:grid-cols-2">
          {state.preview?.sheets.map((sheet) => (
            <label key={sheet.sheetId} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                aria-label={sheet.title}
                checked={state.selectedSheetIds.includes(sheet.sheetId)}
                data-smoke-trigger="google-sheets-header-selection"
                onChange={() => toggleSheet(sheet.sheetId, sheet.title)}
              />
              <span className="truncate">{sheet.title}</span>
            </label>
          ))}
        </div>
        <div className="space-y-3">
          {selectedSheets.map((sheet) => {
            const preview = state.headerPreviews[sheet.sheetId];
            const selection = state.headerSelections[sheet.sheetId];
            const expanded = expandedHeaderIds.includes(sheet.sheetId);
            if (!preview || !selection) {
              return (
                <div key={sheet.sheetId} className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" /> Detecting headers for {sheet.title}…
                </div>
              );
            }
            return (
              <div key={sheet.sheetId} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{sheet.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Header row {selection.startRow}{selection.endRow > selection.startRow ? `–${selection.endRow}` : ""} · {preview.selected.headers.length} columns
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={preview.selected.confidence === "high" ? "secondary" : "destructive"}>
                      {preview.selected.confidence} confidence
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setExpandedHeaderIds((current) =>
                          expanded
                            ? current.filter((id) => id !== sheet.sheetId)
                            : [...current, sheet.sheetId],
                        )
                      }
                    >
                      {expanded ? "Hide review" : "Review headers"}
                    </Button>
                  </div>
                </div>
                {expanded ? (
                  <GoogleSheetsHeaderSelection
                    preview={preview}
                    selection={selection}
                    isLoading={headerBusyIds.includes(sheet.sheetId)}
                    disabled={isBusy}
                    onChange={(nextSelection) =>
                      void loadHeaderPreview(sheet.sheetId, nextSelection)
                    }
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end">
          <Button
            disabled={!structureReady}
            onClick={() => dispatch({ type: "set-stage", stage: "details" })}
          >
            Review dataset details
          </Button>
        </div>
      </div>
    );
  }

  function renderDetails() {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="font-semibold">Dataset {state.source === "google-sheets" && selectedSheets.length > 1 ? "names" : "name"}</h3>
          {state.source === "google-sheets" ? (
            selectedSheets.map((sheet) => (
              <label key={sheet.sheetId} className="block space-y-1.5 text-sm">
                <span className="font-medium">{sheet.title}</span>
                <input
                  aria-label={`Dataset name for ${sheet.title}`}
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                  value={state.datasetNames[sheet.sheetId] ?? ""}
                  onChange={(event) =>
                    dispatch({ type: "set-dataset-name", sheetId: sheet.sheetId, value: event.target.value })
                  }
                />
              </label>
            ))
          ) : (
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Dataset name</span>
              <input
                aria-label="Dataset name"
                className="h-10 w-full rounded-md border border-input bg-background px-3"
                value={state.csvDatasetName}
                onChange={(event) => dispatch({ type: "set-csv-name", value: event.target.value })}
              />
            </label>
          )}
          {hasInvalidNames ? (
            <p className="text-sm text-destructive">Every dataset needs a unique name.</p>
          ) : null}
        </div>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Dataset classification</span>
          <select
            aria-label="Dataset classification"
            className="h-10 w-full rounded-md border border-input bg-background px-3"
            value={state.classification}
            onChange={(event) =>
              dispatch({ type: "set-classification", value: event.target.value as DatasetClassification })
            }
          >
            <option value="PGAC">PGAC — engagement and activity data</option>
            <option value="PGIC">PGIC — people-group identity data</option>
          </select>
        </label>
        <fieldset className="space-y-3">
          <legend className="font-semibold">Who can see the imported dataset?</legend>
          <label className={cn("flex cursor-pointer gap-3 rounded-xl border p-4", state.isWorkspaceVisible && "border-foreground bg-muted/20")}>
            <input
              type="radio"
              name="dataset-access"
              checked={state.isWorkspaceVisible}
              onChange={() => dispatch({ type: "set-visibility", value: true })}
            />
            <UsersIcon className="size-5 shrink-0" />
            <span><span className="block font-medium">Everyone in the workspace</span><span className="mt-1 block text-sm text-muted-foreground">Authenticated workspace users can browse and download it.</span></span>
          </label>
          <label className={cn("flex cursor-pointer gap-3 rounded-xl border p-4", !state.isWorkspaceVisible && "border-foreground bg-muted/20")}>
            <input
              type="radio"
              name="dataset-access"
              checked={!state.isWorkspaceVisible}
              onChange={() => dispatch({ type: "set-visibility", value: false })}
            />
            <LockIcon className="size-5 shrink-0" />
            <span>
              <span className="flex flex-wrap items-center gap-2 font-medium">
                Only administrators
                {!state.isWorkspaceVisible ? (
                  <Badge
                    variant="outline"
                    style={getDatasetTagStyle(DATASET_PRIVATE_TAG.color)}
                    data-smoke-dataset-private-tag
                  >
                    {DATASET_PRIVATE_TAG.label}
                  </Badge>
                ) : null}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">Hidden from non-admin users. This does not change access to the source Google Sheet.</span>
            </span>
          </label>
        </fieldset>
        <div className="flex justify-end">
          <Button disabled={hasInvalidNames} onClick={() => dispatch({ type: "set-stage", stage: "review" })}>Review import</Button>
        </div>
      </div>
    );
  }

  function renderReview() {
    return (
      <div className="space-y-5">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3"><dt className="text-xs font-semibold uppercase text-muted-foreground">Source</dt><dd className="mt-1 font-medium">{sourceLabel(state.source)}</dd></div>
          <div className="rounded-lg border p-3"><dt className="text-xs font-semibold uppercase text-muted-foreground">Classification</dt><dd className="mt-1 font-medium">{state.classification}</dd></div>
          <div className="rounded-lg border p-3 sm:col-span-2"><dt className="text-xs font-semibold uppercase text-muted-foreground">Datasets</dt><dd className="mt-2 space-y-1">{datasetNames.map((name) => <div key={name} className="font-medium">{name}</div>)}</dd></div>
          <div className="rounded-lg border p-3 sm:col-span-2"><dt className="text-xs font-semibold uppercase text-muted-foreground">Access</dt><dd className="mt-1 font-medium">{state.isWorkspaceVisible ? "Everyone in the workspace" : "Only administrators"}</dd></div>
        </dl>
        <Alert>
          <ShieldCheckIcon />
          <AlertTitle>Ready to import</AlertTitle>
          <AlertDescription>
            {state.source === "google-sheets"
              ? "Accelerate will connect the selected tabs and start their first imports."
              : "The CSV has not been uploaded yet. Upload begins after confirmation."}
          </AlertDescription>
        </Alert>
        <div className="flex justify-end">
          <Button
            disabled={isBusy}
            onClick={() => void (state.source === "google-sheets" ? importGoogleSheets() : importCsv())}
          >
            {isBusy ? <Loader2Icon className="animate-spin" /> : <DatabaseIcon />}
            {state.source === "google-sheets" ? "Connect and import datasets" : "Upload dataset"}
          </Button>
        </div>
      </div>
    );
  }

  function renderImport() {
    return (
      <div className="space-y-4" aria-live="polite">
        {importResults.map((result) => (
          <div key={result.key} className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-medium">{result.name}</p><p className={cn("text-sm capitalize", result.status === "failed" ? "text-destructive" : "text-muted-foreground")}>{result.status === "ready" ? "Ready" : result.status === "failed" ? result.error : result.status}</p></div>
              <div className="flex gap-2">
                {result.status === "ready" && result.datasetId ? <Link href={`/dashboard/datasets/${result.datasetId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Open dataset</Link> : null}
                {result.status === "failed" && result.connectionId ? <Button type="button" variant="outline" size="sm" onClick={() => void startImport(result)}><RefreshCcwIcon /> Retry import</Button> : null}
                {result.connectionId ? <Link href={`/dashboard/api-connections/${result.connectionId}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>Open connection</Link> : null}
              </div>
            </div>
            <Progress value={state.source === "csv" && result.status === "importing" ? csvProgress : importProgress(result.status)} />
          </div>
        ))}
        {state.stage === "complete" ? (
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>Back to dashboard</Link>
            <Button type="button" onClick={() => window.location.assign("/dashboard/datasets/new")}>Add another dataset</Button>
          </div>
        ) : null}
      </div>
    );
  }

  const stageTitle = {
    source: "Choose a source",
    connect: state.source === "csv" ? "Choose your CSV" : "Connect your Google Sheet",
    structure: "Review the structure",
    details: "Name and protect the dataset",
    review: "Confirm the import",
    import: "Importing your dataset",
    complete: "Import complete",
  }[state.stage];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Dataset onboarding progress">
        {steps.map((step, index) => (
          <li key={step.stage} className={cn("rounded-md border px-2 py-2 text-center text-xs", index === currentStep ? "border-foreground bg-foreground font-semibold text-background" : index < currentStep ? "bg-muted text-foreground" : "text-muted-foreground")} aria-current={index === currentStep ? "step" : undefined}>{index + 1}. {step.label}</li>
        ))}
      </ol>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            {state.stage !== "source" && !state.importLocked ? <Button type="button" variant="ghost" size="icon-sm" aria-label="Back" onClick={goBack}><ArrowLeftIcon /></Button> : null}
            <div>
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl font-semibold tracking-[-0.03em]"
              >
                {stageTitle}
              </h2>
              <CardDescription className="mt-1">One clear step at a time. You can review everything before data is created.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {error ? <Alert variant="destructive" role="alert"><AlertTitle>Action needed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
          {state.stage === "source" ? renderSource() : null}
          {state.stage === "connect" ? renderConnect() : null}
          {state.stage === "structure" ? renderStructure() : null}
          {state.stage === "details" ? renderDetails() : null}
          {state.stage === "review" ? renderReview() : null}
          {state.stage === "import" || state.stage === "complete" ? renderImport() : null}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Need to manage an existing integration? <Link href="/dashboard/api-connections" className="underline underline-offset-4">Open Connections</Link>.
      </p>
    </div>
  );
}
