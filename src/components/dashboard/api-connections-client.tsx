"use client";

import {
  CableIcon,
  CheckCircle2Icon,
  CopyIcon,
  FileTextIcon,
  Loader2Icon,
  ShieldCheckIcon,
  Table2Icon,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GoogleSheetsHeaderSelection } from "@/components/dashboard/google-sheets-header-selection";
import type {
  ApiConnection,
  ApiConnectionResource,
  ApiConnectionRun,
  DatasetClassification,
  GoogleSheetsConnectionConnectResponse,
  GoogleSheetsConnectionProviderConfig,
  GoogleSheetsConnectionPreview,
  GoogleSheetsConnectionPreviewResponse,
  GoogleSheetsHeaderPreview,
  GoogleSheetsHeaderPreviewResponse,
  GoogleSheetsHeaderSelectionInput,
} from "@/lib/api-types";

type ApiConnectionsClientProps = {
  initialConnections: ApiConnection[];
  initialRuns: ApiConnectionRun[];
  initialResources: ApiConnectionResource[];
  serviceAccountEmail: string | null;
};

type ResponseError = {
  message: string;
  status: number;
};

function isResponseError(error: unknown): error is ResponseError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    "status" in error &&
    typeof (error as ResponseError).message === "string" &&
    typeof (error as ResponseError).status === "number"
  );
}

const builtInResources = [
  {
    id: "iso3-country-codes",
    webText: "Country & territory code resource",
    resourceUrl: "/dashboard/country-codes",
  },
  {
    id: "rop-codes",
    webText: "ROP Codes resource",
    resourceUrl: "/dashboard/rop-codes",
  },
] as const;

function formatTimestamp(value: string | null) {
  if (!value) {
    return "No ingestions yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getLatestRunsByConnection(runs: ApiConnectionRun[]) {
  const latestRuns = new Map<string, ApiConnectionRun>();

  for (const run of runs) {
    const current = latestRuns.get(run.connectionId);

    if (
      !current ||
      new Date(run.createdAt).getTime() > new Date(current.createdAt).getTime()
    ) {
      latestRuns.set(run.connectionId, run);
    }
  }

  return latestRuns;
}

function getCapturedResourceLabel(resource: ApiConnectionResource) {
  return resource.webText || "Captured resource";
}

async function getResponseError(
  response: Response,
  fallback: string,
): Promise<ResponseError> {
  try {
    const payload = (await response.json()) as { error?: string };
    return {
      message: payload.error || fallback,
      status: response.status,
    };
  } catch {
    return {
      message: fallback,
      status: response.status,
    };
  }
}

function getGoogleSheetsProviderConfig(
  connection: ApiConnection,
): GoogleSheetsConnectionProviderConfig | null {
  return connection.provider === "google_sheets" &&
    connection.providerConfig?.provider === "google_sheets"
    ? connection.providerConfig
    : null;
}

function getConnectionSecondaryText(connection: ApiConnection) {
  const googleSheetsConfig = getGoogleSheetsProviderConfig(connection);

  if (googleSheetsConfig) {
    return `Private Google Sheet tab: ${googleSheetsConfig.spreadsheetTitle} / ${googleSheetsConfig.sheetTitle}`;
  }

  return connection.description;
}

export function ApiConnectionsClient({
  initialConnections,
  initialRuns,
  initialResources,
  serviceAccountEmail,
}: ApiConnectionsClientProps) {
  const router = useRouter();
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [preview, setPreview] = useState<GoogleSheetsConnectionPreview | null>(null);
  const [selectedSheetIds, setSelectedSheetIds] = useState<number[]>([]);
  const [headerPreviews, setHeaderPreviews] = useState<
    Record<number, GoogleSheetsHeaderPreview>
  >({});
  const [headerSelections, setHeaderSelections] = useState<
    Record<number, GoogleSheetsHeaderSelectionInput>
  >({});
  const [headerBusySheetIds, setHeaderBusySheetIds] = useState<number[]>([]);
  const [datasetClassification, setDatasetClassification] = useState<DatasetClassification>(
    "PGAC",
  );
  const [busyAction, setBusyAction] = useState<"check" | "connect" | null>(null);
  const [googleSheetsError, setGoogleSheetsError] = useState<ResponseError | null>(null);
  const [appEmailCopied, setAppEmailCopied] = useState(false);
  const latestRunsByConnection = useMemo(
    () => getLatestRunsByConnection(initialRuns),
    [initialRuns],
  );

  function openConnection(connectionId: string) {
    router.push(`/dashboard/api-connections/${connectionId}`);
  }

  function openBuiltInResource(resourceUrl: string) {
    router.push(resourceUrl);
  }

  function openCapturedResource(resourceUrl: string) {
    window.open(resourceUrl, "_blank", "noreferrer");
  }

  async function copyServiceAccountEmail() {
    if (!serviceAccountEmail) {
      return;
    }

    await navigator.clipboard?.writeText(serviceAccountEmail);
    setAppEmailCopied(true);
  }

  function handleResourceRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    openResource: () => void,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openResource();
    }
  }

  async function handleGoogleSheetsCheckAccessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!serviceAccountEmail) {
      return;
    }

    setBusyAction("check");
    setGoogleSheetsError(null);

    try {
      const response = await fetch(
        "/api/admin/api-connections/google-sheets/check-access",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spreadsheetUrl }),
        },
      );

      if (!response.ok) {
        throw await getResponseError(
          response,
          "Google Sheets access could not be checked.",
        );
      }

      const payload = (await response.json()) as GoogleSheetsConnectionPreviewResponse;
      setPreview(payload.preview);
      setSelectedSheetIds([]);
      setHeaderPreviews({});
      setHeaderSelections({});
      setBusyAction(null);
    } catch (error) {
      setGoogleSheetsError(
        isResponseError(error)
          ? error
          : {
              message:
                error instanceof Error
                  ? error.message
                  : "Google Sheets access could not be checked.",
              status: 0,
            },
      );
      setBusyAction(null);
    }
  }

  async function loadHeaderPreview(
    sheetId: number,
    selection?: GoogleSheetsHeaderSelectionInput,
  ) {
    if (!preview) {
      return;
    }
    setHeaderBusySheetIds((current) => [...new Set([...current, sheetId])]);
    setGoogleSheetsError(null);
    try {
      const response = await fetch(
        "/api/admin/api-connections/google-sheets/header-preview",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spreadsheetUrl: preview.spreadsheetUrl,
            sheetId,
            selection,
          }),
        },
      );
      if (!response.ok) {
        throw await getResponseError(
          response,
          "Google Sheets headers could not be detected.",
        );
      }
      const payload = (await response.json()) as GoogleSheetsHeaderPreviewResponse;
      const nextSelection: GoogleSheetsHeaderSelectionInput = selection ?? {
        sheetId,
        mode: "auto",
        startRow: payload.preview.selected.startRow,
        endRow: payload.preview.selected.endRow,
      };
      setHeaderPreviews((current) => ({
        ...current,
        [sheetId]: payload.preview,
      }));
      setHeaderSelections((current) => ({
        ...current,
        [sheetId]: nextSelection,
      }));
    } catch (error) {
      setGoogleSheetsError(
        isResponseError(error)
          ? error
          : {
              message:
                error instanceof Error
                  ? error.message
                  : "Google Sheets headers could not be detected.",
              status: 0,
            },
      );
      setSelectedSheetIds((current) =>
        current.filter((currentSheetId) => currentSheetId !== sheetId),
      );
    } finally {
      setHeaderBusySheetIds((current) =>
        current.filter((currentSheetId) => currentSheetId !== sheetId),
      );
    }
  }

  function toggleSelectedSheet(sheetId: number) {
    if (selectedSheetIds.includes(sheetId)) {
      setSelectedSheetIds((current) =>
        current.filter((currentSheetId) => currentSheetId !== sheetId),
      );
      return;
    }
    setSelectedSheetIds((current) => [...current, sheetId]);
    void loadHeaderPreview(sheetId);
  }

  async function handleConnectGoogleSheets() {
    if (!serviceAccountEmail || !preview || selectedSheetIds.length === 0) {
      return;
    }

    setBusyAction("connect");
    setGoogleSheetsError(null);

    try {
      const response = await fetch(
        "/api/admin/api-connections/google-sheets/connect",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spreadsheetUrl: preview.spreadsheetUrl,
            selectedSheetIds,
            headerSelections: selectedSheetIds.map(
              (sheetId) => headerSelections[sheetId],
            ),
            datasetClassification,
          }),
        },
      );

      if (!response.ok) {
        throw await getResponseError(
          response,
          "Google Sheets connections could not be created.",
        );
      }

      const payload = (await response.json()) as GoogleSheetsConnectionConnectResponse;
      const firstConnection = payload.connections[0];

      router.push(
        firstConnection
          ? `/dashboard/api-connections/${firstConnection.id}`
          : "/dashboard/api-connections",
      );
    } catch (error) {
      setGoogleSheetsError(
        isResponseError(error)
          ? error
          : {
              message:
                error instanceof Error
                  ? error.message
                  : "Google Sheets connections could not be created.",
              status: 0,
            },
      );
      setBusyAction(null);
    }
  }

  const isServiceAccountConfigured = Boolean(serviceAccountEmail);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Table2Icon className="size-5 text-muted-foreground" />
            Add Google Sheet
          </CardTitle>
          <CardDescription>
            Keep your Sheet private. Share it with this app email as Viewer,
            then check access and connect the tabs you need.
          </CardDescription>
        </CardHeader>
        <CardContent
          className="space-y-5"
          data-smoke-google-sheets-service-account
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheckIcon className="size-4 text-muted-foreground" />
                Share with app email
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Keep your Sheet private. Share it with this app email as Viewer.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 overflow-hidden text-ellipsis rounded-md border border-border bg-background px-3 py-2 font-mono text-xs">
                  {serviceAccountEmail ?? "Not configured"}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!serviceAccountEmail}
                  aria-label="Copy app email"
                  onClick={() => void copyServiceAccountEmail()}
                >
                  {appEmailCopied ? (
                    <CheckCircle2Icon className="size-3.5" />
                  ) : (
                    <CopyIcon className="size-3.5" />
                  )}
                  Copy app email
                </Button>
              </div>
            </div>
            <form
              className="space-y-3"
              onSubmit={handleGoogleSheetsCheckAccessSubmit}
              data-smoke-google-sheets-connect
            >
              <div className="space-y-1.5">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="google-sheet-link"
                >
                  Google Sheet link
                </label>
                <input
                  id="google-sheet-link"
                  type="url"
                  value={spreadsheetUrl}
                  onChange={(event) => {
                    setSpreadsheetUrl(event.target.value);
                    setPreview(null);
                    setSelectedSheetIds([]);
                    setHeaderPreviews({});
                    setHeaderSelections({});
                    setGoogleSheetsError(null);
                  }}
                  placeholder="Paste Google Sheet link"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
              <Button
                type="submit"
                variant="secondary"
                disabled={
                  !isServiceAccountConfigured ||
                  busyAction !== null ||
                  !spreadsheetUrl.trim()
                }
              >
                {busyAction === "check" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <ShieldCheckIcon className="size-4" />
                )}
                {busyAction === "check" ? "Checking access" : "Check access"}
              </Button>
            </form>
          </div>

          {!isServiceAccountConfigured ? (
            <Alert variant="destructive">
              <AlertTitle>
                Google Sheets service-account access is not configured
              </AlertTitle>
              <AlertDescription>
                Configure the server-side Google Sheets service-account email and
                private key before connecting Sheets.
              </AlertDescription>
            </Alert>
          ) : null}

          {googleSheetsError ? (
            <Alert variant="destructive">
              <AlertTitle>Google Sheets access failed</AlertTitle>
              <AlertDescription className="space-y-1">
                <span>{googleSheetsError.message}</span>
                {googleSheetsError.status === 403 && serviceAccountEmail ? (
                  <span className="block">
                    Share the Sheet with {serviceAccountEmail} as Viewer, then
                    check access again.
                  </span>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          {preview ? (
            <div
              className="space-y-4 rounded-lg border border-border bg-muted/20 p-4"
              data-smoke-google-sheets-preview
            >
              <Alert>
                <CheckCircle2Icon className="size-4" />
                <AlertTitle>Access confirmed</AlertTitle>
                <AlertDescription>
                  {preview.spreadsheetTitle} is readable by the app service
                  account.
                </AlertDescription>
              </Alert>
              <div className="space-y-1">
                <h3 className="font-medium text-foreground">
                  Choose tabs from {preview.spreadsheetTitle}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Each selected tab becomes one refreshable dataset connection.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {preview.sheets.map((sheet) => (
                  <label
                    key={sheet.sheetId}
                    className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSheetIds.includes(sheet.sheetId)}
                      onChange={() => toggleSelectedSheet(sheet.sheetId)}
                      data-smoke-trigger="google-sheets-header-selection"
                    />
                    <span className="truncate">{sheet.title}</span>
                  </label>
                ))}
              </div>
              {selectedSheetIds.length > 0 ? (
                <div className="space-y-3">
                  {selectedSheetIds.map((sheetId) => (
                    <GoogleSheetsHeaderSelection
                      key={sheetId}
                      preview={headerPreviews[sheetId] ?? null}
                      selection={headerSelections[sheetId] ?? null}
                      isLoading={headerBusySheetIds.includes(sheetId)}
                      disabled={busyAction !== null}
                      onChange={(selection) => {
                        setHeaderSelections((current) => ({
                          ...current,
                          [sheetId]: selection,
                        }));
                        void loadHeaderPreview(sheetId, selection);
                      }}
                    />
                  ))}
                </div>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-foreground">
                    Dataset classification
                  </span>
                  <select
                    value={datasetClassification}
                    onChange={(event) =>
                      setDatasetClassification(
                        event.target.value as DatasetClassification,
                      )
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="PGAC">PGAC</option>
                    <option value="PGIC">PGIC</option>
                  </select>
                </label>
                <Button
                  type="button"
                  disabled={
                    !isServiceAccountConfigured ||
                    busyAction !== null ||
                    selectedSheetIds.length === 0 ||
                    headerBusySheetIds.length > 0 ||
                    selectedSheetIds.some(
                      (sheetId) =>
                        !headerSelections[sheetId] || !headerPreviews[sheetId],
                    )
                  }
                  onClick={handleConnectGoogleSheets}
                >
                  {busyAction === "connect" ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <Table2Icon className="size-4" />
                  )}
                  Connect selected tabs
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <CableIcon className="size-5 text-muted-foreground" />
            Connections
          </CardTitle>
          <CardDescription>
            Open code-managed and Google Sheets connections.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {initialConnections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              No connections are available.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Connection</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Last ingestion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialConnections.map((connection) => {
                  const latestRun =
                    latestRunsByConnection.get(connection.id) ?? null;
                  const secondaryText = getConnectionSecondaryText(connection);

                  return (
                    <TableRow
                      key={connection.id}
                      tabIndex={0}
                      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2"
                      onClick={() => openConnection(connection.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openConnection(connection.id);
                        }
                      }}
                    >
                      <TableCell className="min-w-72 py-3 whitespace-normal">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {connection.name}
                          </span>
                          {secondaryText ? (
                            <span className="text-muted-foreground">
                              {secondaryText}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {connection.datasetClassification}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatTimestamp(latestRun?.createdAt ?? null)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <FileTextIcon className="size-5 text-muted-foreground" />
            Resources
          </CardTitle>
          <CardDescription>
            Built-in references and documents captured from successful API
            connection runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableBody>
              {builtInResources.map((resource) => (
                <TableRow
                  key={resource.id}
                  tabIndex={0}
                  aria-label={`Open ${resource.webText}`}
                  className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2"
                  onClick={() => openBuiltInResource(resource.resourceUrl)}
                  onKeyDown={(event) =>
                    handleResourceRowKeyDown(event, () =>
                      openBuiltInResource(resource.resourceUrl),
                    )
                  }
                >
                  <TableCell className="whitespace-normal font-medium">
                    {resource.webText}
                  </TableCell>
                </TableRow>
              ))}
              {initialResources.map((resource) => {
                const resourceLabel = getCapturedResourceLabel(resource);

                return (
                  <TableRow
                    key={resource.id}
                    tabIndex={0}
                    aria-label={`Open ${resourceLabel}`}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2"
                    onClick={() => openCapturedResource(resource.resourceUrl)}
                    onKeyDown={(event) =>
                      handleResourceRowKeyDown(event, () =>
                        openCapturedResource(resource.resourceUrl),
                      )
                    }
                  >
                    <TableCell className="whitespace-normal font-medium">
                      {resource.webText ? (
                        resource.webText
                      ) : (
                        <span className="text-muted-foreground">
                          {resourceLabel}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {initialResources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              No API-run resources have been captured yet.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
