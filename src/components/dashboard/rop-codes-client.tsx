"use client";

import {
  AlertTriangleIcon,
  CheckIcon,
  DownloadIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

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
import type {
  RopCodeEntry,
  RopCodeResource,
  RopGeoIndexEntry,
  RopTerm,
  RopTermDetail,
} from "@/lib/rop-codes";

type RopCodesClientProps = {
  initialResource: RopCodeResource;
  canRefresh: boolean;
};

type RefreshProgress = {
  progress: number;
  message: string;
};

const csvColumns = [
  ["ROP1", (entry: RopCodeEntry) => entry.rop1?.display ?? ""],
  ["ROP2", (entry: RopCodeEntry) => entry.rop2?.display ?? ""],
  ["ROP25", (entry: RopCodeEntry) => entry.rop25?.display ?? ""],
  ["ROP3", (entry: RopCodeEntry) => entry.rop3?.display ?? ""],
  ["Status", (entry: RopCodeEntry) => entry.status],
  ["Row type", (entry: RopCodeEntry) => entry.rowType],
  ["Join issue", (entry: RopCodeEntry) => entry.joinIssueLabel],
  ["Place", (entry: RopCodeEntry) => entry.place],
  ["Language", (entry: RopCodeEntry) => entry.language],
  ["Source", (entry: RopCodeEntry) => entry.source],
  ["Ethnic ID", (entry: RopCodeEntry) => entry.ethnicId],
] as const;

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatNullable(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "Not listed" : value;
}

function escapeCsvValue(value: string | null | undefined) {
  const text = value ?? "";

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function buildCsv(entries: RopCodeEntry[]) {
  const header = csvColumns.map(([label]) => escapeCsvValue(label)).join(",");
  const rows = entries.map((entry) =>
    csvColumns
      .map(([, getValue]) => escapeCsvValue(getValue(entry)))
      .join(","),
  );

  return `${[header, ...rows].join("\n")}\n`;
}

function downloadResource(entries: RopCodeEntry[]) {
  const blob = new Blob([buildCsv(entries)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "rop-codes.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function termSearchText(term: RopTerm | null) {
  return term ? [term.code, term.name, term.display].join(" ") : "";
}

function getGeoSearchText(entry: RopCodeEntry, resource: RopCodeResource) {
  const rop3 = entry.rop3?.code;

  if (!rop3) {
    return "";
  }

  return (resource.geoIndexByRop3[rop3] ?? [])
    .map((row) =>
      [
        row.geoId,
        row.rog,
        row.geoName,
        row.peopleName,
        row.peopleId3,
        row.isoAlpha3,
        row.status,
      ].join(" "),
    )
    .join(" ");
}

function filterEntries(resource: RopCodeResource, searchTerm: string) {
  const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();

  if (!normalizedSearchTerm) {
    return resource.entries;
  }

  return resource.entries.filter((entry) =>
    [
      termSearchText(entry.rop1),
      termSearchText(entry.rop2),
      termSearchText(entry.rop25),
      termSearchText(entry.rop3),
      entry.status,
      entry.rowType,
      entry.joinIssue,
      entry.joinIssueLabel,
      entry.place,
      entry.language,
      entry.source,
      entry.ethnicId,
      getGeoSearchText(entry, resource),
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedSearchTerm),
  );
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
            : "text-sm leading-6 text-foreground"
        }
      >
        {children}
      </p>
    </div>
  );
}

function getTermDetail(
  detailsByCode: Record<string, RopTermDetail>,
  term: RopTerm | null,
) {
  return term ? detailsByCode[term.code] ?? null : null;
}

function TermDetailSection({
  title,
  term,
  detail,
}: {
  title: string;
  term: RopTerm | null;
  detail: RopTermDetail | null;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card px-4 py-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="grid gap-4">
        <DetailValue label="Term" mono>
          {term?.display ?? "Not listed"}
        </DetailValue>
        <DetailValue label="Description">
          {detail?.description ?? "Not listed"}
        </DetailValue>
      </div>
    </section>
  );
}

function GeographyList({ rows }: { rows: RopGeoIndexEntry[] }) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">ROP3 Geography</p>
        <Badge variant="outline">{rows.length.toLocaleString()} rows</Badge>
      </div>
      {rows.length > 0 ? (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
          <div className="grid min-w-[520px] grid-cols-[1fr_5rem_6rem_6rem] border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
            <span>Geography</span>
            <span>ROG</span>
            <span>ISO3</span>
            <span>Status</span>
          </div>
          {rows.map((row) => (
            <div
              key={`${row.geoId}-${row.isoAlpha3 ?? ""}`}
              className="grid min-w-[520px] grid-cols-[1fr_5rem_6rem_6rem] gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0"
            >
              <span>{formatNullable(row.geoName)}</span>
              <span className="font-mono">{formatNullable(row.rog)}</span>
              <span className="font-mono">{formatNullable(row.isoAlpha3)}</span>
              <span>{row.status}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No geography rows listed.</p>
      )}
    </section>
  );
}

function RopCodeDetailSheet({
  entry,
  resource,
  open,
  onOpenChange,
}: {
  entry: RopCodeEntry | null;
  resource: RopCodeResource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rop3Code = entry?.rop3?.code ?? "";
  const geographyRows = rop3Code ? resource.geoIndexByRop3[rop3Code] ?? [] : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-2xl"
        data-smoke-surface="rop-code-detail-sheet"
        data-smoke-ready="rop-code-detail-sheet"
      >
        {entry ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border px-6 py-5">
              <SheetTitle>{entry.rop3?.display ?? entry.rop25?.display}</SheetTitle>
            </SheetHeader>

            <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
              <section className="space-y-4 rounded-lg border border-border bg-card px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={entry.status === "Active" ? "secondary" : "outline"}>
                    {entry.status}
                  </Badge>
                  {entry.joinIssueLabel ? (
                    <Badge variant="outline" className="gap-1">
                      <AlertTriangleIcon className="size-3.5" />
                      {entry.joinIssueLabel}
                    </Badge>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailValue label="Place">{formatNullable(entry.place)}</DetailValue>
                  <DetailValue label="Language">
                    {formatNullable(entry.language)}
                  </DetailValue>
                  <DetailValue label="Source">{formatNullable(entry.source)}</DetailValue>
                  <DetailValue label="Ethnic ID" mono>
                    {formatNullable(entry.ethnicId)}
                  </DetailValue>
                  <DetailValue label="Direct ROP2" mono>
                    {formatNullable(entry.directRop2)}
                  </DetailValue>
                  <DetailValue label="Row type">{entry.rowType}</DetailValue>
                </div>
              </section>

              <TermDetailSection
                title="ROP1"
                term={entry.rop1}
                detail={getTermDetail(resource.rop1DetailsByCode, entry.rop1)}
              />
              <TermDetailSection
                title="ROP2"
                term={entry.rop2}
                detail={getTermDetail(resource.rop2DetailsByCode, entry.rop2)}
              />
              <TermDetailSection
                title="ROP25"
                term={entry.rop25}
                detail={getTermDetail(resource.rop25DetailsByCode, entry.rop25)}
              />
              <TermDetailSection
                title="ROP3"
                term={entry.rop3}
                detail={getTermDetail(resource.rop3DetailsByCode, entry.rop3)}
              />
              <GeographyList rows={geographyRows} />
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function RopCell({ term }: { term: RopTerm | null }) {
  return (
    <span className="block truncate font-mono text-sm font-semibold text-foreground">
      {term?.display ?? "Not listed"}
    </span>
  );
}

export function RopCodesClient({
  initialResource,
  canRefresh,
}: RopCodesClientProps) {
  const [resource, setResource] = useState(initialResource);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSucceeded, setRefreshSucceeded] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<RefreshProgress | null>(
    null,
  );
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refreshSuccessTimer = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const visibleEntries = useMemo(
    () => filterEntries(resource, searchTerm),
    [resource, searchTerm],
  );
  const selectedEntry = useMemo(
    () =>
      selectedEntryId
        ? resource.entries.find((entry) => entry.id === selectedEntryId) ?? null
        : null,
    [resource.entries, selectedEntryId],
  );
  const rowVirtualizer = useVirtualizer({
    count: visibleEntries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 68,
    overscan: 12,
  });

  useEffect(
    () => () => {
      if (refreshSuccessTimer.current !== null) {
        window.clearTimeout(refreshSuccessTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    rowVirtualizer.scrollToIndex(0);
  }, [rowVirtualizer, searchTerm]);

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

  async function refreshFromHis() {
    if (isRefreshing || !canRefresh) {
      return;
    }

    setIsRefreshing(true);
    setRefreshSucceeded(false);
    setRefreshError(null);
    setRefreshProgress({
      progress: 15,
      message: "Starting HIS refresh",
    });

    const progressStages: RefreshProgress[] = [
      {
        progress: 35,
        message: "Fetching ROP hierarchy layers",
      },
      {
        progress: 65,
        message: "Matching ROP terms",
      },
      {
        progress: 85,
        message: "Preparing visible resource",
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
      const response = await fetch("/api/rop-codes/refresh", { method: "POST" });

      if (!response.ok) {
        throw new Error("Refresh failed.");
      }

      const nextResource = (await response.json()) as RopCodeResource;
      setRefreshProgress({
        progress: 95,
        message: "Updating visible list",
      });
      setResource(nextResource);
      setSelectedEntryId(null);
      setRefreshProgress(null);
      showRefreshSuccess();
    } catch {
      setRefreshError("Could not refresh ROP codes. The generated resource is still shown.");
      setRefreshProgress(null);
    } finally {
      window.clearInterval(stageTimer);
      setIsRefreshing(false);
    }
  }

  function openEntry(entry: RopCodeEntry) {
    setSelectedEntryId(entry.id);
  }

  function handleEntryKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    entry: RopCodeEntry,
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
              <span className="sr-only">Search ROP codes</span>
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search ROP code, people, cluster, bloc, place, language, source, or geography"
                className="h-10 pl-9"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {canRefresh ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={refreshFromHis}
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
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{visibleEntries.length.toLocaleString()} visible</Badge>
            <Badge variant="outline">{resource.rop1Count.toLocaleString()} ROP1</Badge>
            <Badge variant="outline">{resource.rop2Count.toLocaleString()} ROP2</Badge>
            <Badge variant="outline">{resource.rop25Count.toLocaleString()} ROP25</Badge>
            <Badge variant="outline">{resource.rop3Count.toLocaleString()} ROP3</Badge>
            <span className="py-1">
              Retrieved {formatTimestamp(resource.sourceRetrievedAt)}
            </span>
          </div>
          {refreshError ? (
            <p className="text-sm text-destructive">{refreshError}</p>
          ) : null}
          {refreshProgress ? (
            <div className="space-y-3 rounded-lg border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Refresh HIS ROP data</p>
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
            <div
              ref={scrollRef}
              className="h-[640px] min-w-[980px] overflow-auto rounded-lg border border-border"
            >
              <div className="sticky top-0 z-10 grid grid-cols-[minmax(210px,1fr)_minmax(230px,1.1fr)_minmax(230px,1.1fr)_minmax(270px,1.25fr)] border-b border-border bg-muted px-4 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <span>ROP1</span>
                <span>ROP2</span>
                <span>ROP25</span>
                <span>ROP3</span>
              </div>
              {visibleEntries.length > 0 ? (
                <div
                  className="relative"
                  style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const entry = visibleEntries[virtualRow.index];

                    return (
                      <div
                        key={entry.id}
                        role="row"
                        tabIndex={0}
                        aria-label={`Open ${entry.rop3?.display ?? entry.rop25?.display} details`}
                        data-index={virtualRow.index}
                        data-smoke-trigger="rop-code-detail-sheet"
                        className="absolute left-0 grid w-full cursor-pointer grid-cols-[minmax(210px,1fr)_minmax(230px,1.1fr)_minmax(230px,1.1fr)_minmax(270px,1.25fr)] items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                        style={{
                          minHeight: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        onClick={() => openEntry(entry)}
                        onKeyDown={(event) => handleEntryKeyDown(event, entry)}
                      >
                        <RopCell term={entry.rop1} />
                        <RopCell term={entry.rop2} />
                        <RopCell term={entry.rop25} />
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="min-w-0 flex-1">
                            <RopCell term={entry.rop3} />
                          </span>
                          {entry.joinIssueLabel ? (
                            <AlertTriangleIcon className="size-4 shrink-0 text-amber-600" />
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No ROP codes found.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <RopCodeDetailSheet
        entry={selectedEntry}
        resource={resource}
        open={Boolean(selectedEntry)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEntryId(null);
          }
        }}
      />
    </>
  );
}
