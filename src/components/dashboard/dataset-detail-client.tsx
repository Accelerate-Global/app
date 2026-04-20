"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DatasetOpenPresetSheet } from "@/components/dashboard/dataset-open-preset-sheet";
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
  DatasetTag,
  FieldDefinitionPresentation,
  FilterRegion,
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
import { getDatasetOpenPresetTag, normalizeDatasetTags } from "@/lib/dataset-tags";
import {
  UUPG_DATASET_COLUMN_KEY,
  WATCHLIST_DATASET_COLUMN_KEY,
  WATCHLIST_ENGAGEMENT_PHASES_DATASET_COLUMN_KEY,
  WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEY,
  WATCHLIST_PERCENT_EVANGELICAL_DATASET_COLUMN_KEY,
  WATCHLIST_POPULATION_DATASET_COLUMN_KEY,
} from "@/lib/dataset-region-constants";
import {
  datasetSupportsAlternateCountryFiltering,
  datasetSupportsCountryFiltering,
  datasetSupportsRegionFiltering,
  datasetSupportsWatchlistFiltering,
  datasetSupportsUupgFiltering,
  getEffectiveCountrySelection,
  getMatchingRegionIdsForCountries,
  getSelectedRegionCountryNames,
} from "@/lib/dataset-region-filtering";
import { isGlobalRegionName } from "@/lib/region-display";
import {
  buildDatasetOpenPreset,
  buildSavedDatasetFilterState,
  getInitialDatasetDetailState,
} from "@/lib/saved-dataset-filters";
import { sanitizePopulationBelieversRule } from "@/lib/evangelical-population-believers-rule";

type DatasetDetailClientProps = {
  dataset: DatasetSummary;
  regions: FilterRegion[];
  fieldDefinitionPresentationByColumnKey: Record<
    string,
    FieldDefinitionPresentation
  >;
  initialFilters?: DatasetOpenPreset | null;
  initialSorting?: SavedDatasetSort[] | null;
  canManageOpenPresets?: boolean;
  actorOwnerId?: string;
  workspaceRole?: AnalyticsWorkspaceRole;
  datasetSource?: DatasetOpenSource;
  initialSavedTableId?: string | null;
  initialSavedTableRowCount?: number | null;
  initialSavedTableFilterSections?: SavedDatasetFilterState | null;
  initialPresetTagId?: string | null;
};

const WATCHLIST_THRESHOLD_MIN = 0;
const WATCHLIST_THRESHOLD_MAX = 6;
const WATCHLIST_ENGAGEMENT_PHASE_MIN = 0;
const WATCHLIST_ENGAGEMENT_PHASE_MAX = 7;
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

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

export function DatasetDetailClient({
  dataset,
  regions,
  fieldDefinitionPresentationByColumnKey,
  initialFilters = null,
  initialSorting = null,
  canManageOpenPresets = false,
  actorOwnerId = "anonymous",
  workspaceRole = "anonymous",
  datasetSource = "dashboard",
  initialSavedTableId = null,
  initialSavedTableRowCount = null,
  initialSavedTableFilterSections = null,
  initialPresetTagId = null,
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
  const watchlistPopulationBelieversRuleDefinition = `Build a tiered minimum-believers rule by population. Actual believers are calculated as ${watchlistPopulationLabel} * (${watchlistPercentEvangelicalLabel} / 100), and the implied percentage is shown live for context.`;
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
  const supportsAlternateCountryFiltering =
    datasetSupportsAlternateCountryFiltering(dataset);
  const supportsCountryFiltering = datasetSupportsCountryFiltering(dataset);
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
  const normalizedInitialDatasetTags = useMemo(
    () => normalizeDatasetTags(dataset.tags),
    [dataset.tags],
  );
  const initialPresetTag = useMemo(
    () => getDatasetOpenPresetTag(normalizedInitialDatasetTags),
    [normalizedInitialDatasetTags],
  );
  const [datasetTags, setDatasetTags] = useState<DatasetTag[]>(
    () => normalizedInitialDatasetTags,
  );
  const [selectedOpenPresetTagId, setSelectedOpenPresetTagId] = useState<
    string | null
  >(() => initialPresetTag?.id ?? normalizedInitialDatasetTags[0]?.id ?? null);
  const [isSavingOpenPreset, setIsSavingOpenPreset] = useState(false);
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
  const [watchlistFrontierGroupEnabled, setWatchlistFrontierGroupEnabled] =
    useState(initialState.watchlistFrontierGroupEnabled);
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
  const [watchlistFrontierGroupValue, setWatchlistFrontierGroupValue] = useState(
    initialState.watchlistFrontierGroupValue,
  );
  const [uupgEnabled, setUupgEnabled] = useState(initialState.uupgEnabled);
  const [isFiltersSheetOpen, setIsFiltersSheetOpen] = useState(false);
  const [isOpenPresetSheetOpen, setIsOpenPresetSheetOpen] = useState(false);
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
  const datasetTable = useDatasetTableState({
    dataset,
    initialSorting: initialState.sorting,
    fieldDefinitionPresentationByColumnKey,
    regionFilter: {
      enabled: regionEnabled,
      isSupported: supportsRegionFiltering,
      hasConfiguredRegions: visibleRegions.length > 0,
      enabledCountryNames: selectedRegionCountryNames,
    },
    countryFilter: {
      enabled: countryEnabled,
      isSupported: supportsCountryFiltering,
      selectedCountryNames,
      includeAlternateCountries,
    },
    watchlistFilter: {
      enabled: watchlistEnabled,
      isSupported: supportsWatchlistFiltering,
      thresholdEnabled: watchlistThresholdEnabled,
      threshold: watchlistThreshold,
      engagementPhaseEnabled: watchlistEngagementPhaseEnabled,
      engagementPhaseThreshold: watchlistEngagementPhaseThreshold,
      evangelicalPopulationBelieversRuleEnabled:
        watchlistPopulationBelieversRuleEnabled,
      evangelicalPopulationBelieversRule: watchlistPopulationBelieversRule,
      frontierGroupEnabled: watchlistFrontierGroupEnabled,
      frontierGroupValue: watchlistFrontierGroupValue,
    },
    uupgFilter: {
      enabled: uupgEnabled,
      isSupported: supportsUupgFiltering,
    },
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
        watchlistFrontierGroupEnabled,
        watchlistFrontierGroupValue,
        uupgEnabled,
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
      uupgEnabled,
      watchlistEngagementPhaseEnabled,
      watchlistEnabled,
      watchlistPopulationBelieversRuleEnabled,
      watchlistFrontierGroupEnabled,
      watchlistThresholdEnabled,
      watchlistEngagementPhaseThreshold,
      watchlistPopulationBelieversRule,
      watchlistFrontierGroupValue,
      watchlistThreshold,
    ],
  );
  useEffect(() => {
    const allowedCountryNames = new Set(datasetTable.availableCountryNames);

    setSelectedCountryNames((current) => {
      const next = current.filter((countryName) =>
        allowedCountryNames.has(countryName),
      );

      return next.length === current.length ? current : next;
    });
  }, [datasetTable.availableCountryNames]);

  function applyCountrySelection(nextCountryNames: string[]) {
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
  }

  function handleRegionSelectorChange(regionId: string, checked: boolean) {
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
  }

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

  useEffect(() => {
    if (!initialPresetTagId) {
      return;
    }

    trackAppEvent(
      "dataset_open_preset_used",
      withAnalyticsContext(analyticsContext, {
        source_surface: "dataset_detail_page",
        success: true,
        dataset_id: dataset.id,
        tag_id: initialPresetTagId,
      }),
    );
  }, [analyticsContext, dataset.id, initialPresetTagId]);

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
        watchlistFrontierGroupEnabled,
        watchlistFrontierGroupValue,
        uupgEnabled,
        sorting: datasetTable.sorting,
      }),
    [
      countryEnabled,
      includeAlternateCountries,
      datasetTable.sorting,
      regionEnabled,
      selectedCountryNames,
      selectedRegionIds,
      uupgEnabled,
      watchlistEnabled,
      watchlistEngagementPhaseEnabled,
      watchlistEngagementPhaseThreshold,
      watchlistPopulationBelieversRuleEnabled,
      watchlistPopulationBelieversRule,
      watchlistFrontierGroupEnabled,
      watchlistFrontierGroupValue,
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
          watchlist_frontier_group_enabled: watchlistFrontierGroupEnabled,
          watchlist_frontier_group_value: watchlistFrontierGroupEnabled
            ? watchlistFrontierGroupValue
            : null,
          watchlist_engagement_phase_enabled: watchlistEngagementPhaseEnabled,
          watchlist_engagement_phase_threshold: watchlistEngagementPhaseEnabled
            ? watchlistEngagementPhaseThreshold
            : null,
          uupg_enabled: uupgEnabled,
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
    uupgEnabled,
    watchlistEnabled,
    watchlistEngagementPhaseEnabled,
    watchlistEngagementPhaseThreshold,
    watchlistPopulationBelieversRuleEnabled,
    watchlistPopulationBelieversRule,
    watchlistFrontierGroupEnabled,
    watchlistFrontierGroupValue,
    watchlistThreshold,
    watchlistThresholdEnabled,
  ]);

  async function updateDatasetTags(nextTags: DatasetTag[]) {
    const response = await fetch(`/api/datasets/${dataset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tags: nextTags,
      }),
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(
          response,
          "The dataset open preset could not be updated.",
        ),
      );
    }

    const payload = (await response.json()) as {
      dataset: DatasetSummary;
    };

    const nextNormalizedTags = normalizeDatasetTags(payload.dataset.tags);
    setDatasetTags(nextNormalizedTags);

    if (!nextNormalizedTags.some((tag) => tag.id === selectedOpenPresetTagId)) {
      setSelectedOpenPresetTagId(nextNormalizedTags[0]?.id ?? null);
    }
  }

  async function handleSaveOpenPreset() {
    if (!selectedOpenPresetTagId) {
      throw new Error("Select a tag before saving the open preset.");
    }

    setIsSavingOpenPreset(true);

    try {
      const nextOpenPreset = buildDatasetOpenPreset(savedFilters);
      const nextTags = datasetTags.map((tag) =>
        tag.id === selectedOpenPresetTagId
          ? {
              ...tag,
              openPreset: nextOpenPreset,
            }
          : tag.openPreset
            ? {
                ...tag,
                openPreset: undefined,
              }
            : tag,
      );

      await updateDatasetTags(nextTags);
    } finally {
      setIsSavingOpenPreset(false);
    }
  }

  async function handleClearOpenPreset() {
    const hasPreset = datasetTags.some((tag) => tag.openPreset !== undefined);

    if (!hasPreset) {
      return;
    }

    setIsSavingOpenPreset(true);

    try {
      await updateDatasetTags(
        datasetTags.map((tag) =>
          tag.openPreset !== undefined
            ? {
                ...tag,
                openPreset: undefined,
              }
            : tag,
        ),
      );
    } finally {
      setIsSavingOpenPreset(false);
    }
  }
  const filterPanelProps = {
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
      onToggleCountry: (countryName: string, checked: boolean) =>
        applyCountrySelection(
          checked
            ? [
                ...effectiveCountrySelection.selectedCountryNames,
                countryName,
              ]
            : effectiveCountrySelection.selectedCountryNames.filter(
                (value) => value !== countryName,
              ),
        ),
      onSelectVisible: (countryNames: string[]) =>
        applyCountrySelection([
          ...effectiveCountrySelection.selectedCountryNames,
          ...countryNames,
        ]),
      onClearVisible: (countryNames: string[]) => {
        const countryNamesToClear = new Set(countryNames);
        applyCountrySelection(
          effectiveCountrySelection.selectedCountryNames.filter(
            (countryName) => !countryNamesToClear.has(countryName),
          ),
        );
      },
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
      frontierGroupLabel: watchlistFrontierGroupLabel,
      frontierGroupDefinition: watchlistFrontierGroupDefinition,
      frontierGroupEnabled: watchlistFrontierGroupEnabled,
      frontierGroupValue: watchlistFrontierGroupValue,
      onEnabledChange: setWatchlistEnabled,
      onThresholdEnabledChange: setWatchlistThresholdEnabled,
      onThresholdChange: (value: number) =>
        setWatchlistThreshold(clampWatchlistThreshold(value)),
      onEngagementPhaseEnabledChange: setWatchlistEngagementPhaseEnabled,
      onEngagementPhaseThresholdChange: (value: number) =>
        setWatchlistEngagementPhaseThreshold(
          clampWatchlistEngagementPhaseThreshold(value),
        ),
      onPopulationBelieversRuleEnabledChange:
        setWatchlistPopulationBelieversRuleEnabled,
      onPopulationBelieversRuleChange: (value) =>
        setWatchlistPopulationBelieversRule(
          sanitizePopulationBelieversRule(value),
        ),
      onFrontierGroupEnabledChange: setWatchlistFrontierGroupEnabled,
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
            analyticsContext={analyticsContext}
            onOpenFilters={() => setIsFiltersSheetOpen(true)}
            onOpenOpenPreset={
              canManageOpenPresets
                ? () => setIsOpenPresetSheetOpen(true)
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
      {canManageOpenPresets ? (
        <DatasetOpenPresetSheet
          open={isOpenPresetSheetOpen}
          onOpenChange={setIsOpenPresetSheetOpen}
          dataset={dataset}
          filters={savedFilters}
          tags={datasetTags}
          selectedTagId={selectedOpenPresetTagId}
          isSaving={isSavingOpenPreset}
          analyticsContext={analyticsContext}
          onSelectedTagIdChange={setSelectedOpenPresetTagId}
          onSave={handleSaveOpenPreset}
          onClear={handleClearOpenPreset}
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
