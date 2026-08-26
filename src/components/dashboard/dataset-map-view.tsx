"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  ChevronDownIcon,
  ListChecksIcon,
  MapPinnedIcon,
  SearchIcon,
  TablePropertiesIcon,
} from "lucide-react";

import { DatasetCountryMap } from "@/components/dashboard/dataset-country-map";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { DatasetRowsResponse } from "@/lib/api-types";
import {
  aggregateDatasetMapRows,
  isDatasetMapBoundaryCollection,
  searchDatasetMapEntries,
  type DatasetMapBoundaryCollection,
  type DatasetMapSearchEntry,
} from "@/lib/dataset-map-data";

const DATASET_MAP_BOUNDARY_URL =
  "/map-data/natural-earth-countries-110m.geojson";
const COUNTRY_RECORD_BATCH_SIZE = 24;

export type DatasetMapTableScopeRequest = {
  label: string;
  rowIds: string[];
};

type DatasetMapViewProps = {
  rows: readonly DatasetRowsResponse["rows"][number][];
  isLoading: boolean;
  error: string | null;
  onViewRowsInTable?: (scope: DatasetMapTableScopeRequest) => void;
  onOpenRecord?: (rowId: string) => void;
};

function formatRecordCount(value: number) {
  return `${value.toLocaleString()} ${value === 1 ? "record" : "records"}`;
}

export function DatasetMapView({
  rows,
  isLoading,
  error,
  onViewRowsInTable,
  onOpenRecord,
}: DatasetMapViewProps) {
  const [boundaries, setBoundaries] =
    useState<DatasetMapBoundaryCollection | null>(null);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [rendererReady, setRendererReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountryIso3, setSelectedCountryIso3] = useState<string | null>(
    null,
  );
  const [focusedSearchResult, setFocusedSearchResult] =
    useState<DatasetMapSearchEntry | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [visibleRecordLimit, setVisibleRecordLimit] = useState(
    COUNTRY_RECORD_BATCH_SIZE,
  );

  useEffect(() => {
    const abortController = new AbortController();

    void fetch(DATASET_MAP_BOUNDARY_URL, {
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Boundary request failed with ${response.status}.`);
        }

        const payload: unknown = await response.json();
        if (!isDatasetMapBoundaryCollection(payload)) {
          throw new Error("Boundary data has an unexpected shape.");
        }

        setBoundaries(payload);
      })
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }

        setBoundaryError("The local country boundaries could not be loaded.");
      });

    return () => abortController.abort();
  }, []);

  const aggregation = useMemo(
    () => (boundaries ? aggregateDatasetMapRows(rows, boundaries) : null),
    [boundaries, rows],
  );
  const searchResults = useMemo(
    () =>
      aggregation
        ? searchDatasetMapEntries(aggregation, searchQuery)
        : [],
    [aggregation, searchQuery],
  );
  const selectedCountry = selectedCountryIso3
    ? aggregation?.countryByIso3.get(selectedCountryIso3) ?? null
    : null;
  const activeFocusedSearchResult =
    selectedCountry &&
    focusedSearchResult?.countryIso3 === selectedCountry.iso3
      ? focusedSearchResult
      : null;
  const visibleRecords = useMemo(() => {
    if (!selectedCountry) {
      return [];
    }

    const records = [...selectedCountry.records];
    if (activeFocusedSearchResult?.rowId) {
      records.sort((left, right) => {
        if (left.rowId === activeFocusedSearchResult.rowId) return -1;
        if (right.rowId === activeFocusedSearchResult.rowId) return 1;
        return left.name.localeCompare(right.name, undefined, { numeric: true });
      });
    }

    return records.slice(0, visibleRecordLimit);
  }, [activeFocusedSearchResult, selectedCountry, visibleRecordLimit]);

  const selectCountry = useCallback((iso3: string) => {
    setSelectedCountryIso3(iso3);
    setFocusedSearchResult(null);
    setSelectedRecordIds(new Set());
    setVisibleRecordLimit(COUNTRY_RECORD_BATCH_SIZE);
  }, []);
  const selectSearchResult = useCallback((result: DatasetMapSearchEntry) => {
    setSelectedCountryIso3(result.countryIso3);
    setFocusedSearchResult(result.type === "people-group" ? result : null);
    setSelectedRecordIds(new Set());
    setVisibleRecordLimit(COUNTRY_RECORD_BATCH_SIZE);
  }, []);
  const handleRendererReady = useCallback(() => {
    setRendererReady(true);
  }, []);
  const handleRendererError = useCallback((message: string) => {
    setRendererError(message);
  }, []);
  const toggleRecord = useCallback((rowId: string, checked: boolean) => {
    setSelectedRecordIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(rowId);
      } else {
        next.delete(rowId);
      }
      return next;
    });
  }, []);
  const toggleAllCountryRecords = useCallback(
    (checked: boolean) => {
      setSelectedRecordIds(
        checked && selectedCountry
          ? new Set(selectedCountry.records.map((record) => record.rowId))
          : new Set(),
      );
    },
    [selectedCountry],
  );
  const viewRowsInTable = useCallback(
    (rowIds: string[], suffix?: string) => {
      if (!selectedCountry || rowIds.length === 0) {
        return;
      }

      onViewRowsInTable?.({
        label: suffix ? `${selectedCountry.name} · ${suffix}` : selectedCountry.name,
        rowIds,
      });
    },
    [onViewRowsInTable, selectedCountry],
  );

  const mapError = boundaryError ?? rendererError;
  const isBoundaryLoading = !boundaries && !boundaryError;
  const hasFilteredRows = rows.length > 0;
  const hasMappedRows = Boolean(aggregation?.mappedRecordCount);
  const allCountryRecordsSelected = Boolean(
    selectedCountry &&
      selectedCountry.records.length > 0 &&
      selectedRecordIds.size === selectedCountry.records.length,
  );
  const someCountryRecordsSelected =
    selectedRecordIds.size > 0 && !allCountryRecordsSelected;

  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-card"
      aria-labelledby="dataset-map-heading"
      data-smoke-surface="dataset-map"
    >
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 id="dataset-map-heading" className="flex items-center gap-2 font-semibold">
              <MapPinnedIcon aria-hidden="true" className="size-5 text-teal-700" />
              Matching records by country
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This view uses the same filtered records as the table. It does not
              geocode or change source data.
            </p>
          </div>
          {aggregation ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-live="polite">
              <span data-smoke-map-mapped-count>
                <strong>{aggregation.mappedRecordCount.toLocaleString()}</strong>{" "}
                mapped
              </span>
              <span data-smoke-map-unmapped-count>
                <strong>{aggregation.unmappedRecordCount.toLocaleString()}</strong>{" "}
                unmapped
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-b border-border bg-muted/15 px-3 py-3 sm:px-4">
        <div className="max-w-2xl">
          <label htmlFor="dataset-map-search" className="text-sm font-medium">
            Search this result
          </label>
          <div className="relative mt-2">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="dataset-map-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Country or people group"
              className="pl-9"
            />
          </div>

          {searchQuery.trim() ? (
            <div className="mt-2 rounded-lg border border-border bg-background p-1 shadow-sm" aria-live="polite">
              {searchResults.length > 0 ? (
                <ul className="max-h-56 space-y-1 overflow-y-auto" aria-label="Map search results">
                  {searchResults.map((result) => (
                    <li key={result.id}>
                      <button
                        type="button"
                        className="w-full rounded-md px-2 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => selectSearchResult(result)}
                        aria-label={`${result.label} — ${
                          result.type === "country" ? "Country" : result.countryName
                        }`}
                      >
                        <span className="block truncate font-medium">{result.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {result.type === "country" ? "Country" : result.countryName}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 py-2 text-sm text-muted-foreground">No current results.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 p-3 sm:p-4">
          {isLoading || isBoundaryLoading ? (
            <div className="flex min-h-[28rem] items-center justify-center rounded-xl bg-muted/50 text-sm text-muted-foreground">
              Loading the local country map…
            </div>
          ) : error || mapError ? (
            <div
              className="flex min-h-[28rem] flex-col items-center justify-center rounded-xl bg-destructive/5 px-6 text-center"
              role="alert"
            >
              <AlertCircleIcon aria-hidden="true" className="mb-3 size-6 text-destructive" />
              <p className="font-medium">The map could not be displayed.</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {mapError ?? error} The table and dataset actions are still available.
              </p>
            </div>
          ) : !hasFilteredRows ? (
            <div className="flex min-h-[28rem] items-center justify-center rounded-xl bg-muted/50 px-6 text-center text-sm text-muted-foreground">
              No records match the current filters. Adjust the filters or return
              to Table mode.
            </div>
          ) : !hasMappedRows ? (
            <div className="flex min-h-[28rem] items-center justify-center rounded-xl bg-muted/50 px-6 text-center">
              <div>
                <p className="font-medium">No usable country geography</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {formatRecordCount(aggregation?.unmappedRecordCount ?? rows.length)}{" "}
                  could not be matched to the bundled country boundaries.
                </p>
              </div>
            </div>
          ) : boundaries && aggregation ? (
            <div data-smoke-ready={rendererReady ? "dataset-map" : undefined}>
              <DatasetCountryMap
                boundaries={boundaries}
                countries={aggregation.countries}
                selectedCountryIso3={selectedCountry?.iso3 ?? null}
                onSelectCountry={selectCountry}
                onReady={handleRendererReady}
                onError={handleRendererError}
              />
              <div
                className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"
                aria-label="Matching records legend"
              >
                <span>Fewer</span>
                {["#99f6e4", "#2dd4bf", "#0d9488", "#0f766e"].map(
                  (color) => (
                    <span
                      key={color}
                      className="size-3 rounded-sm border border-black/5"
                      style={{ backgroundColor: color }}
                    />
                  ),
                )}
                <span>More matching records</span>
              </div>
            </div>
          ) : null}
      </div>

      <div className="border-t border-border bg-muted/15 p-4" aria-live="polite">
        {selectedCountry ? (
          <div data-smoke-map-country-records>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Selected country
                </p>
                <h3 className="mt-1 text-lg font-semibold">{selectedCountry.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatRecordCount(selectedCountry.matchingRecordCount)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  viewRowsInTable(
                    selectedCountry.records.map((record) => record.rowId),
                  )
                }
                data-smoke-map-view-all-table
              >
                <TablePropertiesIcon />
                View all in Table
              </Button>
            </div>

            {activeFocusedSearchResult ? (
              <p className="mt-3 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-950 dark:bg-teal-950/40 dark:text-teal-100">
                Focused match: {activeFocusedSearchResult.label}
              </p>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-background">
              <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                  <Checkbox
                    checked={allCountryRecordsSelected}
                    indeterminate={someCountryRecordsSelected}
                    onCheckedChange={(checked) => toggleAllCountryRecords(!!checked)}
                    aria-label={`Select all records in ${selectedCountry.name}`}
                  />
                  Select all {selectedCountry.records.length.toLocaleString()} records
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={selectedRecordIds.size === 0}
                  onClick={() =>
                    viewRowsInTable(
                      [...selectedRecordIds],
                      `${selectedRecordIds.size.toLocaleString()} selected`,
                    )
                  }
                  data-smoke-map-view-selected-table
                >
                  <ListChecksIcon />
                  View selected ({selectedRecordIds.size.toLocaleString()}) in Table
                </Button>
              </div>

              <ul
                className="max-h-72 divide-y divide-border overflow-y-auto"
                aria-label={`Records in ${selectedCountry.name}`}
              >
                {visibleRecords.map((record) => (
                  <li
                    key={record.rowId}
                    className={
                      record.rowId === activeFocusedSearchResult?.rowId
                        ? "bg-teal-50/70 dark:bg-teal-950/30"
                        : ""
                    }
                  >
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <Checkbox
                        checked={selectedRecordIds.has(record.rowId)}
                        onCheckedChange={(checked) =>
                          toggleRecord(record.rowId, !!checked)
                        }
                        aria-label={`Select ${record.name}`}
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => onOpenRecord?.(record.rowId)}
                        data-smoke-trigger="dataset-record-profile-sheet"
                      >
                        <span className="block truncate text-sm font-medium text-foreground">
                          {record.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Source row {record.sourceRowNumber.toLocaleString()}
                        </span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {visibleRecordLimit < selectedCountry.records.length ? (
                <div className="border-t border-border p-2 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setVisibleRecordLimit((current) =>
                        Math.min(
                          current + COUNTRY_RECORD_BATCH_SIZE,
                          selectedCountry.records.length,
                        ),
                      )
                    }
                  >
                    <ChevronDownIcon />
                    Show more records
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a country or search result to inspect and open its matching records.
          </p>
        )}
      </div>
    </section>
  );
}
