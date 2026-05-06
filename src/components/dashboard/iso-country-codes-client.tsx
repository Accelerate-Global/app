"use client";

import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";
import {
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
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
  canRefresh: boolean;
};

type RefreshProgress = {
  phase: "running" | "ready" | "failed";
  progress: number;
  message: string;
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

function getEntryKey(entry: IsoCountryCodeEntry) {
  return [
    entry.displayName,
    entry.primaryAlpha3 ?? "",
    entry.gencAlpha3 ?? "",
    entry.fips ?? "",
    entry.sourceUri ?? "",
  ].join(":");
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

const csvColumns = [
  ["Country/Territory", (entry: IsoCountryCodeEntry) => entry.displayName],
  ["Status", (entry: IsoCountryCodeEntry) => (entry.active ? "Active" : "Inactive")],
  ["ISO3", (entry: IsoCountryCodeEntry) => entry.primaryAlpha3],
  ["ISO2", (entry: IsoCountryCodeEntry) => entry.officialIsoAlpha2],
  ["Numeric", (entry: IsoCountryCodeEntry) => entry.officialIsoNumeric],
  ["FIPS", (entry: IsoCountryCodeEntry) => entry.fips],
  ["GENC3", (entry: IsoCountryCodeEntry) => entry.gencAlpha3],
  ["GENC2", (entry: IsoCountryCodeEntry) => entry.gencAlpha2],
  ["GENC numeric", (entry: IsoCountryCodeEntry) => entry.gencNumeric],
  [
    "Classification",
    (entry: IsoCountryCodeEntry) => classificationLabels[entry.classification],
  ],
  [
    "Alternative names",
    (entry: IsoCountryCodeEntry) => entry.alternativeNames.join("; "),
  ],
  ["Source URI", (entry: IsoCountryCodeEntry) => entry.sourceUri],
] as const;

function escapeCsvValue(value: string | null) {
  const text = value ?? "";

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function buildCsv(entries: IsoCountryCodeEntry[]) {
  const header = csvColumns.map(([label]) => escapeCsvValue(label)).join(",");
  const rows = entries.map((entry) =>
    csvColumns
      .map(([, getValue]) => escapeCsvValue(getValue(entry)))
      .join(","),
  );

  return `${[header, ...rows].join("\n")}\n`;
}

function downloadResource(entries: IsoCountryCodeEntry[]) {
  const blob = new Blob([buildCsv(entries)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "country-territory-codes.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function DetailValue({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={
          mono
            ? "font-mono text-sm text-foreground"
            : "text-sm text-foreground"
        }
      >
        {children}
      </p>
    </div>
  );
}

type CountryCodeDetailSheetProps = {
  entry: IsoCountryCodeEntry | null;
  resource: IsoCountryCodeResource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopyCode: (value: string, label?: string) => void;
  onActiveChange: (entry: IsoCountryCodeEntry, active: boolean) => void;
  onAddAlternativeName: (entry: IsoCountryCodeEntry, value: string) => void;
};

function CountryCodeDetailSheet({
  entry,
  resource,
  open,
  onOpenChange,
  onCopyCode,
  onActiveChange,
  onAddAlternativeName,
}: CountryCodeDetailSheetProps) {
  const [aliasInput, setAliasInput] = useState("");
  const primaryCopyCode = entry ? getPrimaryCopyCode(entry) : null;
  const summaryCodes = entry
    ? [primaryCopyCode, entry.fips ? `FIPS ${entry.fips}` : null, entry.gencAlpha3]
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
    : [];

  function handleAddAlias(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!entry) {
      return;
    }

    onAddAlternativeName(entry, aliasInput);
    setAliasInput("");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-xl"
        data-smoke-surface="country-code-detail-sheet"
        data-smoke-ready={entry ? "country-code-detail-sheet" : undefined}
      >
        {entry ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border px-6 py-5">
              <SheetTitle>{entry.displayName}</SheetTitle>
              <SheetDescription>{summaryCodes.join(" / ")}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
              <section className="space-y-3 rounded-lg border border-border bg-card px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Status</p>
                    <Badge variant={entry.active ? "secondary" : "outline"}>
                      {entry.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <Switch
                    checked={entry.active}
                    aria-label={`Set ${entry.displayName} active status`}
                    onCheckedChange={(checked) => onActiveChange(entry, checked)}
                  />
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-border bg-card px-4 py-4">
                <p className="text-sm font-medium text-foreground">Codes</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailValue label="Primary ISO3" mono>
                    {formatCode(entry.primaryAlpha3)}
                  </DetailValue>
                  <DetailValue label="FIPS" mono>
                    {formatCode(entry.fips)}
                  </DetailValue>
                  <DetailValue label="GENC3" mono>
                    {formatCode(entry.gencAlpha3)}
                  </DetailValue>
                  <DetailValue label="GENC2" mono>
                    {formatCode(entry.gencAlpha2)}
                  </DetailValue>
                  <DetailValue label="ISO2" mono>
                    {formatCode(entry.officialIsoAlpha2)}
                  </DetailValue>
                  <DetailValue label="Official ISO3" mono>
                    {formatCode(entry.officialIsoAlpha3)}
                  </DetailValue>
                  <DetailValue label="Numeric" mono>
                    {formatCode(entry.officialIsoNumeric ?? entry.gencNumeric)}
                  </DetailValue>
                  <DetailValue label="GENC numeric" mono>
                    {formatCode(entry.gencNumeric)}
                  </DetailValue>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {primaryCopyCode ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onCopyCode(primaryCopyCode)}
                      aria-label={`Copy primary code ${primaryCopyCode}`}
                    >
                      <CopyIcon />
                      Primary {primaryCopyCode}
                    </Button>
                  ) : null}
                  {entry.fips ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onCopyCode(entry.fips!, `FIPS ${entry.fips}`)}
                      aria-label={`Copy FIPS ${entry.fips}`}
                    >
                      <CopyIcon />
                      FIPS {entry.fips}
                    </Button>
                  ) : null}
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-border bg-card px-4 py-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Alternative Names
                  </p>
                  {entry.alternativeNames.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {entry.alternativeNames.map((name) => (
                        <li key={name}>
                          <Badge variant="outline">{name}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">None</p>
                  )}
                </div>
                <form className="flex gap-2" onSubmit={handleAddAlias}>
                  <label className="sr-only" htmlFor="country-code-alias">
                    Alternative name
                  </label>
                  <Input
                    id="country-code-alias"
                    value={aliasInput}
                    onChange={(event) => setAliasInput(event.target.value)}
                    placeholder="Add alternative name"
                  />
                  <Button type="submit" disabled={!aliasInput.trim()}>
                    <PlusIcon />
                    Add
                  </Button>
                </form>
              </section>

              <section className="space-y-4 rounded-lg border border-border bg-card px-4 py-4">
                <p className="text-sm font-medium text-foreground">Resource Details</p>
                <div className="grid gap-4">
                  <DetailValue label="Classification">
                    {classificationLabels[entry.classification]}
                  </DetailValue>
                  <DetailValue label="Source URI" mono>
                    {formatCode(entry.sourceUri)}
                  </DetailValue>
                  <DetailValue label="Resource source">
                    {resource.sourceName}
                  </DetailValue>
                  <DetailValue label="Retrieved">
                    {formatTimestamp(resource.sourceRetrievedAt)}
                  </DetailValue>
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function IsoCountryCodesClient({
  initialResource,
  canRefresh,
}: IsoCountryCodesClientProps) {
  const [resource, setResource] = useState(initialResource);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<RefreshProgress | null>(
    null,
  );
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);
  const visibleEntries = useMemo(
    () => filterEntries(resource.entries, searchTerm),
    [resource.entries, searchTerm],
  );
  const selectedEntry = useMemo(
    () =>
      selectedEntryKey
        ? resource.entries.find((entry) => getEntryKey(entry) === selectedEntryKey) ??
          null
        : null,
    [resource.entries, selectedEntryKey],
  );

  async function copyCode(value: string, label = value) {
    await navigator.clipboard.writeText(value);
    setCopiedCode(label);
  }

  async function refreshFromIso() {
    if (isRefreshing || !canRefresh) {
      return;
    }

    setIsRefreshing(true);
    setRefreshError(null);
    setRefreshProgress({
      phase: "running",
      progress: 10,
      message: "Starting refresh",
    });

    const progressStages: RefreshProgress[] = [
      {
        phase: "running",
        progress: 35,
        message: "Fetching ISO, GENC, and FIPS sources",
      },
      {
        phase: "running",
        progress: 65,
        message: "Applying curated overlay",
      },
      {
        phase: "running",
        progress: 85,
        message: "Preparing updated rows",
      },
    ];
    let stageIndex = 0;
    const stageTimer = window.setInterval(() => {
      setRefreshProgress((current) => {
        if (!current || current.phase !== "running") {
          return current;
        }

        const nextStage = progressStages[stageIndex];
        stageIndex = Math.min(stageIndex + 1, progressStages.length - 1);

        return nextStage;
      });
    }, 900);

    try {
      const response = await fetch("/api/iso-country-codes/refresh");

      if (!response.ok) {
        throw new Error("Refresh failed.");
      }

      const nextResource = (await response.json()) as IsoCountryCodeResource;
      setRefreshProgress({
        phase: "running",
        progress: 95,
        message: "Updating visible list",
      });
      setResource(nextResource);
      setSelectedEntryKey(null);
      setRefreshProgress({
        phase: "ready",
        progress: 100,
        message: "Refresh complete",
      });
    } catch {
      setRefreshError(
        "Could not refresh country and territory codes. The generated resource is still shown.",
      );
      setRefreshProgress({
        phase: "failed",
        progress: 100,
        message: "Refresh failed",
      });
    } finally {
      window.clearInterval(stageTimer);
      setIsRefreshing(false);
    }
  }

  function updateEntry(
    entryToUpdate: IsoCountryCodeEntry,
    update: (entry: IsoCountryCodeEntry) => IsoCountryCodeEntry,
  ) {
    const entryKey = getEntryKey(entryToUpdate);

    setResource((currentResource) => {
      const entries = currentResource.entries.map((entry) =>
        getEntryKey(entry) === entryKey ? update(entry) : entry,
      );

      return {
        ...currentResource,
        activeCount: entries.filter((entry) => entry.active).length,
        entries,
      };
    });
  }

  function handleActiveChange(entry: IsoCountryCodeEntry, active: boolean) {
    updateEntry(entry, (currentEntry) => ({
      ...currentEntry,
      active,
    }));
  }

  function handleAddAlternativeName(entry: IsoCountryCodeEntry, value: string) {
    const alias = value.trim();

    if (!alias) {
      return;
    }

    updateEntry(entry, (currentEntry) => {
      const normalizedAlias = alias.toLocaleLowerCase();
      const existingNames = [
        currentEntry.displayName,
        ...currentEntry.alternativeNames,
      ].map((name) => name.trim().toLocaleLowerCase());

      if (existingNames.includes(normalizedAlias)) {
        return currentEntry;
      }

      return {
        ...currentEntry,
        alternativeNames: [...currentEntry.alternativeNames, alias],
      };
    });
  }

  function openEntry(entry: IsoCountryCodeEntry) {
    setSelectedEntryKey(getEntryKey(entry));
  }

  function handleEntryKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    entry: IsoCountryCodeEntry,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openEntry(entry);
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative block min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <span className="sr-only">Search country and territory codes</span>
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search name, alias, ISO3, FIPS, GENC, status, or classification"
                className="h-10 pl-9"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="w-fit">
                {visibleEntries.length} visible
              </Badge>
              {canRefresh ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={refreshFromIso}
                  disabled={isRefreshing}
                >
                  <RefreshCwIcon className={isRefreshing ? "animate-spin" : ""} />
                  Refresh
                </Button>
              ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadResource(visibleEntries)}
            >
              <DownloadIcon />
              Download
            </Button>
            </div>
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
          {refreshProgress ? (
            <div className="space-y-3 rounded-lg border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Refresh source data</p>
                  <p className="text-sm text-muted-foreground">
                    {refreshProgress.message}
                  </p>
                </div>
                {refreshProgress.phase === "ready" ? (
                  <CheckIcon className="size-5 text-emerald-600" />
                ) : refreshProgress.phase === "failed" ? (
                  <span className="text-sm font-medium text-destructive">
                    Failed
                  </span>
                ) : (
                  <RefreshCwIcon className="size-5 animate-spin text-muted-foreground" />
                )}
              </div>
              <Progress value={refreshProgress.progress} />
            </div>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEntries.map((entry) => (
                  <TableRow
                    key={getEntryKey(entry)}
                    tabIndex={0}
                    aria-label={`Open ${entry.displayName} details`}
                    data-smoke-trigger="country-code-detail-sheet"
                    className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    onClick={() => openEntry(entry)}
                    onKeyDown={(event) => handleEntryKeyDown(event, entry)}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <CountryCodeDetailSheet
        entry={selectedEntry}
        resource={resource}
        open={Boolean(selectedEntry)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEntryKey(null);
          }
        }}
        onCopyCode={(value, label) => void copyCode(value, label)}
        onActiveChange={handleActiveChange}
        onAddAlternativeName={handleAddAlternativeName}
      />
    </>
  );
}
