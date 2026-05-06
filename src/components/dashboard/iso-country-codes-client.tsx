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
  CountryCodeClassification,
  IsoCountryCodeEntry,
  IsoCountryCodeResource,
} from "@/lib/iso-country-codes";

type IsoCountryCodesClientProps = {
  initialResource: IsoCountryCodeResource;
};

const classificationLabels: Record<CountryCodeClassification, string> = {
  "csv-only": "CSV only",
  "duplicate-iso-territory": "Duplicate ISO territory",
  "genc-supported": "GENC supported",
  "iso-official": "ISO official",
  "legacy-fips-only": "Legacy FIPS only",
  "non-official-code": "Non-official code",
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCode(value: string | null) {
  return value ?? "Not listed";
}

function getPrimaryCopyCode(entry: IsoCountryCodeEntry) {
  return entry.primaryAlpha3 ?? entry.gencAlpha3;
}

function filterEntries(entries: IsoCountryCodeEntry[], searchTerm: string) {
  const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();

  if (!normalizedSearchTerm) {
    return entries;
  }

  return entries.filter((entry) =>
    [
      entry.displayName,
      entry.active ? "active" : "inactive",
      entry.primaryAlpha3,
      entry.officialIsoAlpha2,
      entry.officialIsoAlpha3,
      entry.officialIsoNumeric,
      entry.gencAlpha2,
      entry.gencAlpha3,
      entry.gencNumeric,
      entry.fips,
      entry.classification,
      classificationLabels[entry.classification],
      entry.sourceUri,
      ...entry.alternativeNames,
    ].some((value) =>
      (value ?? "").toLocaleLowerCase().includes(normalizedSearchTerm),
    ),
  );
}

function downloadResource(resource: IsoCountryCodeResource) {
  const blob = new Blob([`${JSON.stringify(resource, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "country-territory-codes.json";
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

  async function copyCode(value: string, label = value) {
    await navigator.clipboard.writeText(value);
    setCopiedCode(label);
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
        "Could not refresh country and territory codes. The generated resource is still shown.",
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
            <CardTitle className="text-2xl">Country & Territory Codes</CardTitle>
            <CardDescription>
              {resource.entryCount} curated rows ({resource.activeCount} active)
              enriched with {resource.officialIsoCount} official ISO entries from{" "}
              <a
                href={resource.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                ISO OBP
              </a>
              ,{" "}
              <a
                href={resource.gencAboutUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                GENC
              </a>
              , and{" "}
              <a
                href={resource.fipsSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                legacy FIPS
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
            <span className="sr-only">Search country and territory codes</span>
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, alias, ISO3, FIPS, GENC, status, or classification"
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
                <TableHead>Country/Territory</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>ISO3</TableHead>
                <TableHead>FIPS</TableHead>
                <TableHead>GENC3</TableHead>
                <TableHead>ISO2</TableHead>
                <TableHead>Numeric</TableHead>
                <TableHead>Alternative Names</TableHead>
                <TableHead>Classification</TableHead>
                <TableHead className="w-32 text-right">Copy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEntries.map((entry) => {
                const primaryCopyCode = getPrimaryCopyCode(entry);

                return (
                  <TableRow
                    key={`${entry.displayName}:${entry.primaryAlpha3 ?? "none"}`}
                  >
                    <TableCell className="min-w-64 font-medium whitespace-normal">
                      {entry.displayName}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.active ? "secondary" : "outline"}>
                        {entry.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold">
                      {formatCode(entry.primaryAlpha3)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCode(entry.fips)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCode(entry.gencAlpha3)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCode(entry.officialIsoAlpha2)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCode(entry.officialIsoNumeric ?? entry.gencNumeric)}
                    </TableCell>
                    <TableCell className="max-w-96 whitespace-normal text-sm text-muted-foreground">
                      {entry.alternativeNames.length > 0
                        ? entry.alternativeNames.join(", ")
                        : "None"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {classificationLabels[entry.classification]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {primaryCopyCode ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Copy ${primaryCopyCode}`}
                            onClick={() => void copyCode(primaryCopyCode)}
                          >
                            <CopyIcon />
                          </Button>
                        ) : null}
                        {entry.fips ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Copy FIPS ${entry.fips}`}
                            onClick={() =>
                              void copyCode(entry.fips!, `FIPS ${entry.fips}`)
                            }
                          >
                            <CopyIcon />
                            FIPS
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
