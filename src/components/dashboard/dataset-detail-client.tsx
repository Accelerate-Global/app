"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DatasetAssignDerivedViewSheet } from "@/components/dashboard/dataset-assign-derived-view-sheet";
import type { DatasetMapTableScopeRequest } from "@/components/dashboard/dataset-map-view";
import { DatasetRecordProfileSheet } from "@/components/dashboard/dataset-record-profile-sheet";
import { DatasetTableActionBar } from "@/components/dashboard/dataset-table-action-bar";
import { DatasetTable } from "@/components/dashboard/dataset-table";
import { DatasetViewSwitchGrid } from "@/components/dashboard/dataset-view-switch-grid";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDatasetTableState } from "@/components/dashboard/use-dataset-table-state";
import type {
  SavedDatasetFilterState,
  DatasetSummary,
  FieldDefinitionPresentation,
  FilterRegion,
  DatasetHotspotsMetric,
  SavedDatasetSort,
  DatasetRowsResponse,
  WatchlistEngagementPhaseRule,
  WatchlistJpOnlyEvangelicalRule,
} from "@/lib/api-types";
import {
  UUPG_DATASET_COLUMN_KEY,
  WATCHLIST_DATASET_COLUMN_KEY,
  WATCHLIST_ENGAGEMENT_PHASES_DATASET_COLUMN_KEY,
  WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEY,
} from "@/lib/dataset-region-constants";
import {
  MAX_HOTSPOTS_COUNTRY_COUNT,
  type DatasetFilterSections,
  getDatasetFilterSectionSupport,
  getEffectiveCountrySelection,
  getMatchingRegionIdsForCountries,
  getSelectedRegionCountryNames,
  normalizeDatasetUupgCriteriaState,
} from "@/lib/dataset-filtering";
import { getFieldDefinitionCanonicalKeyLookupKeys } from "@/lib/field-definition-canonical";
import { isGlobalRegionName } from "@/lib/region-display";
import { getInitialDatasetDetailState } from "@/components/dashboard/dataset-detail-initial-state";
import {
  buildSavedDatasetFilterState,
  WATCHLIST_FIXED_THRESHOLD,
} from "@/lib/saved-dataset-filters";
import { useDatasetPerfRenderTrace } from "@/lib/render-trace";
import type { WorkspaceRole } from "@/lib/workspace-role";
import {
  appendWatchlistEngagementPhaseDefinition,
  formatWatchlistEngagementPhaseSummary,
  getDefaultWatchlistEngagementPhaseRule,
  isWatchlistEngagementPhaseRuleDefault,
  normalizeWatchlistEngagementPhaseRule,
} from "@/lib/watchlist-engagement-phase";
import {
  WATCHLIST_JP_ONLY_EVANGELICAL_LABEL,
  formatWatchlistJpOnlyEvangelicalSummary,
  getDefaultWatchlistJpOnlyEvangelicalRule,
  getWatchlistJpOnlyEvangelicalDefinition,
  isWatchlistJpOnlyEvangelicalRuleDefault,
  normalizeWatchlistJpOnlyEvangelicalRule,
} from "@/lib/watchlist-jp-only-evangelical";
import {
  ListFilterIcon,
  MapPinnedIcon,
  TablePropertiesIcon,
  XIcon,
} from "lucide-react";

type DatasetDetailClientProps = {
  dataset: DatasetSummary;
  sourceRowCount?: number | null;
  regions: FilterRegion[];
  fieldDefinitionPresentationByColumnKey: Record<
    string,
    FieldDefinitionPresentation
  >;
  initialFilters?: SavedDatasetFilterState | null;
  initialSorting?: SavedDatasetSort[] | null;
  assignableDatasets?: DatasetSummary[];
  workspaceRole?: WorkspaceRole;
  toolbarAction?: ReactNode;
  canAskQwenAboutView?: boolean;
};

type DatasetDetailViewMode = "table" | "map";
type DatasetRow = DatasetRowsResponse["rows"][number];

const LazyDatasetMapView = lazy(() =>
  import("@/components/dashboard/dataset-map-view").then((module) => ({
    default: module.DatasetMapView,
  })),
);

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
  workspaceRole = "pro",
  toolbarAction = null,
  canAskQwenAboutView = false,
}: DatasetDetailClientProps) {
  useDatasetPerfRenderTrace("DatasetDetailClient");
  const watchlistThresholdDefinition =
    fieldDefinitionPresentationByColumnKey[WATCHLIST_DATASET_COLUMN_KEY]
      ?.definition ?? "";
  const watchlistEngagementPhaseLabel =
    fieldDefinitionPresentationByColumnKey[
      WATCHLIST_ENGAGEMENT_PHASES_DATASET_COLUMN_KEY
    ]?.effectiveLabel ?? "Engage_8_Phases_of_Engagement";
  const watchlistEngagementPhaseBaseDefinition =
    fieldDefinitionPresentationByColumnKey[
      WATCHLIST_ENGAGEMENT_PHASES_DATASET_COLUMN_KEY
    ]?.definition ?? "";
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
  const sectionSupport = useMemo(
    () => getDatasetFilterSectionSupport(dataset),
    [dataset],
  );
  const supportsAlternateCountryFiltering = sectionSupport.alternateCountry;
  const supportsCountryFiltering = sectionSupport.country;
  const supportsHotspotsFiltering = sectionSupport.hotspots;
  const supportsRegionFiltering = sectionSupport.region;
  const supportsWatchlistFiltering = sectionSupport.watchlist;
  const supportsWatchlistJpOnlyFiltering = sectionSupport.watchlistJpOnly;
  const supportsUupgFiltering = sectionSupport.uupg;
  const supportsUupgFrontierFiltering = sectionSupport.uupgFrontier;
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
  const [watchlistThreshold, setWatchlistThreshold] = useState(
    initialState.watchlistThreshold,
  );
  const [watchlistEngagementPhaseEnabled, setWatchlistEngagementPhaseEnabled] =
    useState(initialState.watchlistEngagementPhaseEnabled);
  const [
    watchlistEngagementPhaseRule,
    setWatchlistEngagementPhaseRule,
  ] = useState<WatchlistEngagementPhaseRule>(
    initialState.watchlistEngagementPhaseRule,
  );
  const watchlistEngagementPhaseThreshold =
    watchlistEngagementPhaseRule.maxPhase;
  const [
    watchlistJpOnlyEvangelicalCriteriaEnabled,
    setWatchlistJpOnlyEvangelicalCriteriaEnabled,
  ] = useState(initialState.watchlistJpOnlyEvangelicalCriteriaEnabled);
  const [
    watchlistJpOnlyEvangelicalRule,
    setWatchlistJpOnlyEvangelicalRule,
  ] = useState<WatchlistJpOnlyEvangelicalRule>(
    initialState.watchlistJpOnlyEvangelicalRule,
  );
  const [uupgEnabled, setUupgEnabled] = useState(initialState.uupgEnabled);
  const [
    uupgGlobalEngagementAnywhereEnabled,
    setUupgGlobalEngagementAnywhereEnabled,
  ] = useState(initialState.uupgGlobalEngagementAnywhereEnabled);
  const [uupgFrontierGroupEnabled, setUupgFrontierGroupEnabled] = useState(
    initialState.uupgFrontierGroupEnabled,
  );
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
  const [viewMode, setViewMode] = useState<DatasetDetailViewMode>("table");
  const [temporaryTableScope, setTemporaryTableScope] =
    useState<DatasetMapTableScopeRequest | null>(null);
  const [profileRow, setProfileRow] = useState<DatasetRow | null>(null);
  const canSaveFilteredTable = workspaceRole !== "basic";
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
  const watchlistJpOnlyEvangelicalDefinition = useMemo(
    () => getWatchlistJpOnlyEvangelicalDefinition(watchlistJpOnlyEvangelicalRule),
    [watchlistJpOnlyEvangelicalRule],
  );
  const watchlistJpOnlyEvangelicalSummary = useMemo(
    () => formatWatchlistJpOnlyEvangelicalSummary(watchlistJpOnlyEvangelicalRule),
    [watchlistJpOnlyEvangelicalRule],
  );
  const watchlistEngagementPhaseDefinition = useMemo(
    () =>
      appendWatchlistEngagementPhaseDefinition(
        watchlistEngagementPhaseBaseDefinition,
        watchlistEngagementPhaseRule,
      ),
    [watchlistEngagementPhaseBaseDefinition, watchlistEngagementPhaseRule],
  );
  const watchlistEngagementPhaseSummary = useMemo(
    () =>
      formatWatchlistEngagementPhaseSummary(
        watchlistEngagementPhaseLabel,
        watchlistEngagementPhaseRule,
      ),
    [watchlistEngagementPhaseLabel, watchlistEngagementPhaseRule],
  );
  const watchlistFilter = useMemo(
    () => ({
      enabled: watchlistEnabled,
      isSupported: supportsWatchlistFiltering,
      thresholdEnabled: watchlistThresholdEnabled,
      threshold: watchlistThreshold,
      engagementPhaseEnabled: watchlistEngagementPhaseEnabled,
      engagementPhaseThreshold: watchlistEngagementPhaseThreshold,
      engagementPhaseRule: watchlistEngagementPhaseRule,
      jpOnlyEvangelicalCriteriaEnabled:
        watchlistJpOnlyEvangelicalCriteriaEnabled,
      jpOnlyEvangelicalRule: watchlistJpOnlyEvangelicalRule,
    }),
    [
      supportsWatchlistFiltering,
      watchlistEnabled,
      watchlistEngagementPhaseEnabled,
      watchlistEngagementPhaseRule,
      watchlistEngagementPhaseThreshold,
      watchlistJpOnlyEvangelicalCriteriaEnabled,
      watchlistJpOnlyEvangelicalRule,
      watchlistThreshold,
      watchlistThresholdEnabled,
    ],
  );
  const normalizedUupgCriteria = useMemo(
    () =>
      normalizeDatasetUupgCriteriaState({
        globalEngagementAnywhereEnabled: uupgGlobalEngagementAnywhereEnabled,
        frontierGroupEnabled: uupgFrontierGroupEnabled,
        frontierGroupSupported: supportsUupgFrontierFiltering,
      }),
    [
      supportsUupgFrontierFiltering,
      uupgFrontierGroupEnabled,
      uupgGlobalEngagementAnywhereEnabled,
    ],
  );
  const uupgFilter = useMemo(
    () => ({
      enabled: uupgEnabled,
      isSupported: supportsUupgFiltering,
      globalEngagementAnywhereEnabled:
        normalizedUupgCriteria.globalEngagementAnywhereEnabled,
      frontierGroupEnabled: normalizedUupgCriteria.frontierGroupEnabled,
      frontierGroupSupported: normalizedUupgCriteria.frontierGroupSupported,
    }),
    [normalizedUupgCriteria, supportsUupgFiltering, uupgEnabled],
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
  const filterSections = useMemo<DatasetFilterSections>(
    () => ({
      region: regionFilter,
      country: countryFilter,
      watchlist: watchlistFilter,
      uupg: uupgFilter,
      hotspots: hotspotsFilter,
    }),
    [countryFilter, hotspotsFilter, regionFilter, uupgFilter, watchlistFilter],
  );
  const datasetTable = useDatasetTableState({
    dataset,
    sourceRowCount,
    initialSorting: initialState.sorting,
    fieldDefinitionPresentationByColumnKey,
    filterSections,
    temporaryRowIds: temporaryTableScope?.rowIds ?? null,
  });
  const handleViewRowsInTable = useCallback(
    (scope: DatasetMapTableScopeRequest) => {
      setTemporaryTableScope(scope);
      setViewMode("table");
    },
    [],
  );
  const handleOpenRecord = useCallback(
    (rowId: string) => {
      const row = datasetTable.filteredRows.find((candidate) => candidate.id === rowId);
      if (row) {
        setProfileRow(row);
      }
    },
    [datasetTable.filteredRows],
  );
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
  const resetWatchlistJpOnlyEvangelicalRule = useCallback(() => {
    setWatchlistJpOnlyEvangelicalRule(getDefaultWatchlistJpOnlyEvangelicalRule());
  }, []);
  const resetWatchlistThreshold = useCallback(() => {
    setWatchlistThreshold(WATCHLIST_FIXED_THRESHOLD);
  }, []);
  const resetWatchlistEngagementPhaseRule = useCallback(() => {
    setWatchlistEngagementPhaseRule(getDefaultWatchlistEngagementPhaseRule());
  }, []);
  const handleWatchlistThresholdChange = useCallback((value: number) => {
    setWatchlistThreshold(value);
  }, []);
  const handleWatchlistEngagementPhaseRuleChange = useCallback(
    (rule: WatchlistEngagementPhaseRule) => {
      setWatchlistEngagementPhaseRule(
        normalizeWatchlistEngagementPhaseRule(rule),
      );
    },
    [],
  );
  const handleWatchlistJpOnlyEvangelicalRuleChange = useCallback(
    (rule: WatchlistJpOnlyEvangelicalRule) => {
      setWatchlistJpOnlyEvangelicalRule(
        normalizeWatchlistJpOnlyEvangelicalRule(rule),
      );
    },
    [],
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
        watchlistEngagementPhaseRule,
        watchlistJpOnlyEvangelicalCriteriaEnabled,
        watchlistJpOnlyEvangelicalRule,
        uupgEnabled,
        uupgGlobalEngagementAnywhereEnabled:
          normalizedUupgCriteria.globalEngagementAnywhereEnabled,
        uupgFrontierGroupEnabled: normalizedUupgCriteria.frontierGroupEnabled,
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
      normalizedUupgCriteria,
      uupgEnabled,
      watchlistEnabled,
      watchlistEngagementPhaseEnabled,
      watchlistEngagementPhaseRule,
      watchlistEngagementPhaseThreshold,
      watchlistJpOnlyEvangelicalCriteriaEnabled,
      watchlistJpOnlyEvangelicalRule,
      watchlistThresholdEnabled,
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
  const handleHotspotsMetricChange = useCallback(
    (value: DatasetHotspotsMetric) => setHotspotsMetric(value),
    [],
  );
  const handleHotspotsCountryCountChange = useCallback(
    (value: number) =>
      setHotspotsCountryCount(clampHotspotsCountryCount(value)),
    [],
  );
  const handleUupgEnabledChange = useCallback(
    (checked: boolean) => {
      setUupgEnabled(checked);

      if (!checked) {
        return;
      }

      const nextCriteria = normalizeDatasetUupgCriteriaState({
        globalEngagementAnywhereEnabled: uupgGlobalEngagementAnywhereEnabled,
        frontierGroupEnabled: uupgFrontierGroupEnabled,
        frontierGroupSupported: supportsUupgFrontierFiltering,
      });

      setUupgGlobalEngagementAnywhereEnabled(
        nextCriteria.globalEngagementAnywhereEnabled,
      );
      setUupgFrontierGroupEnabled(nextCriteria.frontierGroupEnabled);
    },
    [
      supportsUupgFrontierFiltering,
      uupgFrontierGroupEnabled,
      uupgGlobalEngagementAnywhereEnabled,
    ],
  );
  const handleUupgGlobalEngagementAnywhereEnabledChange = useCallback(
    (checked: boolean) => {
      if (
        uupgEnabled &&
        !checked &&
        !normalizedUupgCriteria.frontierGroupEnabled
      ) {
        return;
      }

      setUupgGlobalEngagementAnywhereEnabled(checked);
    },
    [normalizedUupgCriteria.frontierGroupEnabled, uupgEnabled],
  );
  const handleUupgFrontierGroupEnabledChange = useCallback(
    (checked: boolean) => {
      if (
        uupgEnabled &&
        !checked &&
        !normalizedUupgCriteria.globalEngagementAnywhereEnabled
      ) {
        return;
      }

      setUupgFrontierGroupEnabled(checked);
    },
    [normalizedUupgCriteria.globalEngagementAnywhereEnabled, uupgEnabled],
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
        thresholdDefinition: watchlistThresholdDefinition,
        thresholdEnabled: watchlistThresholdEnabled,
        threshold: watchlistThreshold,
        thresholdIsDefault:
          watchlistThreshold === WATCHLIST_FIXED_THRESHOLD,
        jpOnlyEvangelicalCriteriaEnabled:
          watchlistJpOnlyEvangelicalCriteriaEnabled,
        jpOnlyEvangelicalCriteriaSupported: supportsWatchlistJpOnlyFiltering,
        jpOnlyEvangelicalCriteriaLabel: WATCHLIST_JP_ONLY_EVANGELICAL_LABEL,
        jpOnlyEvangelicalCriteriaDefinition:
          watchlistJpOnlyEvangelicalDefinition,
        jpOnlyEvangelicalCriteriaSummary: watchlistJpOnlyEvangelicalSummary,
        jpOnlyEvangelicalRule: watchlistJpOnlyEvangelicalRule,
        jpOnlyEvangelicalRuleIsDefault:
          isWatchlistJpOnlyEvangelicalRuleDefault(
            watchlistJpOnlyEvangelicalRule,
          ),
        engagementPhaseEnabled: watchlistEngagementPhaseEnabled,
        engagementPhaseLabel: watchlistEngagementPhaseLabel,
        engagementPhaseDefinition: watchlistEngagementPhaseDefinition,
        engagementPhaseRule: watchlistEngagementPhaseRule,
        engagementPhaseRuleIsDefault:
          isWatchlistEngagementPhaseRuleDefault(watchlistEngagementPhaseRule),
        engagementPhaseSummary: watchlistEngagementPhaseSummary,
        onEnabledChange: setWatchlistEnabled,
        onThresholdEnabledChange: setWatchlistThresholdEnabled,
        onThresholdChange: handleWatchlistThresholdChange,
        onThresholdReset: resetWatchlistThreshold,
        onEngagementPhaseEnabledChange: setWatchlistEngagementPhaseEnabled,
        onEngagementPhaseRuleChange: handleWatchlistEngagementPhaseRuleChange,
        onEngagementPhaseRuleReset: resetWatchlistEngagementPhaseRule,
        onJpOnlyEvangelicalCriteriaEnabledChange:
          setWatchlistJpOnlyEvangelicalCriteriaEnabled,
        onJpOnlyEvangelicalRuleChange: handleWatchlistJpOnlyEvangelicalRuleChange,
        onJpOnlyEvangelicalRuleReset: resetWatchlistJpOnlyEvangelicalRule,
      },
      uupgCard: {
        enabled: uupgEnabled,
        supported: supportsUupgFiltering,
        globalEngagementAnywhereLabel: uupgFieldLabel,
        globalEngagementAnywhereDefinition: uupgFieldDefinition,
        globalEngagementAnywhereEnabled:
          normalizedUupgCriteria.globalEngagementAnywhereEnabled,
        frontierGroupSupported: supportsUupgFrontierFiltering,
        frontierGroupLabel: uupgFrontierFieldLabel,
        frontierGroupDefinition: uupgFrontierFieldDefinition,
        frontierGroupEnabled: normalizedUupgCriteria.frontierGroupEnabled,
        onEnabledChange: handleUupgEnabledChange,
        onGlobalEngagementAnywhereEnabledChange:
          handleUupgGlobalEngagementAnywhereEnabledChange,
        onFrontierGroupEnabledChange: handleUupgFrontierGroupEnabledChange,
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
      handleUupgEnabledChange,
      handleUupgFrontierGroupEnabledChange,
      handleUupgGlobalEngagementAnywhereEnabledChange,
      handleWatchlistEngagementPhaseRuleChange,
      handleWatchlistJpOnlyEvangelicalRuleChange,
      handleWatchlistThresholdChange,
      resetWatchlistEngagementPhaseRule,
      resetWatchlistJpOnlyEvangelicalRule,
      resetWatchlistThreshold,
      hotspotsCountryCount,
      hotspotsEnabled,
      hotspotsMetric,
      includeAlternateCountries,
      normalizedUupgCriteria.frontierGroupEnabled,
      normalizedUupgCriteria.globalEngagementAnywhereEnabled,
      regionSelectors,
      supportsAlternateCountryFiltering,
      supportsCountryFiltering,
      supportsHotspotsFiltering,
      supportsRegionFiltering,
      supportsUupgFrontierFiltering,
      supportsUupgFiltering,
      supportsWatchlistJpOnlyFiltering,
      supportsWatchlistFiltering,
      uupgEnabled,
      uupgFieldDefinition,
      uupgFieldLabel,
      uupgFrontierFieldDefinition,
      uupgFrontierFieldLabel,
      watchlistEnabled,
      watchlistEngagementPhaseEnabled,
      watchlistEngagementPhaseDefinition,
      watchlistEngagementPhaseLabel,
      watchlistEngagementPhaseRule,
      watchlistEngagementPhaseSummary,
      watchlistJpOnlyEvangelicalCriteriaEnabled,
      watchlistJpOnlyEvangelicalDefinition,
      watchlistJpOnlyEvangelicalRule,
      watchlistJpOnlyEvangelicalSummary,
      watchlistThreshold,
      watchlistThresholdDefinition,
      watchlistThresholdEnabled,
    ],
  );

  return (
    <>
      <div className="space-y-4">
        <div
          className="flex flex-wrap items-center gap-2"
          data-smoke-dataset-toolbar
        >
          {toolbarAction}
          <div
            className="inline-flex rounded-lg border border-border bg-card/95 p-1"
            role="group"
            aria-label="Dataset view"
          >
            <Button
              type="button"
              size="sm"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              aria-pressed={viewMode === "table"}
              onClick={() => setViewMode("table")}
              data-smoke-close="dataset-map"
            >
              <TablePropertiesIcon aria-hidden="true" className="size-4" />
              Table
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "map" ? "secondary" : "ghost"}
              aria-pressed={viewMode === "map"}
              onClick={() => setViewMode("map")}
              data-smoke-trigger="dataset-map"
            >
              <MapPinnedIcon aria-hidden="true" className="size-4" />
              Map
            </Button>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
          <aside className="xl:col-start-1 xl:row-start-1 xl:self-start">
            <div className="xl:sticky xl:top-24">
              <div
                className="rounded-[1.25rem] border border-border/80 bg-card/95 shadow-sm xl:min-h-[760px]"
                data-smoke-filter-workspace="combined"
              >
                <DatasetTableActionBar
                  dataset={dataset}
                  filters={savedFilters}
                  recordCount={datasetTable.recordCount}
                  getSortedRows={datasetTable.getSortedRows}
                  visibleColumns={datasetTable.visibleColumns}
                  isLoading={datasetTable.isLoading}
                  hasError={Boolean(dataset.error || datasetTable.error)}
                  fieldDefinitionPresentationByColumnKey={
                    fieldDefinitionPresentationByColumnKey
                  }
                  canSaveFilteredTable={
                    canSaveFilteredTable && !temporaryTableScope
                  }
                  canAskQwenAboutView={
                    canAskQwenAboutView && dataset.isPrimary && !temporaryTableScope
                  }
                  onOpenFilters={handleOpenFilters}
                  onOpenAssignDerivedView={
                    assignableDatasets.length > 0 && !temporaryTableScope
                      ? handleOpenAssignDerivedView
                      : undefined
                  }
                  variant="embedded"
                />
                <div className="hidden border-t border-border/70 xl:block">
                  <DatasetViewSwitchGrid
                    {...filterPanelProps}
                    className="rounded-none border-0 bg-transparent shadow-none"
                  />
                </div>
              </div>
            </div>
          </aside>
          <div className="min-w-0 space-y-4 xl:col-start-2 xl:row-start-1">
            {viewMode === "table" ? (
              <>
                {temporaryTableScope ? (
                  <section
                    className="flex flex-col gap-3 rounded-xl border border-border bg-accent/50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    aria-label="Temporary map table scope"
                    data-smoke-map-table-scope
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <ListFilterIcon
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-accent-foreground"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          Map selection: {temporaryTableScope.label}
                        </p>
                        <p className="text-muted-foreground">
                          {datasetTable.recordCount.toLocaleString()} temporary records. Saved filters and source data are unchanged.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setTemporaryTableScope(null)}
                      data-smoke-clear-map-table-scope
                    >
                      <XIcon />
                      Clear map selection
                    </Button>
                  </section>
                ) : null}
                <DatasetTable
                  table={datasetTable.table}
                  recordCount={datasetTable.recordCount}
                  isLoading={datasetTable.isLoading}
                  datasetError={dataset.error}
                  error={datasetTable.error}
                  onRowClick={(row) => setProfileRow(row)}
                />
              </>
            ) : (
              <Suspense
                fallback={
                  <div className="flex min-h-[34rem] items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
                    Loading map view…
                  </div>
                }
              >
                <LazyDatasetMapView
                  rows={datasetTable.filteredRows}
                  isLoading={datasetTable.isLoading}
                  error={dataset.error ?? datasetTable.error}
                  onViewRowsInTable={handleViewRowsInTable}
                  onOpenRecord={handleOpenRecord}
                />
              </Suspense>
            )}
          </div>
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
        />
      ) : null}
      <DatasetRecordProfileSheet
        open={Boolean(profileRow)}
        row={profileRow}
        visibleColumns={datasetTable.visibleColumns}
        fieldDefinitionPresentationByColumnKey={
          fieldDefinitionPresentationByColumnKey
        }
        onOpenChange={(open) => {
          if (!open) {
            setProfileRow(null);
          }
        }}
      />
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
