"use client";

import { BookOpenIcon, DatabaseIcon } from "lucide-react";
import { useMemo, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
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
  GoogleSheetsConnectionProviderConfig,
} from "@/lib/api-types";
import { formatUtcTimestamp } from "@/lib/date-time";
import { getReferenceResourceRoutePath } from "@/lib/reference-resources/routes";
import type { ReferenceResourceCatalogItem } from "@/lib/reference-resources/types";

type ApiConnectionsClientProps = {
  initialConnections: ApiConnection[];
  initialRuns: ApiConnectionRun[];
  capturedResources: ApiConnectionResource[];
  referenceResources: ReferenceResourceCatalogItem[];
};

function formatEntryCount(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-US").format(value);
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

function getGoogleSheetsProviderConfig(
  connection: ApiConnection,
): GoogleSheetsConnectionProviderConfig | null {
  return connection.provider === "google_sheets" &&
    connection.providerConfig?.provider === "google_sheets"
    ? connection.providerConfig
    : null;
}

function getConnectionSecondaryText(connection: ApiConnection) {
  const config = getGoogleSheetsProviderConfig(connection);
  return config
    ? `Google Sheet source: ${config.spreadsheetTitle} / ${config.sheetTitle}`
    : connection.description;
}

export function ApiConnectionsClient({
  initialConnections,
  initialRuns,
  capturedResources,
  referenceResources,
}: ApiConnectionsClientProps) {
  const router = useRouter();
  const latestRunsByConnection = useMemo(
    () => getLatestRunsByConnection(initialRuns),
    [initialRuns],
  );
  const connectionNamesById = useMemo(
    () => new Map(initialConnections.map((connection) => [connection.id, connection.name])),
    [initialConnections],
  );

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    action: () => void,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <DatabaseIcon className="size-5 text-muted-foreground" />
              Datasets
            </CardTitle>
            <CardDescription>
              Open Google Sheets and code-managed integrations to refresh data or
              review diagnostics.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {initialConnections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              No datasets are connected.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Last ingestion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialConnections.map((connection) => (
                  <TableRow
                    key={connection.id}
                    tabIndex={0}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2"
                    onClick={() =>
                      router.push(`/dashboard/api-connections/${connection.id}`)
                    }
                    onKeyDown={(event) =>
                      handleRowKeyDown(event, () =>
                        router.push(`/dashboard/api-connections/${connection.id}`),
                      )
                    }
                  >
                    <TableCell className="min-w-72 py-3 whitespace-normal">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {connection.name}
                        </span>
                        <span className="text-muted-foreground">
                          {getConnectionSecondaryText(connection)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {connection.datasetClassification}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatUtcTimestamp(
                        latestRunsByConnection.get(connection.id)?.createdAt ?? null,
                        "No ingestions yet",
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(referenceResources.length > 0 || capturedResources.length > 0) ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <BookOpenIcon className="size-5 text-muted-foreground" />
              Resources
            </CardTitle>
            <CardDescription>
              Active built-in references and resources captured during source ingestion.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Last updated</TableHead>
                  <TableHead>Impact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referenceResources.map((resource) => (
                  <TableRow
                    key={resource.id}
                    tabIndex={0}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2"
                    onClick={() =>
                      router.push(
                        getReferenceResourceRoutePath(resource.resourceKey),
                      )
                    }
                    onKeyDown={(event) =>
                      handleRowKeyDown(event, () =>
                        router.push(
                          getReferenceResourceRoutePath(resource.resourceKey),
                        ),
                      )
                    }
                  >
                    <TableCell className="min-w-72 py-3 whitespace-normal">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {resource.label}
                        </span>
                        <span className="text-muted-foreground">
                          {resource.description}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatEntryCount(resource.activeVersion?.entryCount ?? null)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {formatUtcTimestamp(
                        resource.activeVersion?.sourceRetrievedAt ?? null,
                        "Not available",
                      )}
                    </TableCell>
                    <TableCell className="min-w-64 text-xs text-muted-foreground">
                      <span>{resource.impact.affectedEngines.join(", ")}</span>
                      {resource.impact.olderOutputCount > 0 ? (
                        <span className="block">
                          {resource.impact.olderOutputCount.toLocaleString()} recent {resource.impact.olderOutputCount === 1 ? "output uses" : "outputs use"} an older version
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
                {capturedResources.map((resource) => (
                  <TableRow key={resource.id}>
                    <TableCell className="min-w-72 py-3 whitespace-normal">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {resource.webText.trim() || "Captured source resource"}
                        </span>
                        <span className="text-muted-foreground">
                          {connectionNamesById.has(resource.connectionId)
                            ? `Captured during ${connectionNamesById.get(resource.connectionId)} ingestion`
                            : "Captured during source ingestion"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatEntryCount(null)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {formatUtcTimestamp(resource.createdAt, "Not available")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      Captured evidence
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

    </div>
  );
}
