"use client";

import {
  BookOpenTextIcon,
  CheckCircle2Icon,
  DownloadIcon,
  ExternalLinkIcon,
  Globe2Icon,
  KeyRoundIcon,
  Loader2Icon,
  MapPinnedIcon,
  PlayIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  ApiConnection,
  ApiConnectionHeader,
  ApiConnectionResponse,
  ApiConnectionRun,
  ApiConnectionRunDetailResponse,
  ApiConnectionRunResponse,
  ApiConnectionRunsResponse,
  DatasetClassification,
  DatasetSummary,
} from "@/lib/api-types";
import { DATASET_CLASSIFICATION_OPTIONS } from "@/lib/dataset-tags";
import { cn } from "@/lib/utils";

type ApiConnectionsClientProps = {
  initialConnections: ApiConnection[];
  initialRuns: ApiConnectionRun[];
  datasets: DatasetSummary[];
};

type FormState = Omit<ApiConnection, "id" | "createdAt" | "updatedAt"> & {
  id: string | null;
};

const defaultFormState: FormState = {
  id: null,
  name: "",
  description: "",
  method: "GET",
  url: "",
  headers: [],
  bodyTemplate: "",
  responseFormat: "json",
  responseDataPath: "",
  importMode: "create",
  targetDatasetId: null,
  datasetName: "api-import.csv",
  datasetClassification: "PGAC",
};

const joshuaProjectPgicPreset: FormState = {
  id: null,
  name: "Joshua Project (PGIC)",
  description: "Joshua Project people groups with profile text and resources.",
  method: "GET",
  url: "https://api.joshuaproject.net/v1/people_groups.json?include_profile_text=Y&include_resources=Y&page=1&limit=100000",
  headers: [{ name: "api_key", value: "", isSecret: true }],
  bodyTemplate: "",
  responseFormat: "json",
  responseDataPath: "",
  importMode: "create",
  targetDatasetId: null,
  datasetName: "joshua-project-pgic.csv",
  datasetClassification: "PGIC",
};

const imbPeopleGroupsPreset: FormState = {
  id: null,
  name: "IMB (People Groups)",
  description: "IMB public ArcGIS people groups layer.",
  method: "GET",
  url:
    "https://services1.arcgis.com/mICk7VdFTP86wcbI/arcgis/rest/services/pIMBpeoplePublic/FeatureServer/0/query",
  headers: [],
  bodyTemplate: "",
  responseFormat: "json",
  responseDataPath: "features",
  importMode: "create",
  targetDatasetId: null,
  datasetName: "imb-people-groups.csv",
  datasetClassification: "PGIC",
};

const etnopediaPreset: FormState = {
  id: null,
  name: "Etnopedia",
  description: "Etnopedia MediaWiki people-group export.",
  method: "GET",
  url: "https://en.etnopedia.org/api.php",
  headers: [],
  bodyTemplate: "",
  responseFormat: "json",
  responseDataPath: "",
  importMode: "create",
  targetDatasetId: null,
  datasetName: "etnopedia-people.csv",
  datasetClassification: "PGIC",
};

function cloneFormState(formState: FormState): FormState {
  return {
    ...formState,
    headers: formState.headers.map((header) => ({ ...header })),
  };
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

function toFormState(connection: ApiConnection): FormState {
  return {
    id: connection.id,
    name: connection.name,
    description: connection.description,
    method: connection.method,
    url: connection.url,
    headers: connection.headers,
    bodyTemplate: connection.bodyTemplate,
    responseFormat: connection.responseFormat,
    responseDataPath: connection.responseDataPath,
    importMode: connection.importMode,
    targetDatasetId: connection.targetDatasetId,
    datasetName: connection.datasetName,
    datasetClassification: connection.datasetClassification,
  };
}

function buildPayload(form: FormState) {
  return {
    name: form.name,
    description: form.description,
    method: form.method,
    url: form.url,
    headers: form.headers.filter((header) => header.name.trim()),
    bodyTemplate: form.method === "GET" ? "" : form.bodyTemplate,
    responseFormat: form.responseFormat,
    responseDataPath: form.responseDataPath,
    importMode: form.importMode,
    targetDatasetId: form.importMode === "replace" ? form.targetDatasetId : null,
    datasetName: form.datasetName,
    datasetClassification: form.datasetClassification,
  };
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
  datasets,
}: ApiConnectionsClientProps) {
  const [connections, setConnections] = useState(initialConnections);
  const [runs, setRuns] = useState(initialRuns);
  const [form, setForm] = useState<FormState>(
    initialConnections[0]
      ? toFormState(initialConnections[0])
      : cloneFormState(defaultFormState),
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    title: string;
    detail: string;
    tone: "success" | "error";
  } | null>(null);

  const selectedConnectionId = form.id;
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

  function updateForm(updates: Partial<FormState>) {
    setForm((current) => ({ ...current, ...updates }));
  }

  function updateHeader(index: number, updates: Partial<ApiConnectionHeader>) {
    setForm((current) => ({
      ...current,
      headers: current.headers.map((header, headerIndex) =>
        headerIndex === index ? { ...header, ...updates } : header,
      ),
    }));
  }

  function appendHeader(isSecret = false) {
    setForm((current) => ({
      ...current,
      headers: [...current.headers, { name: "", value: "", isSecret }],
    }));
  }

  function removeHeader(index: number) {
    setForm((current) => ({
      ...current,
      headers: current.headers.filter((_, headerIndex) => headerIndex !== index),
    }));
  }

  function selectConnection(connection: ApiConnection) {
    setForm(toFormState(connection));
    setMessage(null);
  }

  function startNewConnection() {
    setForm(cloneFormState(defaultFormState));
    setMessage(null);
  }

  function applyJoshuaProjectPgicPreset() {
    setForm(cloneFormState(joshuaProjectPgicPreset));
    setMessage(null);
  }

  function applyImbPeopleGroupsPreset() {
    setForm(cloneFormState(imbPeopleGroupsPreset));
    setMessage(null);
  }

  function applyEtnopediaPreset() {
    setForm(cloneFormState(etnopediaPreset));
    setMessage(null);
  }

  async function handleSave() {
    setBusyAction("save");
    setMessage(null);

    try {
      const response = await fetch(
        form.id ? `/api/admin/api-connections/${form.id}` : "/api/admin/api-connections",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(form)),
        },
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "The API connection could not be saved."),
        );
      }

      const payload = (await response.json()) as ApiConnectionResponse;
      setConnections((current) => {
        const existing = current.some(
          (connection) => connection.id === payload.connection.id,
        );
        return existing
          ? current.map((connection) =>
              connection.id === payload.connection.id ? payload.connection : connection,
            )
          : [payload.connection, ...current];
      });
      setForm(toFormState(payload.connection));
      setMessage({
        title: "Connection saved",
        detail: payload.connection.name,
        tone: "success",
      });
    } catch (error) {
      setMessage({
        title: "Save failed",
        detail:
          error instanceof Error
            ? error.message
            : "The API connection could not be saved.",
        tone: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete() {
    if (!form.id) {
      return;
    }

    setBusyAction("delete");
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/api-connections/${form.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "The API connection could not be deleted."),
        );
      }

      const deletedId = form.id;
      setConnections((current) =>
        current.filter((connection) => connection.id !== deletedId),
      );
      setRuns((current) => current.filter((run) => run.connectionId !== deletedId));
      setForm(cloneFormState(defaultFormState));
      setMessage({
        title: "Connection deleted",
        detail: "The saved request was removed.",
        tone: "success",
      });
    } catch (error) {
      setMessage({
        title: "Delete failed",
        detail:
          error instanceof Error
            ? error.message
            : "The API connection could not be deleted.",
        tone: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRun(importEnabled: boolean) {
    if (!form.id) {
      await handleSave();
      return;
    }

    setBusyAction(importEnabled ? "import" : "test");
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/api-connections/${form.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importEnabled }),
      });

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
      upsertRun(payload.run);
      setMessage({
        title: getRunLabel(payload.run),
        detail:
          isRunActive(payload.run)
            ? "The run is processing in the background."
            : payload.run.status === "success"
              ? `${payload.run.durationMs} ms`
              : (payload.run.errorMessage ?? "The run failed."),
        tone:
          payload.run.status === "failed" ? "error" : "success",
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
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Presets</h2>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={applyJoshuaProjectPgicPreset}
          >
            <Globe2Icon className="size-4" />
            Joshua Project (PGIC)
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={applyImbPeopleGroupsPreset}
          >
            <MapPinnedIcon className="size-4" />
            IMB (People Groups)
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={applyEtnopediaPreset}
          >
            <BookOpenTextIcon className="size-4" />
            Etnopedia
          </Button>
        </section>

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Saved requests</h2>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={startNewConnection}
            aria-label="New API connection"
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
        <div className="space-y-2">
          {connections.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                No API connections yet.
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
                  connection.id === form.id && "border-primary bg-accent/50",
                )}
              >
                <span className="block truncate text-sm font-semibold">
                  {connection.name}
                </span>
                <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                  {connection.method} {connection.url}
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
            <CardTitle>Connection</CardTitle>
            <CardDescription>
              {form.id ? "Edit saved request settings." : "Create a saved request."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_8rem]">
              <div className="space-y-2">
                <Label htmlFor="api-connection-name">Name</Label>
                <Input
                  id="api-connection-name"
                  value={form.name}
                  onChange={(event) => updateForm({ name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-connection-method">Method</Label>
                <select
                  id="api-connection-method"
                  value={form.method}
                  onChange={(event) =>
                    updateForm({
                      method: event.target.value as FormState["method"],
                      bodyTemplate:
                        event.target.value === "GET" ? "" : form.bodyTemplate,
                    })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-connection-url">URL</Label>
              <Input
                id="api-connection-url"
                type="url"
                value={form.url}
                onChange={(event) => updateForm({ url: event.target.value })}
                placeholder="https://api.example.com/resources"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-connection-description">Description</Label>
              <Input
                id="api-connection-description"
                value={form.description}
                onChange={(event) => updateForm({ description: event.target.value })}
              />
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Headers</h3>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => appendHeader()}>
                    <PlusIcon className="size-4" />
                    Header
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => appendHeader(true)}
                  >
                    <KeyRoundIcon className="size-4" />
                    Secret
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {form.headers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                    No headers configured.
                  </div>
                ) : (
                  form.headers.map((header, index) => (
                    <div
                      key={`${index}:${header.isSecret ? "secret" : "plain"}`}
                      className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]"
                    >
                      <Input
                        aria-label="Header name"
                        value={header.name}
                        onChange={(event) =>
                          updateHeader(index, { name: event.target.value })
                        }
                        placeholder="Authorization"
                      />
                      <Input
                        aria-label="Header value"
                        type={header.isSecret ? "password" : "text"}
                        value={header.value}
                        onChange={(event) =>
                          updateHeader(index, { value: event.target.value })
                        }
                        placeholder={header.isSecret ? "Stored secret" : "Header value"}
                      />
                      <div className="flex items-center justify-end gap-2">
                        {header.isSecret ? <Badge variant="outline">Secret</Badge> : null}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeHeader(index)}
                          aria-label="Remove header"
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {form.method !== "GET" ? (
              <div className="space-y-2">
                <Label htmlFor="api-connection-body">Body</Label>
                <textarea
                  id="api-connection-body"
                  value={form.bodyTemplate}
                  onChange={(event) => updateForm({ bodyTemplate: event.target.value })}
                  className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Response and import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="api-response-format">Response format</Label>
                <select
                  id="api-response-format"
                  value={form.responseFormat}
                  onChange={(event) =>
                    updateForm({
                      responseFormat:
                        event.target.value as FormState["responseFormat"],
                    })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-response-path">JSON path</Label>
                <Input
                  id="api-response-path"
                  value={form.responseDataPath}
                  disabled={form.responseFormat !== "json"}
                  onChange={(event) =>
                    updateForm({ responseDataPath: event.target.value })
                  }
                  placeholder="data.items"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="api-import-mode">Import mode</Label>
                <select
                  id="api-import-mode"
                  value={form.importMode}
                  onChange={(event) =>
                    updateForm({
                      importMode: event.target.value as FormState["importMode"],
                      targetDatasetId:
                        event.target.value === "replace" ? form.targetDatasetId : null,
                    })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="create">Create dataset</option>
                  <option value="replace">Replace dataset</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-dataset-name">Dataset name</Label>
                <Input
                  id="api-dataset-name"
                  value={form.datasetName}
                  onChange={(event) => updateForm({ datasetName: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-dataset-classification">Classification</Label>
                <select
                  id="api-dataset-classification"
                  value={form.datasetClassification}
                  onChange={(event) =>
                    updateForm({
                      datasetClassification: event.target.value as DatasetClassification,
                    })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {DATASET_CLASSIFICATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {form.importMode === "replace" ? (
              <div className="space-y-2">
                <Label htmlFor="api-target-dataset">Target dataset</Label>
                <select
                  id="api-target-dataset"
                  value={form.targetDatasetId ?? ""}
                  onChange={(event) =>
                    updateForm({ targetDatasetId: event.target.value || null })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Choose a dataset</option>
                  {datasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.fileName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={isBusy} onClick={handleSave}>
                {busyAction === "save" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SaveIcon className="size-4" />
                )}
                Save
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isBusy || !form.id || hasActiveRun}
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
                disabled={isBusy || !form.id || hasActiveRun}
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
              {form.id ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isBusy}
                  onClick={handleDelete}
                >
                  {busyAction === "delete" ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <Trash2Icon className="size-4" />
                  )}
                  Delete
                </Button>
              ) : null}
            </div>
          </CardContent>
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
