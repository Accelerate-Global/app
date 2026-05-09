"use client";

import { CableIcon, FileTextIcon, Loader2Icon, Table2Icon } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
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
import type {
  ApiConnection,
  ApiConnectionResource,
  ApiConnectionRun,
  GoogleSheetsConnectionConfirmResponse,
  GoogleSheetsConnectionDraft,
  GoogleSheetsConnectionDraftResponse,
  GoogleSheetsOAuthStartResponse,
} from "@/lib/api-types";

type ApiConnectionsClientProps = {
  initialConnections: ApiConnection[];
  initialRuns: ApiConnectionRun[];
  initialResources: ApiConnectionResource[];
};

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

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

export function ApiConnectionsClient({
  initialConnections,
  initialRuns,
  initialResources,
}: ApiConnectionsClientProps) {
  const router = useRouter();
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [draft, setDraft] = useState<GoogleSheetsConnectionDraft | null>(null);
  const [selectedSheetIds, setSelectedSheetIds] = useState<number[]>([]);
  const [datasetClassification, setDatasetClassification] = useState<"PGAC" | "PGIC">(
    "PGAC",
  );
  const [busyAction, setBusyAction] = useState<
    "oauth" | "draft" | "confirm" | null
  >(null);
  const [googleSheetsError, setGoogleSheetsError] = useState<string | null>(null);
  const latestRunsByConnection = useMemo(
    () => getLatestRunsByConnection(initialRuns),
    [initialRuns],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const draftId = params.get("googleSheetDraft");
    const oauthError = params.get("googleSheetError");

    if (oauthError) {
      setGoogleSheetsError("Could not connect Google Sheets. Try again.");
    }

    if (!draftId) {
      return;
    }

    let cancelled = false;

    async function loadDraft() {
      setBusyAction("draft");
      setGoogleSheetsError(null);

      try {
        const response = await fetch(
          `/api/admin/api-connections/google-sheets/drafts/${draftId}`,
        );

        if (!response.ok) {
          throw new Error(
            await getErrorMessage(
              response,
              "Google Sheets connection draft could not be loaded.",
            ),
          );
        }

        const payload = (await response.json()) as GoogleSheetsConnectionDraftResponse;

        if (!cancelled) {
          setDraft(payload.draft);
          setSelectedSheetIds([]);
        }
      } catch (error) {
        if (!cancelled) {
          setGoogleSheetsError(
            error instanceof Error
              ? error.message
              : "Google Sheets connection draft could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setBusyAction(null);
        }
      }
    }

    void loadDraft();

    return () => {
      cancelled = true;
    };
  }, []);

  function openConnection(connectionId: string) {
    router.push(`/dashboard/api-connections/${connectionId}`);
  }

  function openBuiltInResource(resourceUrl: string) {
    router.push(resourceUrl);
  }

  function openCapturedResource(resourceUrl: string) {
    window.open(resourceUrl, "_blank", "noreferrer");
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

  async function handleGoogleSheetsOAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("oauth");
    setGoogleSheetsError(null);

    try {
      const response = await fetch(
        "/api/admin/api-connections/google-sheets/oauth/start",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spreadsheetUrl }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "Google Sheets connection could not start."),
        );
      }

      const payload = (await response.json()) as GoogleSheetsOAuthStartResponse;
      window.location.assign(payload.authorizationUrl);
    } catch (error) {
      setGoogleSheetsError(
        error instanceof Error
          ? error.message
          : "Google Sheets connection could not start.",
      );
      setBusyAction(null);
    }
  }

  function toggleSelectedSheet(sheetId: number) {
    setSelectedSheetIds((current) =>
      current.includes(sheetId)
        ? current.filter((currentSheetId) => currentSheetId !== sheetId)
        : [...current, sheetId],
    );
  }

  async function handleConfirmGoogleSheetsDraft() {
    if (!draft || selectedSheetIds.length === 0) {
      return;
    }

    setBusyAction("confirm");
    setGoogleSheetsError(null);

    try {
      const response = await fetch(
        `/api/admin/api-connections/google-sheets/drafts/${draft.id}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedSheetIds,
            datasetClassification,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
            "Google Sheets connections could not be created.",
          ),
        );
      }

      const payload = (await response.json()) as GoogleSheetsConnectionConfirmResponse;
      const firstConnection = payload.connections[0];

      router.push(
        firstConnection
          ? `/dashboard/api-connections/${firstConnection.id}`
          : "/dashboard/api-connections",
      );
    } catch (error) {
      setGoogleSheetsError(
        error instanceof Error
          ? error.message
          : "Google Sheets connections could not be created.",
      );
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      {googleSheetsError ? (
        <Alert variant="destructive">
          <AlertTitle>Google Sheets connection failed</AlertTitle>
          <AlertDescription>{googleSheetsError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CableIcon className="size-5 text-muted-foreground" />
                Connections
              </CardTitle>
              <CardDescription>
                Open code-managed and Google Sheets connections.
              </CardDescription>
            </div>
            <form
              className="flex w-full max-w-xl flex-col gap-2 sm:flex-row"
              onSubmit={handleGoogleSheetsOAuthSubmit}
              data-smoke-google-sheets-connect
            >
              <label className="sr-only" htmlFor="google-sheet-link">
                Google Sheet link
              </label>
              <input
                id="google-sheet-link"
                type="url"
                value={spreadsheetUrl}
                onChange={(event) => setSpreadsheetUrl(event.target.value)}
                placeholder="Paste private Google Sheet link"
                className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={busyAction !== null || !spreadsheetUrl.trim()}
              >
                {busyAction === "oauth" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <Table2Icon className="size-4" />
                )}
                Add Google Sheet
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {busyAction === "draft" ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading Google Sheet tabs.
            </div>
          ) : null}

          {draft ? (
            <div
              className="space-y-4 rounded-lg border border-border bg-muted/20 p-4"
              data-smoke-google-sheets-draft
            >
              <div className="space-y-1">
                <h3 className="font-medium text-foreground">
                  Select tabs from {draft.spreadsheetTitle}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Each selected tab becomes one refreshable dataset connection.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {draft.sheets.map((sheet) => (
                  <label
                    key={sheet.sheetId}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSheetIds.includes(sheet.sheetId)}
                      onChange={() => toggleSelectedSheet(sheet.sheetId)}
                    />
                    <span className="truncate">{sheet.title}</span>
                  </label>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-foreground">Dataset classification</span>
                  <select
                    value={datasetClassification}
                    onChange={(event) =>
                      setDatasetClassification(event.target.value as "PGAC" | "PGIC")
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="PGAC">PGAC</option>
                    <option value="PGIC">PGIC</option>
                  </select>
                </label>
                <Button
                  type="button"
                  disabled={busyAction !== null || selectedSheetIds.length === 0}
                  onClick={handleConfirmGoogleSheetsDraft}
                >
                  {busyAction === "confirm" ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <Table2Icon className="size-4" />
                  )}
                  Create connections
                </Button>
              </div>
            </div>
          ) : null}

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
                          {connection.description ? (
                            <span className="text-muted-foreground">
                              {connection.description}
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
