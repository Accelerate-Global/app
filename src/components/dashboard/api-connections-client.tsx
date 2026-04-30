"use client";

import { CableIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";
import { useMemo } from "react";
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
} from "@/lib/api-types";

type ApiConnectionsClientProps = {
  initialConnections: ApiConnection[];
  initialRuns: ApiConnectionRun[];
  initialResources: ApiConnectionResource[];
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

  function openConnection(connectionId: string) {
    router.push(`/dashboard/api-connections/${connectionId}`);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CableIcon className="size-5 text-muted-foreground" />
                Connections
              </CardTitle>
              <CardDescription>
                Open code-managed connections.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
