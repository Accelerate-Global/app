"use client";

import { useMemo, useState } from "react";

import { DatasetTableActionBar } from "@/components/dashboard/dataset-table-action-bar";
import { DatasetTable } from "@/components/dashboard/dataset-table";
import { DatasetViewSwitchGrid } from "@/components/dashboard/dataset-view-switch-grid";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDatasetTableState } from "@/components/dashboard/use-dataset-table-state";
import type {
  DatasetSummary,
  FieldDefinitionPresentation,
  FilterRegion,
  SavedDatasetSort,
} from "@/lib/api-types";
import {
  UUPG_DATASET_COLUMN_KEY,
  WATCHLIST_DATASET_COLUMN_KEY,
  WATCHLIST_ENGAGEMENT_PHASES_DATASET_COLUMN_KEY,
  WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEY,
  WATCHLIST_PERCENT_EVANGELICAL_DATASET_COLUMN_KEY,
  WATCHLIST_POPULATION_DATASET_COLUMN_KEY,
} from "@/lib/dataset-region-constants";
import {
  datasetSupportsRegionFiltering,
  datasetSupportsWatchlistFiltering,
  datasetSupportsUupgFiltering,
  getEnabledRegionCountryNames,
} from "@/lib/dataset-region-filtering";
import { buildSavedDatasetFilterState } from "@/lib/saved-dataset-filters";

type DatasetDetailClientProps = {
  dataset: DatasetSummary;
  regions: FilterRegion[];
  fieldDefinitionPresentationByColumnKey: Record<
    string,
    FieldDefinitionPresentation
  >;
};

const WATCHLIST_THRESHOLD_DEFAULT = 2;
const WATCHLIST_THRESHOLD_MIN = 0;
const WATCHLIST_THRESHOLD_MAX = 6;
const WATCHLIST_ENGAGEMENT_PHASE_DEFAULT = 6;
const WATCHLIST_ENGAGEMENT_PHASE_MIN = 0;
const WATCHLIST_ENGAGEMENT_PHASE_MAX = 7;
const WATCHLIST_EVANGELICAL_BELIEVERS_LABEL = "Evangelical Believers";
const WATCHLIST_EVANGELICAL_BELIEVERS_DEFAULT = 1000;
const WATCHLIST_EVANGELICAL_BELIEVERS_MIN = 0;
const WATCHLIST_EVANGELICAL_BELIEVERS_MAX = 1_000_000_000;
const WATCHLIST_EVANGELICAL_PERCENT_LABEL = "Evangelical %";
const WATCHLIST_EVANGELICAL_PERCENT_DEFAULT = 0.05;
const WATCHLIST_EVANGELICAL_PERCENT_MIN = 0;
const WATCHLIST_EVANGELICAL_PERCENT_MAX = 100;
const WATCHLIST_FRONTIER_GROUP_VALUE_DEFAULT = true;

function clampWatchlistThreshold(value: number) {
  return Math.min(
    WATCHLIST_THRESHOLD_MAX,
    Math.max(WATCHLIST_THRESHOLD_MIN, Math.round(value)),
  );
}

function clampWatchlistEngagementPhaseThreshold(value: number) {
  return Math.min(
    WATCHLIST_ENGAGEMENT_PHASE_MAX,
    Math.max(WATCHLIST_ENGAGEMENT_PHASE_MIN, Math.round(value)),
  );
}

function clampWatchlistEvangelicalBelieversThreshold(value: number) {
  return Math.min(
    WATCHLIST_EVANGELICAL_BELIEVERS_MAX,
    Math.max(WATCHLIST_EVANGELICAL_BELIEVERS_MIN, Math.round(value)),
  );
}

function clampWatchlistEvangelicalPercentThreshold(value: number) {
  const clampedValue = Math.min(
    WATCHLIST_EVANGELICAL_PERCENT_MAX,
    Math.max(WATCHLIST_EVANGELICAL_PERCENT_MIN, value),
  );

  return Math.round(clampedValue * 100) / 100;
}

export function DatasetDetailClient({
  dataset,
  regions,
  fieldDefinitionPresentationByColumnKey,
}: DatasetDetailClientProps) {
  const watchlistThresholdLabel =
    fieldDefinitionPresentationByColumnKey[WATCHLIST_DATASET_COLUMN_KEY]
      ?.effectiveLabel ?? "Christianity_GSEC";
  const watchlistThresholdDefinition =
    fieldDefinitionPresentationByColumnKey[WATCHLIST_DATASET_COLUMN_KEY]
      ?.definition ?? "";
  const watchlistEngagementPhaseLabel =
    fieldDefinitionPresentationByColumnKey[
      WATCHLIST_ENGAGEMENT_PHASES_DATASET_COLUMN_KEY
    ]?.effectiveLabel ?? "Engage_8_Phases_of_Engagement";
  const watchlistEngagementPhaseDefinition =
    fieldDefinitionPresentationByColumnKey[
      WATCHLIST_ENGAGEMENT_PHASES_DATASET_COLUMN_KEY
    ]?.definition ?? "";
  const watchlistPopulationLabel =
    fieldDefinitionPresentationByColumnKey[WATCHLIST_POPULATION_DATASET_COLUMN_KEY]
      ?.effectiveLabel ?? "PG_Population";
  const watchlistPercentEvangelicalLabel =
    fieldDefinitionPresentationByColumnKey[
      WATCHLIST_PERCENT_EVANGELICAL_DATASET_COLUMN_KEY
    ]?.effectiveLabel ?? "Percent_Evangelical_PGAC";
  const watchlistPercentEvangelicalDefinition =
    fieldDefinitionPresentationByColumnKey[
      WATCHLIST_PERCENT_EVANGELICAL_DATASET_COLUMN_KEY
    ]?.definition ?? `Mapped from ${watchlistPercentEvangelicalLabel}.`;
  const watchlistEvangelicalBelieversDefinition = `Calculated as ${watchlistPopulationLabel} * (${watchlistPercentEvangelicalLabel} / 100).`;
  const watchlistFrontierGroupLabel =
    fieldDefinitionPresentationByColumnKey[
      WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEY
    ]?.effectiveLabel ?? "Christianity_Frontier_Group";
  const watchlistFrontierGroupDefinition =
    fieldDefinitionPresentationByColumnKey[
      WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEY
    ]?.definition ?? "";
  const uupgFieldLabel =
    fieldDefinitionPresentationByColumnKey[UUPG_DATASET_COLUMN_KEY]
      ?.effectiveLabel ?? "Engage_Global_Engagement_Anywhere";
  const uupgFieldDefinition =
    fieldDefinitionPresentationByColumnKey[UUPG_DATASET_COLUMN_KEY]
      ?.definition ?? "";
  const supportsRegionFiltering = datasetSupportsRegionFiltering(dataset);
  const supportsWatchlistFiltering = datasetSupportsWatchlistFiltering(dataset);
  const supportsUupgFiltering = datasetSupportsUupgFiltering(dataset);
  const canUseRegionFilter = supportsRegionFiltering && regions.length > 0;
  const regionEnabled = canUseRegionFilter;
  const [selectedRegionIds, setSelectedRegionIds] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        regions.map((region) => [region.id, canUseRegionFilter]),
      ),
  );
  const [watchlistEnabled, setWatchlistEnabled] = useState(false);
  const [watchlistThreshold, setWatchlistThreshold] = useState(
    WATCHLIST_THRESHOLD_DEFAULT,
  );
  const [watchlistEngagementPhaseThreshold, setWatchlistEngagementPhaseThreshold] =
    useState(WATCHLIST_ENGAGEMENT_PHASE_DEFAULT);
  const [watchlistEvangelicalBelieversThreshold, setWatchlistEvangelicalBelieversThreshold] =
    useState(WATCHLIST_EVANGELICAL_BELIEVERS_DEFAULT);
  const [watchlistEvangelicalPercentThreshold, setWatchlistEvangelicalPercentThreshold] =
    useState(WATCHLIST_EVANGELICAL_PERCENT_DEFAULT);
  const [watchlistFrontierGroupValue, setWatchlistFrontierGroupValue] = useState(
    WATCHLIST_FRONTIER_GROUP_VALUE_DEFAULT,
  );
  const [uupgEnabled, setUupgEnabled] = useState(false);
  const [isFiltersSheetOpen, setIsFiltersSheetOpen] = useState(false);

  const enabledCountryNames = useMemo(
    () => getEnabledRegionCountryNames(regions, selectedRegionIds),
    [regions, selectedRegionIds],
  );
  const regionSelectors = useMemo(
    () =>
      regions.map((region) => ({
        id: region.id,
        label: region.name,
        checked: selectedRegionIds[region.id] ?? false,
        description: region.description,
        countries: region.countries,
      })),
    [regions, selectedRegionIds],
  );
  const datasetTable = useDatasetTableState({
    dataset,
    fieldDefinitionPresentationByColumnKey,
    regionFilter: {
      enabled: regionEnabled,
      isSupported: supportsRegionFiltering,
      hasConfiguredRegions: regions.length > 0,
      enabledCountryNames,
    },
    watchlistFilter: {
      enabled: watchlistEnabled,
      isSupported: supportsWatchlistFiltering,
      threshold: watchlistThreshold,
      engagementPhaseThreshold: watchlistEngagementPhaseThreshold,
      evangelicalBelieversThreshold: watchlistEvangelicalBelieversThreshold,
      evangelicalPercentThreshold: watchlistEvangelicalPercentThreshold,
      frontierGroupValue: watchlistFrontierGroupValue,
    },
    uupgFilter: {
      enabled: uupgEnabled,
      isSupported: supportsUupgFiltering,
    },
  });
  const savedFilters = useMemo(
    () =>
      buildSavedDatasetFilterState({
        regions,
        selectedRegionIds,
        regionEnabled,
        watchlistEnabled,
        watchlistThreshold,
        watchlistEngagementPhaseThreshold,
        watchlistEvangelicalBelieversThreshold,
        watchlistEvangelicalPercentThreshold,
        watchlistFrontierGroupValue,
        uupgEnabled,
        sorting: datasetTable.sorting as SavedDatasetSort[],
      }),
    [
      datasetTable.sorting,
      regionEnabled,
      regions,
      selectedRegionIds,
      uupgEnabled,
      watchlistEnabled,
      watchlistEngagementPhaseThreshold,
      watchlistEvangelicalBelieversThreshold,
      watchlistEvangelicalPercentThreshold,
      watchlistFrontierGroupValue,
      watchlistThreshold,
    ],
  );
  const filterPanelProps = {
    regionCard: {
      enabled: regionEnabled,
      supported: supportsRegionFiltering,
      selectors: regionSelectors,
      onSelectorChange: (regionId: string, checked: boolean) =>
        setSelectedRegionIds((current) => ({
          ...current,
          [regionId]: checked,
        })),
    },
    watchlistCard: {
      enabled: watchlistEnabled,
      supported: supportsWatchlistFiltering,
      thresholdLabel: watchlistThresholdLabel,
      thresholdDefinition: watchlistThresholdDefinition,
      threshold: watchlistThreshold,
      minThreshold: WATCHLIST_THRESHOLD_MIN,
      maxThreshold: WATCHLIST_THRESHOLD_MAX,
      engagementPhaseLabel: watchlistEngagementPhaseLabel,
      engagementPhaseDefinition: watchlistEngagementPhaseDefinition,
      engagementPhaseThreshold: watchlistEngagementPhaseThreshold,
      minEngagementPhaseThreshold: WATCHLIST_ENGAGEMENT_PHASE_MIN,
      maxEngagementPhaseThreshold: WATCHLIST_ENGAGEMENT_PHASE_MAX,
      evangelicalBelieversLabel: WATCHLIST_EVANGELICAL_BELIEVERS_LABEL,
      evangelicalBelieversDefinition:
        watchlistEvangelicalBelieversDefinition,
      evangelicalBelieversThreshold: watchlistEvangelicalBelieversThreshold,
      minEvangelicalBelieversThreshold:
        WATCHLIST_EVANGELICAL_BELIEVERS_MIN,
      maxEvangelicalBelieversThreshold:
        WATCHLIST_EVANGELICAL_BELIEVERS_MAX,
      evangelicalPercentLabel: WATCHLIST_EVANGELICAL_PERCENT_LABEL,
      evangelicalPercentDefinition: watchlistPercentEvangelicalDefinition,
      evangelicalPercentThreshold: watchlistEvangelicalPercentThreshold,
      minEvangelicalPercentThreshold: WATCHLIST_EVANGELICAL_PERCENT_MIN,
      maxEvangelicalPercentThreshold: WATCHLIST_EVANGELICAL_PERCENT_MAX,
      frontierGroupLabel: watchlistFrontierGroupLabel,
      frontierGroupDefinition: watchlistFrontierGroupDefinition,
      frontierGroupValue: watchlistFrontierGroupValue,
      onEnabledChange: setWatchlistEnabled,
      onThresholdChange: (value: number) =>
        setWatchlistThreshold(clampWatchlistThreshold(value)),
      onEngagementPhaseThresholdChange: (value: number) =>
        setWatchlistEngagementPhaseThreshold(
          clampWatchlistEngagementPhaseThreshold(value),
        ),
      onEvangelicalBelieversThresholdChange: (value: number) =>
        setWatchlistEvangelicalBelieversThreshold(
          clampWatchlistEvangelicalBelieversThreshold(value),
        ),
      onEvangelicalPercentThresholdChange: (value: number) =>
        setWatchlistEvangelicalPercentThreshold(
          clampWatchlistEvangelicalPercentThreshold(value),
        ),
      onFrontierGroupValueChange: setWatchlistFrontierGroupValue,
    },
    uupgCard: {
      enabled: uupgEnabled,
      supported: supportsUupgFiltering,
      fieldLabel: uupgFieldLabel,
      fieldDefinition: uupgFieldDefinition,
      onEnabledChange: setUupgEnabled,
    },
  } satisfies Parameters<typeof DatasetViewSwitchGrid>[0];

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
        <aside className="hidden xl:block xl:self-start">
          <div className="sticky top-24">
            <DatasetViewSwitchGrid {...filterPanelProps} />
          </div>
        </aside>
        <div className="min-w-0 space-y-4">
          <DatasetTableActionBar
            dataset={dataset}
            filters={savedFilters}
            recordCount={datasetTable.recordCount}
            sortedRows={datasetTable.sortedRows}
            visibleColumns={datasetTable.visibleColumns}
            isLoading={datasetTable.isLoading}
            hasError={Boolean(dataset.error || datasetTable.error)}
            fieldDefinitionPresentationByColumnKey={fieldDefinitionPresentationByColumnKey}
            onOpenFilters={() => setIsFiltersSheetOpen(true)}
          />
          <DatasetTable
            table={datasetTable.table}
            recordCount={datasetTable.recordCount}
            isLoading={datasetTable.isLoading}
            datasetError={dataset.error}
            error={datasetTable.error}
          />
        </div>
      </div>
      <Sheet open={isFiltersSheetOpen} onOpenChange={setIsFiltersSheetOpen}>
        <SheetContent
          side="left"
          className="w-full border-border bg-background p-0 sm:max-w-[22rem]"
          data-smoke-surface="dataset-filters-sheet"
          data-smoke-ready="dataset-filters-sheet"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              Expand a section to review its description and update the table.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4 py-4">
            <DatasetViewSwitchGrid {...filterPanelProps} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
