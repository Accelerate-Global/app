"use client";

import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleDashedIcon,
  ClockIcon,
  DatabaseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileArchiveIcon,
  Loader2Icon,
  PlayIcon,
  RefreshCcwIcon,
  Settings2Icon,
  UploadCloudIcon,
  Wand2Icon,
  XCircleIcon,
} from "lucide-react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { DataGrid, DataGridContainer } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  ApiConnection,
  ApiConnectionRun,
  ApiConnectionRunDetailResponse,
  ApiConnectionRunResponse,
  ApiConnectionRunsResponse,
  ApiConnectionRunStatus,
} from "@/lib/api-types";
import { cn } from "@/lib/utils";

type ApiConnectionDetailClientProps = {
  connection: ApiConnection;
  initialRuns: ApiConnectionRun[];
};

type DetailMessage = {
  title: string;
  detail: string;
  tone: "success" | "error";
};

const pipelineStages = [
  {
    title: "Configure",
    description: "Review endpoint, dataset target, and credentials.",
    icon: Settings2Icon,
  },
  {
    title: "Fetch",
    description: "Request the upstream API response.",
    icon: PlayIcon,
  },
  {
    title: "Normalize",
    description: "Parse rows into the shared dataset shape.",
    icon: Wand2Icon,
  },
  {
    title: "Archive Output",
    description: "Store redacted JSON and CSV artifacts.",
    icon: FileArchiveIcon,
  },
  {
    title: "Import Dataset",
    description: "Create or replace the destination dataset.",
    icon: DatabaseIcon,
  },
];

const INGESTION_HISTORY_VISIBLE_ROW_LIMIT = 5;
const INGESTION_HISTORY_SCROLL_AREA_HEIGHT = "h-[268px]";

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(run: ApiConnectionRun) {
  if (run.status === "queued") {
    return "Queued";
  }

  if (run.status === "running") {
    return "In progress";
  }

  if (run.durationMs >= 1000) {
    return `${(run.durationMs / 1000).toFixed(1)} s`;
  }

  return `${run.durationMs} ms`;
}

function getRunLabel(run: ApiConnectionRun) {
  const mode = run.mode === "import" ? "Import" : "Test";

  if (run.status === "queued") {
    return `${mode} queued`;
  }

  if (run.status === "running") {
    return `${mode} running`;
  }

  return `${mode} ${run.status === "success" ? "passed" : "failed"}`;
}

function getModeLabel(run: ApiConnectionRun) {
  return run.mode === "import" ? "Import" : "Test";
}

function statusBadgeClass(status: ApiConnectionRunStatus) {
  if (status === "success") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "queued") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (status === "running") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }

  return "border-destructive/30 bg-destructive/10 text-destructive";
}

function isRunActive(run: ApiConnectionRun) {
  return run.status === "queued" || run.status === "running";
}

function sortRuns(runs: ApiConnectionRun[]) {
  return [...runs].sort(
    (first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  );
}

function mergeRun(current: ApiConnectionRun[], next: ApiConnectionRun) {
  return sortRuns([next, ...current.filter((run) => run.id !== next.id)]);
}

function mergeRuns(current: ApiConnectionRun[], nextRuns: ApiConnectionRun[]) {
  const byId = new Map(current.map((run) => [run.id, run]));

  for (const run of nextRuns) {
    byId.set(run.id, run);
  }

  return sortRuns([...byId.values()]);
}

function getRunDownloadUrl(run: ApiConnectionRun, format: "json" | "csv") {
  return `/api/admin/api-connections/${run.connectionId}/runs/${run.id}/download?format=${format}`;
}

function RunDownloadLinks({
  run,
  size = "sm",
}: {
  run: ApiConnectionRun;
  size?: "xs" | "sm";
}) {
  if (!run.output) {
    return null;
  }

  const className =
    size === "xs"
      ? cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 px-2 text-xs")
      : buttonVariants({ variant: "outline", size: "sm" });

  return (
    <div className="flex flex-wrap gap-2">
      <a href={getRunDownloadUrl(run, "json")} className={className}>
        <DownloadIcon className="size-3.5" />
        JSON
      </a>
      <a href={getRunDownloadUrl(run, "csv")} className={className}>
        <DownloadIcon className="size-3.5" />
        CSV
      </a>
    </div>
  );
}

function ArtifactCell({ run }: { run: ApiConnectionRun }) {
  if (!run.output && !run.datasetId) {
    return <span className="text-muted-foreground">None</span>;
  }

  return (
    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
      {run.output ? (
        <>
          <a
            href={getRunDownloadUrl(run, "json")}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 px-2 text-xs")}
          >
            JSON
          </a>
          <a
            href={getRunDownloadUrl(run, "csv")}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 px-2 text-xs")}
          >
            CSV
          </a>
        </>
      ) : null}
      {run.datasetId ? (
        <a
          href={`/dashboard/datasets/${run.datasetId}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 px-2 text-xs")}
        >
          Dataset
        </a>
      ) : null}
    </div>
  );
}

function DetailEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
      No ingestion selected.
    </div>
  );
}

function CollapsibleRunCard({
  title,
  description,
  contentId,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description: string;
  contentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const titleId = `${contentId}-title`;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle id={titleId} className="text-2xl">
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={() => onOpenChange(!open)}
          >
            <ChevronDownIcon
              aria-hidden="true"
              className={cn("size-3.5 transition-transform", open ? "rotate-180" : "")}
            />
            {open ? "Collapse" : "Expand"} {title}
          </Button>
        </div>
      </CardHeader>
      {open ? (
        <CardContent id={contentId} aria-labelledby={titleId}>
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function ApiConnectionDetailClient({
  connection,
  initialRuns,
}: ApiConnectionDetailClientProps) {
  const [runs, setRuns] = useState(() => sortRuns(initialRuns));
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    initialRuns[0]?.id ?? null,
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(
    initialRuns[0] ? { [initialRuns[0].id]: true } : {},
  );
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "createdAt",
      desc: true,
    },
  ]);
  const [busyAction, setBusyAction] = useState<"test" | "import" | "refresh" | null>(
    null,
  );
  const [message, setMessage] = useState<DetailMessage | null>(null);
  const [isRunDetailOpen, setIsRunDetailOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  );
  const latestRun = runs[0] ?? null;
  const hasActiveRun = runs.some(isRunActive);

  const selectRun = useCallback((run: ApiConnectionRun) => {
    setSelectedRunId(run.id);
    setRowSelection({ [run.id]: true });
  }, []);

  const upsertRun = useCallback(
    (run: ApiConnectionRun) => {
      setRuns((current) => mergeRun(current, run));
      selectRun(run);
    },
    [selectRun],
  );

  const loadRuns = useCallback(async () => {
    const response = await fetch(
      `/api/admin/api-connections/${connection.id}/runs`,
    );

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, "API connection runs could not be loaded."),
      );
    }

    const payload = (await response.json()) as ApiConnectionRunsResponse;
    setRuns((current) => mergeRuns(current, payload.runs ?? []));
  }, [connection.id]);

  useEffect(() => {
    if (!selectedRun || !isRunActive(selectedRun)) {
      return;
    }

    let cancelled = false;
    const activeRunId = selectedRun.id;

    async function refreshRun() {
      const response = await fetch(
        `/api/admin/api-connections/${connection.id}/runs/${activeRunId}`,
      );

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as ApiConnectionRunDetailResponse;

      if (cancelled) {
        return;
      }

      setRuns((current) => mergeRun(current, payload.run));

      if (!isRunActive(payload.run)) {
        void loadRuns().catch(() => undefined);
      }
    }

    const interval = window.setInterval(() => {
      void refreshRun();
    }, 1500);
    void refreshRun();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [connection.id, loadRuns, selectedRun]);

  async function handleRun(importEnabled: boolean) {
    setBusyAction(importEnabled ? "import" : "test");
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/api-connections/${connection.id}/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ importEnabled }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "The API connection could not run."),
        );
      }

      const payload = (await response.json()) as ApiConnectionRunResponse;
      upsertRun(payload.run);
      setMessage({
        title: getRunLabel(payload.run),
        detail:
          isRunActive(payload.run)
            ? "The run is processing in the background."
            : payload.run.status === "success"
              ? formatDuration(payload.run)
              : (payload.run.errorMessage ?? "The run failed."),
        tone: payload.run.status === "failed" ? "error" : "success",
      });
    } catch (error) {
      setMessage({
        title: importEnabled ? "Ingestion failed" : "Test failed",
        detail:
          error instanceof Error ? error.message : "The API connection could not run.",
        tone: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRefresh() {
    setBusyAction("refresh");
    setMessage(null);

    try {
      await loadRuns();
    } catch (error) {
      setMessage({
        title: "Run history failed",
        detail:
          error instanceof Error
            ? error.message
            : "API connection runs could not be loaded.",
        tone: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  const columns = useMemo<ColumnDef<ApiConnectionRun>[]>(
    () => [
      {
        id: "createdAt",
        accessorFn: (run) => new Date(run.createdAt).getTime(),
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Initiated At"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {formatTimestamp(row.original.createdAt)}
          </span>
        ),
        meta: { headerTitle: "Initiated At" },
        size: 190,
        enableSorting: true,
        enableHiding: false,
      },
      {
        id: "mode",
        accessorFn: (run) => run.mode,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Mode"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => getModeLabel(row.original),
        meta: { headerTitle: "Mode" },
        size: 110,
        enableSorting: true,
      },
      {
        id: "status",
        accessorFn: (run) => run.status,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Status"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn("capitalize", statusBadgeClass(row.original.status))}
          >
            {row.original.status}
          </Badge>
        ),
        meta: { headerTitle: "Status" },
        size: 120,
        enableSorting: true,
      },
      {
        id: "startedAt",
        accessorFn: (run) =>
          run.startedAt ? new Date(run.startedAt).getTime() : 0,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Started At"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {formatTimestamp(row.original.startedAt)}
          </span>
        ),
        meta: { headerTitle: "Started At" },
        size: 190,
        enableSorting: true,
      },
      {
        id: "completedAt",
        accessorFn: (run) =>
          run.completedAt ? new Date(run.completedAt).getTime() : 0,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Completed At"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {formatTimestamp(row.original.completedAt)}
          </span>
        ),
        meta: { headerTitle: "Completed At" },
        size: 190,
        enableSorting: true,
      },
      {
        id: "durationMs",
        accessorFn: (run) => run.durationMs,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Duration"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{formatDuration(row.original)}</span>
        ),
        meta: { headerTitle: "Duration" },
        size: 120,
        enableSorting: true,
      },
      {
        id: "rowCount",
        accessorFn: (run) => run.rowCount ?? -1,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Rows"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.rowCount ?? "Not parsed"}
          </span>
        ),
        meta: { headerTitle: "Rows" },
        size: 110,
        enableSorting: true,
      },
      {
        id: "httpStatus",
        accessorFn: (run) => run.httpStatus ?? -1,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="HTTP"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.httpStatus ? `HTTP ${row.original.httpStatus}` : "None"}
          </span>
        ),
        meta: { headerTitle: "HTTP" },
        size: 110,
        enableSorting: true,
      },
      {
        id: "actorEmail",
        accessorFn: (run) => run.actorEmail ?? run.actorOwnerId,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Actor"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.actorEmail ?? row.original.actorOwnerId}
          </span>
        ),
        meta: { headerTitle: "Actor" },
        size: 220,
        enableSorting: true,
      },
      {
        id: "artifacts",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Artifacts"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => <ArtifactCell run={row.original} />,
        meta: { headerTitle: "Artifacts" },
        size: 210,
        enableSorting: false,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: runs,
    columns,
    getRowId: (row) => row.id,
    state: {
      rowSelection,
      sorting,
    },
    initialState: {
      columnPinning: {
        left: ["createdAt"],
      },
    },
    columnResizeMode: "onChange",
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const historyScrollAreaClassName =
    runs.length > INGESTION_HISTORY_VISIBLE_ROW_LIMIT
      ? INGESTION_HISTORY_SCROLL_AREA_HEIGHT
      : undefined;

  return (
    <div className="space-y-6">
      {message ? (
        <Alert variant={message.tone === "error" ? "destructive" : "default"}>
          {message.tone === "error" ? (
            <XCircleIcon className="size-4" />
          ) : (
            <CheckCircle2Icon className="size-4" />
          )}
          <AlertTitle>{message.title}</AlertTitle>
          <AlertDescription>{message.detail}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CircleDashedIcon className="size-5 text-muted-foreground" />
                Pipeline
              </CardTitle>
              <CardDescription>
                Stage controls are visible as the target pipeline shape. In v1,
                run operations use the existing test and import actions.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busyAction !== null || hasActiveRun}
                onClick={() => handleRun(false)}
                data-smoke-api-connection-test
              >
                {busyAction === "test" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <PlayIcon className="size-4" />
                )}
                Run test
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busyAction !== null || hasActiveRun}
                onClick={() => handleRun(true)}
                data-smoke-api-connection-import
              >
                {busyAction === "import" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <UploadCloudIcon className="size-4" />
                )}
                Start ingestion
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busyAction !== null}
                onClick={handleRefresh}
              >
                {busyAction === "refresh" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <RefreshCcwIcon className="size-4" />
                )}
                Refresh history
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            {pipelineStages.map((stage) => {
              const StageIcon = stage.icon;

              return (
                <div
                  key={stage.title}
                  className="flex min-h-44 flex-col justify-between gap-4 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-background ring-1 ring-border">
                        <StageIcon className="size-4 text-muted-foreground" />
                      </span>
                      <Badge variant="outline" className="bg-background text-muted-foreground">
                        Skeleton
                      </Badge>
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{stage.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {stage.description}
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled>
                    <ClockIcon className="size-3.5" />
                    Coming soon
                  </Button>
                </div>
              );
            })}
          </div>
          {latestRun ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge
                variant="outline"
                className={cn("capitalize", statusBadgeClass(latestRun.status))}
              >
                {getRunLabel(latestRun)}
              </Badge>
              <span className="font-mono text-xs">
                Last initiated {formatTimestamp(latestRun.createdAt)}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <CollapsibleRunCard
        title="Run Detail"
        description="Select an ingestion row to inspect logs, output, preview, and errors."
        contentId="api-connection-run-detail-panel"
        open={isRunDetailOpen}
        onOpenChange={setIsRunDetailOpen}
      >
          {!selectedRun ? (
            <DetailEmptyState />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("capitalize", statusBadgeClass(selectedRun.status))}
                  >
                    {getRunLabel(selectedRun)}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {selectedRun.httpStatus
                      ? `HTTP ${selectedRun.httpStatus}`
                      : "No HTTP status"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatDuration(selectedRun)}
                  </span>
                  {selectedRun.rowCount !== null ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {selectedRun.rowCount} rows
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <RunDownloadLinks run={selectedRun} />
                  {selectedRun.datasetId ? (
                    <a
                      href={`/dashboard/datasets/${selectedRun.datasetId}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <ExternalLinkIcon className="size-3.5" />
                      Imported dataset
                    </a>
                  ) : null}
                </div>
              </div>

              {selectedRun.errorMessage ? (
                <Alert variant="destructive">
                  <XCircleIcon className="size-4" />
                  <AlertTitle>Run error</AlertTitle>
                  <AlertDescription>{selectedRun.errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  Logs
                </h3>
                {selectedRun.logs && selectedRun.logs.length > 0 ? (
                  <div className="max-h-48 space-y-1 overflow-auto">
                    {selectedRun.logs.map((log) => (
                      <div
                        key={log.id}
                        className={cn(
                          "grid gap-2 font-mono text-xs md:grid-cols-[9rem_minmax(0,1fr)]",
                          log.level === "error"
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        <span>{formatTimestamp(log.createdAt)}</span>
                        <span>{log.message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No logs recorded.</p>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  Preview
                </h3>
                <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-5">
                  {selectedRun.responsePreview || "No preview available."}
                </pre>
              </div>
            </div>
          )}
      </CollapsibleRunCard>

      <CollapsibleRunCard
        title="Ingestion History"
        description={`Initiated test and import runs for ${connection.name}.`}
        contentId="api-connection-ingestion-history-panel"
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
      >
        <DataGrid
          table={table}
          recordCount={runs.length}
          emptyMessage="No ingestions have been initiated yet."
          onRowClick={selectRun}
          tableLayout={{
            columnsPinnable: true,
            columnsResizable: true,
            headerSticky: true,
            rowBorder: true,
          }}
          tableClassNames={{
            headerSticky: "sticky top-0 z-10 bg-muted/90 backdrop-blur-xs",
            bodyRow: "h-11 [&>td]:align-top [&>td]:py-2.5",
          }}
        >
          <DataGridContainer>
            <DataGridScrollArea className={historyScrollAreaClassName}>
              <DataGridTable />
            </DataGridScrollArea>
          </DataGridContainer>
        </DataGrid>
      </CollapsibleRunCard>
    </div>
  );
}
