"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DatasetAssignDerivedViewSheet } from "@/components/dashboard/dataset-assign-derived-view-sheet";
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
  DatasetOpenPreset,
  SavedDatasetFilterState,
  DatasetSummary,
  FieldDefinitionPresentation,
  FilterRegion,
  DatasetHotspotsMetric,
  SavedDatasetSort,
} from "@/lib/api-types";
import {
  buildAnalyticsContext,
  type DatasetOpenSource,
  getEnabledFilterSections,
  getSortingKeys,
  type AnalyticsWorkspaceRole,
  withAnalyticsContext,
} from "@/lib/analytics";
import { trackAppEvent } from "@/lib/analytics-client";
import {
  UUPG_DATASET_COLUMN_KEY,
  WATCHLIST_DATASET_COLUMN_KEY,
  WATCHLIST_ENGAGEMENT_PHASES_DATASET_COLUMN_KEY,
  WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEY,
  WATCHLIST_PERCENT_EVANGELICAL_DATASET_COLUMN_KEY,
  WATCHLIST_POPULATION_DATASET_COLUMN_KEY,
} from "@/lib/dataset-region-constants";
import {
  MAX_HOTSPOTS_COUNTRY_COUNT,
  datasetSupportsAlternateCountryFiltering,
  datasetSupportsCountryFiltering,
  datasetSupportsHotspotsFiltering,
  datasetSupportsRegionFiltering,
  datasetSupportsWatchlistFiltering,
  datasetSupportsUupgFiltering,
  getEffectiveCountrySelection,
  getMatchingRegionIdsForCountries,
  getSelectedRegionCountryNames,
} from "@/lib/dataset-region-filtering";
import { getFieldDefinitionCanonicalKeyLookupKeys } from "@/lib/field-definition-canonical";
import { isGlobalRegionName } from "@/lib/region-display";
import {
  buildSavedDatasetFilterState,
  getInitialDatasetDetailState,
} from "@/lib/saved-dataset-filters";
import { sanitizePopulationBelieversRule } from "@/lib/evangelical-population-believers-rule";
import { useDatasetPerfRenderTrace } from "@/lib/render-trace";

type DatasetDetailClientProps = {
  dataset: DatasetSummary;
  sourceRowCount?: number | null;
  regions: FilterRegion[];
  fieldDefinitionPresentationByColumnKey: Record<
    string,
    FieldDefinitionPresentation
  >;
  initialFilters?: DatasetOpenPreset | null;
  initialSorting?: SavedDatasetSort[] | null;
  assignableDatasets?: DatasetSummary[];
  actorOwnerId?: string;
  workspaceRole?: AnalyticsWorkspaceRole;
  datasetSource?: DatasetOpenSource;
  initialSavedTableId?: string | null;
  initialSavedTableRowCount?: number | null;
  initialSavedTableFilterSections?: SavedDatasetFilterState | null;
};

const WATCHLIST_THRESHOLD_MIN = 0;
const WATCHLIST_THRESHOLD_MAX = 6;
const WATCHLIST_ENGAGEMENT_PHASE_MIN = 0;
const WATCHLIST_ENGAGEMENT_PHASE_MAX = 7;
const UUPG_FRONTIER_LOOKUP_KEYS = getFieldDefinitionCanonicalKeyLookupKeys(
  WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEY,
);

function normalizeDatasetColumnIdentity(value: string | null | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") ?? "";
}

function getFieldPresentationForDatasetColumn(input: {
  columns: DatasetSummary["columns"];
  fieldDefinitionPresentationByColumnKey: Record<string, FieldDefinitionPresentation>;
  lookupKeys: readonly string[];
  fallbackLabel: string;
}) {
  const normalizedLookupKeys = new Set(
    input.lookupKeys.map((key) => normalizeDatasetColumnIdentity(key)),
  );
  const matchingColumn =
    input.columns.find(
      (column) =>
        normalizedLookupKeys.has(normalizeDatasetColumnIdentity(column.key)) ||
        normalizedLookupKeys.has(normalizeDatasetColumnIdentity(column.label)),
    ) ?? null;
  const presentation = matchingColumn
    ? input.fieldDefinitionPresentationByColumnKey[matchingColumn.key]
    : null;

  return {
    definition: presentation?.definition ?? "",
    effectiveLabel:
      presentation?.effectiveLabel ?? matchingColumn?.label ?? input.fallbackLabel,
  };
}
const HOTSPOTS_COUNTRY_COUNT_MIN = 1;
const WATCHLIST_POPULATION_BELIEVERS_RULE_LABEL =
  "Population vs Evangelical Believers";

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

function clampHotspotsCountryCount(value: number) {
  return Math.min(
    MAX_HOTSPOTS_COUNTRY_COUNT,
    Math.max(HOTSPOTS_COUNTRY_COUNT_MIN, Math.round(value)),
  );
}

function dedupeCountryNames(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
}

function createRegionSelectionState(
  regions: FilterRegion[],
  selectedRegionIds: Record<string, boolean>,
) {
  return Object.fromEntries(
    regions.map((region) => [region.id, selectedRegionIds[region.id] ?? false]),
  );
}

function createRegionSelectionStateFromIds(
  regions: FilterRegion[],
  selectedRegionIds: string[],
) {
  const selectedRegionIdSet = new Set(selectedRegionIds);

  return Object.fromEntries(
    regions.map((region) => [region.id, selectedRegionIdSet.has(region.id)]),
  );
}

function getNextSelectedRegionIds(input: {
  regions: FilterRegion[];
  current: Record<string, boolean>;
  regionId: string;
  checked: boolean;
}) {
  const next = createRegionSelectionState(input.regions, input.current);
  const globalRegion =
    input.regions.find((region) => isGlobalRegionName(region.name)) ?? null;

  if (globalRegion && input.regionId === globalRegion.id) {
    if (!input.checked) {
      return next;
    }

    return Object.fromEntries(
      input.regions.map((region) => [region.id, region.id === globalRegion.id]),
    );
  }

  next[input.regionId] = input.checked;

  if (!globalRegion) {
    return next;
  }

  if (input.checked) {
    next[globalRegion.id] = false;
    return next;
  }

  const hasSelectedSpecificRegion = input.regions.some(
    (region) => region.id !== globalRegion.id && next[region.id],
  );

  if (!hasSelectedSpecificRegion) {
    next[globalRegion.id] = true;
  }

  return next;
}

export function DatasetDetailClient({
  dataset,
  sourceRowCount = null,
  regions,
  fieldDefinitionPresentationByColumnKey,
  initialFilters = null,
  initialSorting = null,
  assignableDatasets = [],
  actorOwnerId = "anonymous",
  workspaceRole = "anonymous",
  datasetSource = "dashboard",
  initialSavedTableId = null,
  initialSavedTableRowCount = null,
  initialSavedTableFilterSections = null,
}: DatasetDetailClientProps) {
  useDatasetPerfRenderTrace("DatasetDetailClient");
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
  const watchlistPopulationBelieversRuleDefinition = `Build a tiered minimum-believers rule by population. Actual believers are calculated as ${watchlistPopulationLabel} * (${watchlistPercentEvangelicalLabel} / 100), and the implied percentage is shown live for context.`;
  const uupgFieldPresentation = getFieldPresentationForDatasetColumn({
    columns: dataset.columns,
    fieldDefinitionPresentationByColumnKey,
    lookupKeys: [UUPG_DATASET_COLUMN_KEY],
    fallbackLabel: "Engage_Global_Engagement_Anywhere",
  });
  const uupgFieldLabel = uupgFieldPresentation.effectiveLabel;
  const uupgFieldDefinition = uupgFieldPresentation.definition;
  const uupgFrontierFieldPresentation = getFieldPresentationForDatasetColumn({
    columns: dataset.columns,
    fieldDefinitionPresentationByColumnKey,
    lookupKeys: UUPG_FRONTIER_LOOKUP_KEYS,
    fallbackLabel: "Christianity_Frontier_Group",
  });
  const uupgFrontierFieldLabel = uupgFrontierFieldPresentation.effectiveLabel;
  const uupgFrontierFieldDefinition = uupgFrontierFieldPresentation.definition;
  const supportsAlternateCountryFiltering =
    datasetSupportsAlternateCountryFiltering(dataset);
  const supportsCountryFiltering = datasetSupportsCountryFiltering(dataset);
  const supportsHotspotsFiltering = datasetSupportsHotspotsFiltering(dataset);
  const supportsRegionFiltering = datasetSupportsRegionFiltering(dataset);
  const supportsWatchlistFiltering = datasetSupportsWatchlistFiltering(dataset);
  const supportsUupgFiltering = datasetSupportsUupgFiltering(dataset);
  const visibleRegions = regions;
  const initialState = useMemo(
    () =>
      getInitialDatasetDetailState({
        dataset,
        regions: visibleRegions,
        initialFilters,
        initialSorting: initialSorting ?? undefined,
      }),
    [dataset, initialFilters, initialSorting, visibleRegions],
  );
  const [regionEnabled, setRegionEnabled] = useState(initialState.regionEnabled);
  const [selectedRegionIds, setSelectedRegionIds] = useState<Record<string, boolean>>(
    () => initialState.selectedRegionIds,
  );
  const [countryEnabled, setCountryEnabled] = useState(initialState.countryEnabled);
  const [selectedCountryNames, setSelectedCountryNames] = useState<string[]>(
    () => initialState.selectedCountryNames,
  );
  const [includeAlternateCountries, setIncludeAlternateCountries] = useState(
    initialState.includeAlternateCountries,
  );
  const [countrySearchValue, setCountrySearchValue] = useState("");
  const [watchlistEnabled, setWatchlistEnabled] = useState(
    initialState.watchlistEnabled,
  );
  const [watchlistThresholdEnabled, setWatchlistThresholdEnabled] = useState(
    initialState.watchlistThresholdEnabled,
  );
  const [
    watchlistPopulationBelieversRuleEnabled,
    setWatchlistPopulationBelieversRuleEnabled,
  ] = useState(initialState.watchlistPopulationBelieversRuleEnabled);
  const [watchlistEngagementPhaseEnabled, setWatchlistEngagementPhaseEnabled] =
    useState(initialState.watchlistEngagementPhaseEnabled);
  const [watchlistThreshold, setWatchlistThreshold] = useState(initialState.watchlistThreshold);
  const [watchlistEngagementPhaseThreshold, setWatchlistEngagementPhaseThreshold] =
    useState(initialState.watchlistEngagementPhaseThreshold);
  const [
    watchlistPopulationBelieversRule,
    setWatchlistPopulationBelieversRule,
  ] = useState(initialState.watchlistPopulationBelieversRule);
  const [uupgEnabled, setUupgEnabled] = useState(initialState.uupgEnabled);
  const [hotspotsEnabled, setHotspotsEnabled] = useState(
    initialState.hotspotsEnabled,
  );
  const [hotspotsMetric, setHotspotsMetric] = useState<DatasetHotspotsMetric>(
    initialState.hotspotsMetric,
  );
  const [hotspotsCountryCount, setHotspotsCountryCount] = useState(
    initialState.hotspotsCountryCount,
  );
  const [isFiltersSheetOpen, setIsFiltersSheetOpen] = useState(false);
  const [isAssignDerivedViewSheetOpen, setIsAssignDerivedViewSheetOpen] =
    useState(false);
  const analyticsContext = useMemo(
    () =>
      buildAnalyticsContext({
        route: "dataset_detail",
        actorOwnerId,
        workspaceRole,
      }),
    [actorOwnerId, workspaceRole],
  );
  const hasTrackedInitialFiltersRef = useRef(false);
  const datasetTableAnalytics = useMemo(
    () => ({
      context: analyticsContext,
      datasetSource,
    }),
    [analyticsContext, datasetSource],
  );
  const sourceDatasetId = dataset.backingDatasetId ?? dataset.id;

  const selectedRegionCountryNames = useMemo(
    () => getSelectedRegionCountryNames(visibleRegions, selectedRegionIds),
    [visibleRegions, selectedRegionIds],
  );
  const regionSelectors = useMemo(
    () =>
      visibleRegions.map((region) => ({
        id: region.id,
        label: region.name,
        checked: selectedRegionIds[region.id] ?? false,
        description: region.description,
        countries: region.countries,
      })),
    [visibleRegions, selectedRegionIds],
  );
  const regionFilter = useMemo(
    () => ({
      enabled: regionEnabled,
      isSupported: supportsRegionFiltering,
      hasConfiguredRegions: visibleRegions.length > 0,
      enabledCountryNames: selectedRegionCountryNames,
    }),
    [
      regionEnabled,
      selectedRegionCountryNames,
      supportsRegionFiltering,
      visibleRegions.length,
    ],
  );
  const countryFilter = useMemo(
    () => ({
      enabled: countryEnabled,
      isSupported: supportsCountryFiltering,
      selectedCountryNames,
      includeAlternateCountries,
    }),
    [
      countryEnabled,
      includeAlternateCountries,
      selectedCountryNames,
      supportsCountryFiltering,
    ],
  );
  const watchlistFilter = useMemo(
    () => ({
      enabled: watchlistEnabled,
      isSupported: supportsWatchlistFiltering,
      thresholdEnabled: watchlistThresholdEnabled,
      threshold: watchlistThreshold,
      engagementPhaseEnabled: watchlistEngagementPhaseEnabled,
      engagementPhaseThreshold: watchlistEngagementPhaseThreshold,
      evangelicalPopulationBelieversRuleEnabled:
        watchlistPopulationBelieversRuleEnabled,
      evangelicalPopulationBelieversRule: watchlistPopulationBelieversRule,
    }),
    [
      supportsWatchlistFiltering,
      watchlistEnabled,
      watchlistEngagementPhaseEnabled,
      watchlistEngagementPhaseThreshold,
      watchlistPopulationBelieversRule,
      watchlistPopulationBelieversRuleEnabled,
      watchlistThreshold,
      watchlistThresholdEnabled,
    ],
  );
  const uupgFilter = useMemo(
    () => ({
      enabled: uupgEnabled,
      isSupported: supportsUupgFiltering,
    }),
    [supportsUupgFiltering, uupgEnabled],
  );
  const hotspotsFilter = useMemo(
    () => ({
      enabled: hotspotsEnabled,
      isSupported: supportsHotspotsFiltering,
      metric: hotspotsMetric,
      countryCount: hotspotsCountryCount,
    }),
    [
      hotspotsCountryCount,
      hotspotsEnabled,
      hotspotsMetric,
      supportsHotspotsFiltering,
    ],
  );
  const datasetTable = useDatasetTableState({
    dataset,
    sourceRowCount,
    initialSorting: initialState.sorting,
    fieldDefinitionPresentationByColumnKey,
    regionFilter,
    countryFilter,
    watchlistFilter,
    hotspotsFilter,
    uupgFilter,
    analytics: datasetTableAnalytics,
  });
  const effectiveCountrySelection = useMemo(
    () =>
      getEffectiveCountrySelection({
        availableCountryNames: datasetTable.availableCountryNames,
        countryFilterEnabled: countryEnabled,
        regionFilterEnabled: regionEnabled,
        regionCountryNames: selectedRegionCountryNames,
        selectedCountryNames,
      }),
    [
      countryEnabled,
      datasetTable.availableCountryNames,
      regionEnabled,
      selectedCountryNames,
      selectedRegionCountryNames,
    ],
  );
  const savedFilters = useMemo(
    () =>
      buildSavedDatasetFilterState({
        regions: visibleRegions,
        selectedRegionIds,
        regionEnabled,
        countryEnabled,
        selectedCountryNames,
        includeAlternateCountries,
        watchlistEnabled,
        watchlistThresholdEnabled,
        watchlistThreshold,
        watchlistEngagementPhaseEnabled,
        watchlistEngagementPhaseThreshold,
        watchlistPopulationBelieversRuleEnabled,
        watchlistPopulationBelieversRule,
        uupgEnabled,
        hotspotsEnabled,
        hotspotsMetric,
        hotspotsCountryCount,
        sorting: datasetTable.sorting as SavedDatasetSort[],
      }),
    [
      datasetTable.sorting,
      countryEnabled,
      includeAlternateCountries,
      regionEnabled,
      selectedCountryNames,
      visibleRegions,
      selectedRegionIds,
      hotspotsCountryCount,
      hotspotsEnabled,
      hotspotsMetric,
      uupgEnabled,
      watchlistEngagementPhaseEnabled,
      watchlistEnabled,
      watchlistPopulationBelieversRuleEnabled,
      watchlistThresholdEnabled,
      watchlistEngagementPhaseThreshold,
      watchlistPopulationBelieversRule,
      watchlistThreshold,
    ],
  );
  useEffect(() => {
    const allowedCountryNames = new Set(datasetTable.availableCountryNames);
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }

      setSelectedCountryNames((current) => {
        const next = current.filter((countryName) =>
          allowedCountryNames.has(countryName),
        );

        return next.length === current.length ? current : next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [datasetTable.availableCountryNames]);

  const applyCountrySelection = useCallback(
    (nextCountryNames: string[]) => {
      const normalizedCountryNames = dedupeCountryNames(nextCountryNames);
      const matchedRegionIds = getMatchingRegionIdsForCountries(
        visibleRegions,
        normalizedCountryNames,
        datasetTable.datasetCountryNames,
      );

      setCountryEnabled(true);
      setSelectedCountryNames(normalizedCountryNames);
      setSelectedRegionIds(
        createRegionSelectionStateFromIds(visibleRegions, matchedRegionIds),
      );
      setRegionEnabled(matchedRegionIds.length > 0);
    },
    [datasetTable.datasetCountryNames, visibleRegions],
  );

  const handleRegionSelectorChange = useCallback(
    (regionId: string, checked: boolean) => {
      const nextSelectedRegionIds = getNextSelectedRegionIds({
        regions: visibleRegions,
        current: selectedRegionIds,
        regionId,
        checked,
      });
      const nextSelectedCountryNames = getSelectedRegionCountryNames(
        visibleRegions,
        nextSelectedRegionIds,
      );

      setSelectedRegionIds(nextSelectedRegionIds);
      setRegionEnabled(nextSelectedCountryNames.length > 0);
      setSelectedCountryNames(nextSelectedCountryNames);
    },
    [selectedRegionIds, visibleRegions],
  );
  const handleWatchlistThresholdChange = useCallback(
    (value: number) => setWatchlistThreshold(clampWatchlistThreshold(value)),
    [],
  );
  const handleWatchlistEngagementPhaseThresholdChange = useCallback(
    (value: number) =>
      setWatchlistEngagementPhaseThreshold(
        clampWatchlistEngagementPhaseThreshold(value),
      ),
    [],
  );
  const handleWatchlistPopulationBelieversRuleChange = useCallback(
    (value: typeof watchlistPopulationBelieversRule) =>
      setWatchlistPopulationBelieversRule(sanitizePopulationBelieversRule(value)),
    [],
  );
  const handleHotspotsMetricChange = useCallback(
    (value: DatasetHotspotsMetric) => setHotspotsMetric(value),
    [],
  );
  const handleHotspotsCountryCountChange = useCallback(
    (value: number) =>
      setHotspotsCountryCount(clampHotspotsCountryCount(value)),
    [],
  );
  const handleCountryToggle = useCallback(
    (countryName: string, checked: boolean) =>
      applyCountrySelection(
        checked
          ? [...effectiveCountrySelection.selectedCountryNames, countryName]
          : effectiveCountrySelection.selectedCountryNames.filter(
              (value) => value !== countryName,
            ),
      ),
    [applyCountrySelection, effectiveCountrySelection.selectedCountryNames],
  );
  const handleSelectVisibleCountries = useCallback(
    (countryNames: string[]) =>
      applyCountrySelection([
        ...effectiveCountrySelection.selectedCountryNames,
        ...countryNames,
      ]),
    [applyCountrySelection, effectiveCountrySelection.selectedCountryNames],
  );
  const handleClearVisibleCountries = useCallback(
    (countryNames: string[]) => {
      const countryNamesToClear = new Set(countryNames);
      applyCountrySelection(
        effectiveCountrySelection.selectedCountryNames.filter(
          (countryName) => !countryNamesToClear.has(countryName),
        ),
      );
    },
    [applyCountrySelection, effectiveCountrySelection.selectedCountryNames],
  );
  const handleOpenFilters = useCallback(() => {
    setIsFiltersSheetOpen(true);
  }, []);
  const handleOpenAssignDerivedView = useCallback(() => {
    setIsAssignDerivedViewSheetOpen(true);
  }, []);

  useEffect(() => {
    trackAppEvent(
      "dataset_opened",
      withAnalyticsContext(analyticsContext, {
        source_surface: "dataset_detail_page",
        success: true,
        dataset_id: dataset.id,
        dataset_source: datasetSource,
      }),
    );
  }, [analyticsContext, dataset.id, datasetSource]);

  useEffect(() => {
    if (initialSavedTableId && initialSavedTableRowCount !== null) {
      trackAppEvent(
        "saved_table_opened",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_detail_page",
          success: true,
          dataset_id: dataset.id,
          saved_table_id: initialSavedTableId,
          saved_row_count: initialSavedTableRowCount,
          filter_sections_enabled: initialSavedTableFilterSections
            ? getEnabledFilterSections(initialSavedTableFilterSections)
            : "none",
        }),
      );
    }
  }, [
    analyticsContext,
    dataset.id,
    initialSavedTableFilterSections,
    initialSavedTableId,
    initialSavedTableRowCount,
  ]);

  const filterSnapshotKey = useMemo(
    () =>
      JSON.stringify({
        regionEnabled,
        selectedRegionIds,
        countryEnabled,
        selectedCountryNames,
        includeAlternateCountries,
        watchlistEnabled,
        watchlistThresholdEnabled,
        watchlistThreshold,
        watchlistEngagementPhaseEnabled,
        watchlistEngagementPhaseThreshold,
        watchlistPopulationBelieversRuleEnabled,
        watchlistPopulationBelieversRule,
        uupgEnabled,
        hotspotsEnabled,
        hotspotsMetric,
        hotspotsCountryCount,
        sorting: datasetTable.sorting,
      }),
    [
      countryEnabled,
      includeAlternateCountries,
      datasetTable.sorting,
      regionEnabled,
      selectedCountryNames,
      selectedRegionIds,
      hotspotsCountryCount,
      hotspotsEnabled,
      hotspotsMetric,
      uupgEnabled,
      watchlistEnabled,
      watchlistEngagementPhaseEnabled,
      watchlistEngagementPhaseThreshold,
      watchlistPopulationBelieversRuleEnabled,
      watchlistPopulationBelieversRule,
      watchlistThreshold,
      watchlistThresholdEnabled,
    ],
  );

  useEffect(() => {
    if (datasetTable.isLoading || datasetTable.error) {
      return;
    }

    if (!hasTrackedInitialFiltersRef.current) {
      hasTrackedInitialFiltersRef.current = true;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      trackAppEvent(
        "dataset_filters_applied",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_filters",
          success: true,
          dataset_id: dataset.id,
          result_count: datasetTable.recordCount,
          region_enabled: regionEnabled,
          region_count: Object.values(selectedRegionIds).filter(Boolean).length,
          country_enabled: countryEnabled,
          country_count: effectiveCountrySelection.hasExplicitSelection
            ? effectiveCountrySelection.selectedCountryNames.length
            : 0,
          watchlist_enabled: watchlistEnabled,
          watchlist_threshold_enabled: watchlistThresholdEnabled,
          watchlist_threshold: watchlistThresholdEnabled
            ? watchlistThreshold
            : null,
          watchlist_population_believers_rule_enabled:
            watchlistPopulationBelieversRuleEnabled,
          watchlist_population_believers_rule_tier_count:
            watchlistPopulationBelieversRuleEnabled
              ? watchlistPopulationBelieversRule.tiers.length
              : null,
          watchlist_engagement_phase_enabled: watchlistEngagementPhaseEnabled,
          watchlist_engagement_phase_threshold: watchlistEngagementPhaseEnabled
            ? watchlistEngagementPhaseThreshold
            : null,
          uupg_enabled: uupgEnabled,
          hotspots_enabled: hotspotsEnabled,
          hotspots_metric: hotspotsEnabled ? hotspotsMetric : null,
          hotspots_country_count: hotspotsEnabled ? hotspotsCountryCount : null,
          sorting_count: savedFilters.sorting.length,
          sorting_keys: getSortingKeys(savedFilters.sorting),
        }),
      );
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [
    analyticsContext,
    countryEnabled,
    dataset.id,
    datasetTable.error,
    datasetTable.isLoading,
    datasetTable.recordCount,
    filterSnapshotKey,
    regionEnabled,
    savedFilters.sorting,
    effectiveCountrySelection.hasExplicitSelection,
    effectiveCountrySelection.selectedCountryNames.length,
    selectedCountryNames.length,
    selectedRegionIds,
    hotspotsCountryCount,
    hotspotsEnabled,
    hotspotsMetric,
    uupgEnabled,
    watchlistEnabled,
    watchlistEngagementPhaseEnabled,
    watchlistEngagementPhaseThreshold,
    watchlistPopulationBelieversRuleEnabled,
    watchlistPopulationBelieversRule,
    watchlistThreshold,
    watchlistThresholdEnabled,
  ]);

  const filterPanelProps = useMemo<Parameters<typeof DatasetViewSwitchGrid>[0]>(
    () => ({
      regionCard: {
        supported: supportsRegionFiltering,
        selectors: regionSelectors,
        onSelectorChange: handleRegionSelectorChange,
      },
      countryCard: {
        enabled: countryEnabled,
        supported: supportsCountryFiltering,
        searchValue: countrySearchValue,
        availableCountries: datasetTable.availableCountryNames,
        visibleCountries: datasetTable.availableCountryNames,
        selectedCountries: effectiveCountrySelection.selectedCountryNames,
        hasExplicitSelection: effectiveCountrySelection.hasExplicitSelection,
        includeAlternateCountries,
        supportsAlternateCountries: supportsAlternateCountryFiltering,
        onEnabledChange: setCountryEnabled,
        onIncludeAlternateCountriesChange: setIncludeAlternateCountries,
        onSearchChange: setCountrySearchValue,
        onToggleCountry: handleCountryToggle,
        onSelectVisible: handleSelectVisibleCountries,
        onClearVisible: handleClearVisibleCountries,
      },
      watchlistCard: {
        enabled: watchlistEnabled,
        supported: supportsWatchlistFiltering,
        thresholdLabel: watchlistThresholdLabel,
        thresholdDefinition: watchlistThresholdDefinition,
        thresholdEnabled: watchlistThresholdEnabled,
        threshold: watchlistThreshold,
        minThreshold: WATCHLIST_THRESHOLD_MIN,
        maxThreshold: WATCHLIST_THRESHOLD_MAX,
        engagementPhaseLabel: watchlistEngagementPhaseLabel,
        engagementPhaseDefinition: watchlistEngagementPhaseDefinition,
        engagementPhaseEnabled: watchlistEngagementPhaseEnabled,
        engagementPhaseThreshold: watchlistEngagementPhaseThreshold,
        minEngagementPhaseThreshold: WATCHLIST_ENGAGEMENT_PHASE_MIN,
        maxEngagementPhaseThreshold: WATCHLIST_ENGAGEMENT_PHASE_MAX,
        populationBelieversRuleLabel: WATCHLIST_POPULATION_BELIEVERS_RULE_LABEL,
        populationBelieversRuleDefinition:
          watchlistPopulationBelieversRuleDefinition,
        populationBelieversRuleEnabled:
          watchlistPopulationBelieversRuleEnabled,
        populationBelieversRule: watchlistPopulationBelieversRule,
        onEnabledChange: setWatchlistEnabled,
        onThresholdEnabledChange: setWatchlistThresholdEnabled,
        onThresholdChange: handleWatchlistThresholdChange,
        onEngagementPhaseEnabledChange: setWatchlistEngagementPhaseEnabled,
        onEngagementPhaseThresholdChange:
          handleWatchlistEngagementPhaseThresholdChange,
        onPopulationBelieversRuleEnabledChange:
          setWatchlistPopulationBelieversRuleEnabled,
        onPopulationBelieversRuleChange:
          handleWatchlistPopulationBelieversRuleChange,
      },
      uupgCard: {
        enabled: uupgEnabled,
        supported: supportsUupgFiltering,
        fields: [
          {
            label: uupgFieldLabel,
            definition: uupgFieldDefinition,
          },
          {
            label: uupgFrontierFieldLabel,
            definition: uupgFrontierFieldDefinition,
          },
        ],
        onEnabledChange: setUupgEnabled,
      },
      hotspotsCard: {
        enabled: hotspotsEnabled,
        supported: supportsHotspotsFiltering,
        metric: hotspotsMetric,
        countryCount: hotspotsCountryCount,
        minCountryCount: HOTSPOTS_COUNTRY_COUNT_MIN,
        maxCountryCount: MAX_HOTSPOTS_COUNTRY_COUNT,
        onEnabledChange: setHotspotsEnabled,
        onMetricChange: handleHotspotsMetricChange,
        onCountryCountChange: handleHotspotsCountryCountChange,
      },
    }),
    [
      countryEnabled,
      countrySearchValue,
      datasetTable.availableCountryNames,
      effectiveCountrySelection.hasExplicitSelection,
      effectiveCountrySelection.selectedCountryNames,
      handleClearVisibleCountries,
      handleCountryToggle,
      handleHotspotsCountryCountChange,
      handleHotspotsMetricChange,
      handleRegionSelectorChange,
      handleSelectVisibleCountries,
      handleWatchlistEngagementPhaseThresholdChange,
      handleWatchlistPopulationBelieversRuleChange,
      handleWatchlistThresholdChange,
      hotspotsCountryCount,
      hotspotsEnabled,
      hotspotsMetric,
      includeAlternateCountries,
      regionSelectors,
      supportsAlternateCountryFiltering,
      supportsCountryFiltering,
      supportsHotspotsFiltering,
      supportsRegionFiltering,
      supportsUupgFiltering,
      supportsWatchlistFiltering,
      uupgEnabled,
      uupgFieldDefinition,
      uupgFieldLabel,
      uupgFrontierFieldDefinition,
      uupgFrontierFieldLabel,
      watchlistEnabled,
      watchlistEngagementPhaseDefinition,
      watchlistEngagementPhaseEnabled,
      watchlistEngagementPhaseLabel,
      watchlistEngagementPhaseThreshold,
      watchlistPopulationBelieversRule,
      watchlistPopulationBelieversRuleDefinition,
      watchlistPopulationBelieversRuleEnabled,
      watchlistThreshold,
      watchlistThresholdDefinition,
      watchlistThresholdEnabled,
      watchlistThresholdLabel,
    ],
  );

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
            getSortedRows={datasetTable.getSortedRows}
            visibleColumns={datasetTable.visibleColumns}
            isLoading={datasetTable.isLoading}
            hasError={Boolean(dataset.error || datasetTable.error)}
            fieldDefinitionPresentationByColumnKey={fieldDefinitionPresentationByColumnKey}
            analyticsContext={analyticsContext}
            onOpenFilters={handleOpenFilters}
            onOpenAssignDerivedView={
              assignableDatasets.length > 0
                ? handleOpenAssignDerivedView
                : undefined
            }
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
      {assignableDatasets.length > 0 ? (
        <DatasetAssignDerivedViewSheet
          open={isAssignDerivedViewSheetOpen}
          onOpenChange={setIsAssignDerivedViewSheetOpen}
          currentDataset={dataset}
          sourceDatasetId={sourceDatasetId}
          filters={savedFilters}
          recordCount={datasetTable.recordCount}
          assignableDatasets={assignableDatasets}
          analyticsContext={analyticsContext}
        />
      ) : null}
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
