"use client";

import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  IsoCountryCodeEntry,
  IsoCountryCodeResource,
} from "@/lib/iso-country-codes";

type IsoCountryCodesClientProps = {
  initialResource: IsoCountryCodeResource;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function filterEntries(entries: IsoCountryCodeEntry[], searchTerm: string) {
  const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();

  if (!normalizedSearchTerm) {
    return entries;
  }

  return entries.filter((entry) =>
    [
      entry.englishShortName,
      entry.alpha2,
      entry.alpha3,
      entry.numeric,
      entry.uri,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedSearchTerm)),
  );
}

function downloadResource(resource: IsoCountryCodeResource) {
  const blob = new Blob([`${JSON.stringify(resource, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "iso-country-codes.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function IsoCountryCodesClient({
  initialResource,
}: IsoCountryCodesClientProps) {
  const [resource, setResource] = useState(initialResource);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const visibleEntries = useMemo(
    () => filterEntries(resource.entries, searchTerm),
    [resource.entries, searchTerm],
  );

  async function copyAlpha3(entry: IsoCountryCodeEntry) {
    await navigator.clipboard.writeText(entry.alpha3);
    setCopiedCode(entry.alpha3);
  }

  async function refreshFromIso() {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const response = await fetch("/api/iso-country-codes/refresh");

      if (!response.ok) {
        throw new Error("Refresh failed.");
      }

      const nextResource = (await response.json()) as IsoCountryCodeResource;
      setResource(nextResource);
    } catch {
      setRefreshError(
        "Could not refresh from ISO. The generated resource is still shown.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl">Country Code Resource</CardTitle>
            <CardDescription>
              {resource.entryCount} official entries refreshed from{" "}
              <a
                href={resource.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                ISO OBP
              </a>{" "}
              on {formatTimestamp(resource.sourceRetrievedAt)}.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={refreshFromIso}
              disabled={isRefreshing}
            >
              <RefreshCwIcon className={isRefreshing ? "animate-spin" : ""} />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadResource(resource)}
            >
              <DownloadIcon />
              JSON
            </Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <label className="relative block">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Search country codes</span>
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, ISO2, ISO3, numeric, or source URI"
              className="h-10 pl-9"
            />
          </label>
          <Badge variant="outline" className="w-fit">
            {visibleEntries.length} visible
          </Badge>
        </div>
        {copiedCode ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckIcon className="size-4" />
            Copied {copiedCode}
          </p>
        ) : null}
        {refreshError ? (
          <p className="text-sm text-destructive">{refreshError}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>ISO2</TableHead>
                <TableHead>ISO3</TableHead>
                <TableHead>Numeric</TableHead>
                <TableHead>Source URI</TableHead>
                <TableHead className="w-20 text-right">Copy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEntries.map((entry) => (
                <TableRow key={entry.alpha2}>
                  <TableCell className="min-w-64 font-medium whitespace-normal">
                    {entry.englishShortName}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{entry.alpha2}</TableCell>
                  <TableCell className="font-mono text-sm font-semibold">
                    {entry.alpha3}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{entry.numeric}</TableCell>
                  <TableCell className="max-w-72 font-mono text-xs whitespace-normal text-muted-foreground break-all">
                    {entry.uri}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Copy ${entry.alpha3}`}
                      onClick={() => void copyAlpha3(entry)}
                    >
                      <CopyIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
