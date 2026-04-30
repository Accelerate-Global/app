"use client";

import { CableIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ApiConnectionRunStatus,
  DatasetClassification,
} from "@/lib/api-types";
import { cn } from "@/lib/utils";

type ApiConnectionsClientProps = {
  initialConnections: ApiConnection[];
  initialRuns: ApiConnectionRun[];
  initialResources: ApiConnectionResource[];
};

type ConnectionStatus = ApiConnectionRunStatus | "idle";

const CLASSIFICATION_FILTER_LABELS: Record<DatasetClassification | "all", string> = {
  all: "All classifications",
  PGAC: "PGAC",
  PGIC: "PGIC",
};

const STATUS_FILTER_LABELS: Record<ConnectionStatus | "all", string> = {
  all: "All statuses",
  idle: "Idle",
  queued: "Queued",
  running: "Running",
  success: "Success",
  failed: "Failed",
};

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

function getConnectionStatus(run: ApiConnectionRun | null): ConnectionStatus {
  return run?.status ?? "idle";
}

function statusBadgeClass(status: ConnectionStatus) {
  if (status === "success") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "queued") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (status === "running") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }

  if (status === "failed") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  return "border-border bg-muted/60 text-muted-foreground";
}

function connectionMatchesSearch(connection: ApiConnection, searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    connection.name,
    connection.description,
    connection.datasetName,
    connection.datasetClassification,
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

export function ApiConnectionsClient({
  initialConnections,
  initialRuns,
  initialResources,
}: ApiConnectionsClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<
    DatasetClassification | "all"
  >("all");
  const [statusFilter, setStatusFilter] = useState<ConnectionStatus | "all">("all");
  const latestRunsByConnection = useMemo(
    () => getLatestRunsByConnection(initialRuns),
    [initialRuns],
  );
  const filteredConnections = useMemo(
    () =>
      initialConnections.filter((connection) => {
        const latestRun = latestRunsByConnection.get(connection.id) ?? null;
        const status = getConnectionStatus(latestRun);

        return (
          connectionMatchesSearch(connection, searchQuery) &&
          (classificationFilter === "all" ||
            connection.datasetClassification === classificationFilter) &&
          (statusFilter === "all" || status === statusFilter)
        );
      }),
    [
      classificationFilter,
      initialConnections,
      latestRunsByConnection,
      searchQuery,
      statusFilter,
    ],
  );

  function openConnection(connectionId: string) {
    router.push(`/dashboard/api-connections/${connectionId}`);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CableIcon className="size-5 text-muted-foreground" />
                Available API Connections
              </CardTitle>
              <CardDescription>
                Search, filter, and open code-managed API connections.
              </CardDescription>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[46rem]">
              <Input
                value={searchQuery}
                placeholder="Search connection, dataset, or classification"
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <Select
                value={classificationFilter}
                onValueChange={(value) =>
                  setClassificationFilter(value as DatasetClassification | "all")
                }
              >
                <SelectTrigger className="w-full justify-between">
                  <SelectValue>
                    {(selectedValue) =>
                      CLASSIFICATION_FILTER_LABELS[
                        (typeof selectedValue === "string"
                          ? selectedValue
                          : "all") as DatasetClassification | "all"
                      ]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">All classifications</SelectItem>
                  <SelectItem value="PGAC">PGAC</SelectItem>
                  <SelectItem value="PGIC">PGIC</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as ConnectionStatus | "all")
                }
              >
                <SelectTrigger className="w-full justify-between">
                  <SelectValue>
                    {(selectedValue) =>
                      STATUS_FILTER_LABELS[
                        (typeof selectedValue === "string"
                          ? selectedValue
                          : "all") as ConnectionStatus | "all"
                      ]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="idle">Idle</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {initialConnections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              No API connections are available.
            </div>
          ) : filteredConnections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              No API connections match the current filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Connection</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Last ingestion</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConnections.map((connection) => {
                  const latestRun =
                    latestRunsByConnection.get(connection.id) ?? null;
                  const status = getConnectionStatus(latestRun);

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
                          <span className="text-muted-foreground">
                            {connection.description || connection.datasetName}
                          </span>
                          <span className="mt-1 font-mono text-xs text-muted-foreground">
                            {connection.datasetName}
                          </span>
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
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("capitalize", statusBadgeClass(status))}
                        >
                          {STATUS_FILTER_LABELS[status]}
                        </Badge>
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
            Referenced documents captured from successful API connection runs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initialResources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              No resources have been captured yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Display text</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="w-24 text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialResources.map((resource) => (
                  <TableRow key={resource.id}>
                    <TableCell className="max-w-48 whitespace-normal">
                      {resource.category || (
                        <span className="text-muted-foreground">Uncategorized</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-normal">
                      {resource.webText || (
                        <span className="text-muted-foreground">
                          No display text
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[34rem] whitespace-normal font-mono text-xs text-muted-foreground break-all">
                      {resource.resourceUrl}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={resource.resourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-end gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        <ExternalLinkIcon className="size-3.5" />
                        Open
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
