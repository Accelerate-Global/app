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
import { ReferenceResourceLifecycle } from "@/components/dashboard/reference-resource-lifecycle";
import { Button, buttonVariants } from "@/components/ui/button";
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
import type {
  ReferenceResourceCandidateResult,
  ReferenceResourcePageByKey,
  ReferenceResourceVersionSummary,
} from "@/lib/reference-resources/types";

type RopCodesClientProps = {
  initialResource: RopCodeResource;
  activeVersion: ReferenceResourceVersionSummary;
  initialNextCursor: string | null;
  canRefresh: boolean;
};

type RefreshProgress = {
  progress: number;
  message: string;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatNullable(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "Not listed" : value;
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
  activeVersion,
  initialNextCursor,
  canRefresh,
}: RopCodesClientProps) {
  const [resource, setResource] = useState(initialResource);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSucceeded, setRefreshSucceeded] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<RefreshProgress | null>(
    null,
  );
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<ReferenceResourceCandidateResult | null>(null);
  const refreshSuccessTimer = useRef<number | null>(null);
  const initialSearchRender = useRef(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const visibleEntries = resource.entries;
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

  useEffect(() => {
    if (initialSearchRender.current) {
      initialSearchRender.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoadingEntries(true);
      setEntryError(null);
      try {
        const params = new URLSearchParams({ limit: "250" });
        if (searchTerm.trim()) params.set("search", searchTerm.trim());
        const response = await fetch(
          `/api/reference-resources/rop-codes/entries?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search failed.");
        const page = (await response.json()) as ReferenceResourcePageByKey["rop-codes"];
        setResource(page.resource);
        setNextCursor(page.nextCursor);
        setSelectedEntryId(null);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setEntryError("Could not load matching ROP codes.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingEntries(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchTerm]);

  async function loadMoreEntries() {
    if (!nextCursor || isLoadingEntries) return;
    setIsLoadingEntries(true);
    setEntryError(null);
    try {
      const params = new URLSearchParams({ cursor: nextCursor, limit: "250" });
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      const response = await fetch(
        `/api/reference-resources/rop-codes/entries?${params.toString()}`,
      );
      if (!response.ok) throw new Error("Page failed.");
      const page = (await response.json()) as ReferenceResourcePageByKey["rop-codes"];
      setResource((current) => ({
        ...page.resource,
        entries: [...current.entries, ...page.resource.entries],
        rop1DetailsByCode: { ...current.rop1DetailsByCode, ...page.resource.rop1DetailsByCode },
        rop2DetailsByCode: { ...current.rop2DetailsByCode, ...page.resource.rop2DetailsByCode },
        rop25DetailsByCode: { ...current.rop25DetailsByCode, ...page.resource.rop25DetailsByCode },
        rop3DetailsByCode: { ...current.rop3DetailsByCode, ...page.resource.rop3DetailsByCode },
        geoIndexByRop3: { ...current.geoIndexByRop3, ...page.resource.geoIndexByRop3 },
      }));
      setNextCursor(page.nextCursor);
    } catch {
      setEntryError("Could not load more ROP codes.");
    } finally {
      setIsLoadingEntries(false);
    }
  }

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

      const nextCandidate = (await response.json()) as ReferenceResourceCandidateResult;
      setRefreshProgress({
        progress: 95,
        message: "Candidate ready for review",
      });
      setCandidate(nextCandidate);
      setRefreshProgress(null);
      showRefreshSuccess();
    } catch {
      setRefreshError("Could not refresh ROP codes. The active persisted version is still shown.");
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
                  data-smoke-trigger="reference-resource-candidate"
                  data-smoke-write="unsafe"
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
              <a
                className={buttonVariants({ variant: "outline" })}
                href={`/api/reference-resources/rop-codes/download?search=${encodeURIComponent(searchTerm)}`}
              >
                <DownloadIcon />
                Download
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">
              {visibleEntries.length.toLocaleString()} loaded of {resource.entryCount.toLocaleString()}
            </Badge>
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
          {entryError ? <p className="text-sm text-destructive">{entryError}</p> : null}
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
            {nextCursor ? (
              <div className="flex justify-center pt-4">
                <Button type="button" variant="outline" onClick={loadMoreEntries} disabled={isLoadingEntries}>
                  {isLoadingEntries ? "Loading…" : "Load more"}
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
      {canRefresh ? (
        <ReferenceResourceLifecycle
          resourceKey="rop-codes"
          activeVersion={activeVersion}
          candidate={candidate}
        />
      ) : (
        <div className="text-sm text-muted-foreground">
          Active version {activeVersion.versionNumber} · {activeVersion.contentChecksum?.slice(0, 12)}
        </div>
      )}
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
