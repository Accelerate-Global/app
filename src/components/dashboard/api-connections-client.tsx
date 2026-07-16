"use client";

import { CableIcon, FileTextIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
  if (!value) return "No ingestions yet";

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
  initialResources,
}: ApiConnectionsClientProps) {
  const router = useRouter();
  const latestRunsByConnection = useMemo(
    () => getLatestRunsByConnection(initialRuns),
    [initialRuns],
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
              <CableIcon className="size-5 text-muted-foreground" />
              Connected sources
            </CardTitle>
            <CardDescription>
              Open Google Sheets and code-managed integrations to refresh data or
              review diagnostics.
            </CardDescription>
          </div>
          <Link
            href="/dashboard/datasets/new"
            className={buttonVariants({ size: "sm" })}
          >
            <PlusIcon className="size-4" />
            Add dataset
          </Link>
        </CardHeader>
        <CardContent>
          {initialConnections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              No data sources are connected yet. Add a dataset to connect a Google
              Sheet or upload a CSV.
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
                      {formatTimestamp(
                        latestRunsByConnection.get(connection.id)?.createdAt ?? null,
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileTextIcon className="size-5 text-muted-foreground" />
            Reference resources
          </CardTitle>
          <CardDescription>
            Built-in references and documents captured from successful source runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableBody>
              {[...builtInResources, ...initialResources].map((resource) => {
                const isBuiltIn = "id" in resource &&
                  builtInResources.some((item) => item.id === resource.id);
                const label = resource.webText || "Captured resource";
                const url = resource.resourceUrl;
                return (
                  <TableRow
                    key={resource.id}
                    tabIndex={0}
                    aria-label={`Open ${label}`}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2"
                    onClick={() =>
                      isBuiltIn
                        ? router.push(url)
                        : window.open(url, "_blank", "noreferrer")
                    }
                    onKeyDown={(event) =>
                      handleRowKeyDown(event, () =>
                        isBuiltIn
                          ? router.push(url)
                          : window.open(url, "_blank", "noreferrer"),
                      )
                    }
                  >
                    <TableCell className="whitespace-normal font-medium">
                      {label}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {initialResources.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              No captured source resources yet.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
