"use client";

import {
  CheckIcon,
  DownloadIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
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
  canEditAlternativeNames: boolean;
};

type RefreshProgress = {
  progress: number;
  message: string;
};

type AlternativeNameSaveResult = {
  entry: IsoCountryCodeEntry;
  resource: IsoCountryCodeResource;
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

function withAddedAlternativeName(entry: IsoCountryCodeEntry, value: string) {
  const alias = value.trim();

  if (!alias) {
    return entry.alternativeNames;
  }

  const normalizedAlias = alias.toLocaleLowerCase();
  const existingNames = [
    entry.displayName,
    ...entry.alternativeNames,
  ].map((name) => name.trim().toLocaleLowerCase());

  if (existingNames.includes(normalizedAlias)) {
    return entry.alternativeNames;
  }

  return [...entry.alternativeNames, alias];
}

function withoutAlternativeName(entry: IsoCountryCodeEntry, value: string) {
  return entry.alternativeNames.filter((name) => name !== value);
}

function areAlternativeNamesEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

type CountryCodeDetailSheetProps = {
  entry: IsoCountryCodeEntry | null;
  resource: IsoCountryCodeResource;
  open: boolean;
  canEditAlternativeNames: boolean;
  isSavingAlternativeNames: boolean;
  alternativeNameError: string | null;
  onOpenChange: (open: boolean) => void;
  onActiveChange: (entry: IsoCountryCodeEntry, active: boolean) => void;
  onAddAlternativeName: (
    entry: IsoCountryCodeEntry,
    value: string,
  ) => Promise<boolean>;
  onDeleteAlternativeName: (
    entry: IsoCountryCodeEntry,
    value: string,
  ) => Promise<boolean>;
};

function CountryCodeDetailSheet({
  entry,
  resource,
  open,
  canEditAlternativeNames,
  isSavingAlternativeNames,
  alternativeNameError,
  onOpenChange,
  onActiveChange,
  onAddAlternativeName,
  onDeleteAlternativeName,
}: CountryCodeDetailSheetProps) {
  const [aliasInput, setAliasInput] = useState("");

  function handleAddAlias(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!entry) {
      return;
    }

    void onAddAlternativeName(entry, aliasInput).then((saved) => {
      if (saved) {
        setAliasInput("");
      }
    });
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
              </section>

              <section className="space-y-4 rounded-lg border border-border bg-card px-4 py-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Alternative Names
                  </p>
                  {entry.alternativeNames.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {entry.alternativeNames.map((name) => (
                        <li key={name}>
                          <span className="inline-flex min-h-6 items-center gap-1 rounded-lg border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground">
                            {name}
                            {canEditAlternativeNames ? (
                              <button
                                type="button"
                                className="-mr-1 inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`Delete alternate name ${name}`}
                                disabled={isSavingAlternativeNames}
                                onClick={() => {
                                  void onDeleteAlternativeName(entry, name);
                                }}
                              >
                                <XIcon className="size-3" aria-hidden="true" />
                              </button>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">None</p>
                  )}
                </div>
                {canEditAlternativeNames ? (
                  <form className="flex gap-2" onSubmit={handleAddAlias}>
                    <label className="sr-only" htmlFor="country-code-alias">
                      Alternative name
                    </label>
                    <Input
                      id="country-code-alias"
                      value={aliasInput}
                      onChange={(event) => setAliasInput(event.target.value)}
                      placeholder="Add alternative name"
                      disabled={isSavingAlternativeNames}
                    />
                    <Button
                      type="submit"
                      disabled={!aliasInput.trim() || isSavingAlternativeNames}
                    >
                      <PlusIcon />
                      Add
                    </Button>
                  </form>
                ) : null}
                {isSavingAlternativeNames ? (
                  <p className="text-sm text-muted-foreground">
                    Saving alternate names...
                  </p>
                ) : null}
                {alternativeNameError ? (
                  <p className="text-sm text-destructive">{alternativeNameError}</p>
                ) : null}
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
  canEditAlternativeNames,
}: IsoCountryCodesClientProps) {
  const [resource, setResource] = useState(initialResource);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSucceeded, setRefreshSucceeded] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<RefreshProgress | null>(
    null,
  );
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);
  const [isSavingAlternativeNames, setIsSavingAlternativeNames] = useState(false);
  const [alternativeNameError, setAlternativeNameError] = useState<string | null>(
    null,
  );
  const refreshSuccessTimer = useRef<number | null>(null);
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

  useEffect(
    () => () => {
      if (refreshSuccessTimer.current !== null) {
        window.clearTimeout(refreshSuccessTimer.current);
      }
    },
    [],
  );

  function showRefreshSuccess() {
    setRefreshSucceeded(true);

    if (refreshSuccessTimer.current !== null) {
      window.clearTimeout(refreshSuccessTimer.current);
    }

    refreshSuccessTimer.current = window.setTimeout(() => {
      setRefreshSucceeded(false);
      refreshSuccessTimer.current = null;
    }, 5000);
  }

  async function refreshFromIso() {
    if (isRefreshing || !canRefresh) {
      return;
    }

    setIsRefreshing(true);
    setRefreshSucceeded(false);
    setRefreshError(null);
    setRefreshProgress({
      progress: 10,
      message: "Starting refresh",
    });

    const progressStages: RefreshProgress[] = [
      {
        progress: 35,
        message: "Fetching ISO, GENC, and FIPS sources",
      },
      {
        progress: 65,
        message: "Applying curated overlay",
      },
      {
        progress: 85,
        message: "Preparing updated rows",
      },
    ];
    let stageIndex = 0;
    const stageTimer = window.setInterval(() => {
      setRefreshProgress((current) => {
        if (!current) {
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
        progress: 95,
        message: "Updating visible list",
      });
      setResource(nextResource);
      setSelectedEntryKey(null);
      setRefreshProgress(null);
      showRefreshSuccess();
    } catch {
      setRefreshError(
        "Could not refresh country and territory codes. The generated resource is still shown.",
      );
      setRefreshProgress(null);
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

  async function saveAlternativeNames(
    entry: IsoCountryCodeEntry,
    alternativeNames: string[],
  ) {
    if (!canEditAlternativeNames) {
      return false;
    }

    if (areAlternativeNamesEqual(entry.alternativeNames, alternativeNames)) {
      return true;
    }

    setAlternativeNameError(null);
    setIsSavingAlternativeNames(true);

    try {
      const response = await fetch("/api/iso-country-codes/alternative-names", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: entry.displayName,
          alternativeNames,
        }),
      });

      if (!response.ok) {
        throw new Error("Save failed.");
      }

      const payload = (await response.json()) as AlternativeNameSaveResult;
      setResource(payload.resource);
      setSelectedEntryKey(getEntryKey(payload.entry));
      return true;
    } catch {
      setAlternativeNameError(
        "Could not save alternate names. The current resource is still shown.",
      );
      return false;
    } finally {
      setIsSavingAlternativeNames(false);
    }
  }

  function handleAddAlternativeName(entry: IsoCountryCodeEntry, value: string) {
    return saveAlternativeNames(entry, withAddedAlternativeName(entry, value));
  }

  function handleDeleteAlternativeName(entry: IsoCountryCodeEntry, value: string) {
    return saveAlternativeNames(entry, withoutAlternativeName(entry, value));
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
                  {refreshSucceeded ? (
                    <CheckIcon className="text-emerald-600" />
                  ) : (
                    <RefreshCwIcon className={isRefreshing ? "animate-spin" : ""} />
                  )}
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
                <RefreshCwIcon className="size-5 animate-spin text-muted-foreground" />
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
        canEditAlternativeNames={canEditAlternativeNames}
        isSavingAlternativeNames={isSavingAlternativeNames}
        alternativeNameError={alternativeNameError}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEntryKey(null);
          }
        }}
        onActiveChange={handleActiveChange}
        onAddAlternativeName={handleAddAlternativeName}
        onDeleteAlternativeName={handleDeleteAlternativeName}
      />
    </>
  );
}
