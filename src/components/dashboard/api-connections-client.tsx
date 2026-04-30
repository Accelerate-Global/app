"use client";

import {
  CheckCircle2Icon,
  DownloadIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PlayIcon,
  UploadCloudIcon,
  XCircleIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
} from "@/lib/api-types";
import { cn } from "@/lib/utils";

type ApiConnectionsClientProps = {
  initialConnections: ApiConnection[];
  initialRuns: ApiConnectionRun[];
};

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

function statusBadgeClass(status: ApiConnectionRun["status"]) {
  if (status === "success") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
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

function RunDownloadLinks({ run }: { run: ApiConnectionRun }) {
  if (!run.output) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={getRunDownloadUrl(run, "json")}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <DownloadIcon className="size-3.5" />
        JSON
      </a>
      <a
        href={getRunDownloadUrl(run, "csv")}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <DownloadIcon className="size-3.5" />
        CSV
      </a>
    </div>
  );
}

export function ApiConnectionsClient({
  initialConnections,
  initialRuns,
}: ApiConnectionsClientProps) {
  const [connections, setConnections] = useState(initialConnections);
  const [runs, setRuns] = useState(initialRuns);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(
    initialConnections[0]?.id ?? null,
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    title: string;
    detail: string;
    tone: "success" | "error";
  } | null>(null);

  const selectedConnection = useMemo(
    () =>
      selectedConnectionId
        ? (connections.find((connection) => connection.id === selectedConnectionId) ??
          null)
        : null,
    [connections, selectedConnectionId],
  );
  const selectedRuns = useMemo(
    () =>
      selectedConnectionId
        ? runs.filter((run) => run.connectionId === selectedConnectionId)
        : [],
    [runs, selectedConnectionId],
  );
  const latestRun = selectedRuns[0] ?? null;
  const isBusy = busyAction !== null;
  const hasActiveRun = selectedRuns.some(isRunActive);

  const upsertRun = useCallback((run: ApiConnectionRun) => {
    setRuns((current) => mergeRun(current, run));
  }, []);

  const loadConnectionRuns = useCallback(async (connectionId: string) => {
    const response = await fetch(
      `/api/admin/api-connections/${connectionId}/runs`,
    );

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, "API connection runs could not be loaded."),
      );
    }

    const payload = (await response.json()) as ApiConnectionRunsResponse;
    setRuns((current) => mergeRuns(current, payload.runs ?? []));
  }, []);

  useEffect(() => {
    if (!selectedConnectionId) {
      return;
    }

    void loadConnectionRuns(selectedConnectionId).catch((error) => {
      setMessage({
        title: "Run history failed",
        detail:
          error instanceof Error
            ? error.message
            : "API connection runs could not be loaded.",
        tone: "error",
      });
    });
  }, [loadConnectionRuns, selectedConnectionId]);

  useEffect(() => {
    if (!selectedConnectionId || !latestRun || !isRunActive(latestRun)) {
      return;
    }

    let cancelled = false;

    async function refreshRun() {
      const response = await fetch(
        `/api/admin/api-connections/${selectedConnectionId}/runs/${latestRun.id}`,
      );

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as ApiConnectionRunDetailResponse;

      if (!cancelled) {
        upsertRun(payload.run);
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
  }, [latestRun, selectedConnectionId, upsertRun]);

  function selectConnection(connection: ApiConnection) {
    setSelectedConnectionId(connection.id);
    setMessage(null);
  }

  async function handleRun(importEnabled: boolean) {
    if (!selectedConnection) {
      return;
    }

    setBusyAction(importEnabled ? "import" : "test");
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/api-connections/${selectedConnection.id}/run`,
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
      setConnections((current) =>
        current.map((connection) =>
          connection.id === payload.connection.id ? payload.connection : connection,
        ),
      );
      setSelectedConnectionId(payload.connection.id);
      upsertRun(payload.run);
      setMessage({
        title: getRunLabel(payload.run),
        detail:
          isRunActive(payload.run)
            ? "The run is processing in the background."
            : payload.run.status === "success"
              ? `${payload.run.durationMs} ms`
              : (payload.run.errorMessage ?? "The run failed."),
        tone: payload.run.status === "failed" ? "error" : "success",
      });
    } catch (error) {
      setMessage({
        title: importEnabled ? "Import failed" : "Test failed",
        detail:
          error instanceof Error ? error.message : "The API connection could not run.",
        tone: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <aside className="space-y-4">
        <h2 className="text-lg font-semibold">Saved connections</h2>
        <div className="space-y-2">
          {connections.length === 0 ? (
            <Card>
              <CardContent className="space-y-2 py-6 text-sm text-muted-foreground">
                <p>No API connections are available.</p>
                <p>Add saved connections from the codebase to run them here.</p>
              </CardContent>
            </Card>
          ) : (
            connections.map((connection) => (
              <button
                key={connection.id}
                type="button"
                onClick={() => selectConnection(connection)}
                className={cn(
                  "w-full rounded-lg border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-accent/35",
                  connection.id === selectedConnectionId &&
                    "border-primary bg-accent/50",
                )}
              >
                <span className="block truncate text-sm font-semibold">
                  {connection.name}
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {connection.description || "Code-managed connection"}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

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
          <CardHeader>
            <CardTitle>
              {selectedConnection ? selectedConnection.name : "No connection selected"}
            </CardTitle>
            <CardDescription>
              {selectedConnection
                ? selectedConnection.description || "Code-managed connection"
                : "Add saved connections from the codebase to run them here."}
            </CardDescription>
          </CardHeader>
          {selectedConnection ? (
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isBusy || hasActiveRun}
                  onClick={() => handleRun(false)}
                  data-smoke-api-connection-test
                >
                  {busyAction === "test" ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <PlayIcon className="size-4" />
                  )}
                  Test
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isBusy || hasActiveRun}
                  onClick={() => handleRun(true)}
                  data-smoke-api-connection-import
                >
                  {busyAction === "import" ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <UploadCloudIcon className="size-4" />
                  )}
                  Import
                </Button>
              </div>
            </CardContent>
          ) : null}
        </Card>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Latest output</CardTitle>
            </CardHeader>
            <CardContent>
              {!latestRun ? (
                <p className="text-sm text-muted-foreground">No runs yet.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={statusBadgeClass(latestRun.status)}>
                        {getRunLabel(latestRun)}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        {latestRun.httpStatus
                          ? `HTTP ${latestRun.httpStatus}`
                          : "No HTTP status"}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {latestRun.durationMs} ms
                      </span>
                      {latestRun.rowCount !== null ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {latestRun.rowCount} rows
                        </span>
                      ) : null}
                    </div>
                    <RunDownloadLinks run={latestRun} />
                  </div>
                  {latestRun.errorMessage ? (
                    <p className="text-sm text-destructive">{latestRun.errorMessage}</p>
                  ) : null}
                  {latestRun.datasetId ? (
                    <a
                      href={`/dashboard/datasets/${latestRun.datasetId}`}
                      className={cn(
                        buttonVariants({ variant: "link", size: "sm" }),
                        "h-auto px-0 text-xs",
                      )}
                    >
                      <ExternalLinkIcon className="size-3.5" />
                      Imported dataset
                    </a>
                  ) : null}
                  {latestRun.logs && latestRun.logs.length > 0 ? (
                    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                      <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                        Logs
                      </h3>
                      <div className="max-h-36 space-y-1 overflow-auto">
                        {latestRun.logs.map((log) => (
                          <div
                            key={log.id}
                            className={cn(
                              "grid gap-2 font-mono text-xs md:grid-cols-[8.5rem_minmax(0,1fr)]",
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
                    </div>
                  ) : null}
                  <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-5">
                    {latestRun.responsePreview || "No preview available."}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent runs</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No run history.</p>
              ) : (
                <div className="space-y-3">
                  {selectedRuns.slice(0, 8).map((run) => (
                    <div
                      key={run.id}
                      className="rounded-lg border border-border px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge className={statusBadgeClass(run.status)}>
                          {getRunLabel(run)}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatTimestamp(run.createdAt)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 font-mono text-xs text-muted-foreground">
                        <span>{run.durationMs} ms</span>
                        {run.httpStatus ? <span>HTTP {run.httpStatus}</span> : null}
                        {run.rowCount !== null ? <span>{run.rowCount} rows</span> : null}
                        {run.output ? <span>output archived</span> : null}
                      </div>
                      <div className="mt-3">
                        <RunDownloadLinks run={run} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
