import type {
  DatasetOpenPreset,
  PopulationBelieversRule,
  DatasetSummary,
  FilterRegion,
  SavedDatasetFilterState,
  SavedDatasetSort,
} from "@/lib/api-types";
import {
  datasetSupportsCountryFiltering,
  datasetSupportsRegionFiltering,
  datasetSupportsUupgFiltering,
  datasetSupportsWatchlistFiltering,
  getEnabledRegionCountryNames,
  type DatasetCountryFilterState,
  type DatasetRegionFilterState,
  type DatasetUupgFilterState,
  type DatasetWatchlistFilterState,
} from "@/lib/dataset-region-filtering";
import {
  createDefaultPopulationBelieversRule,
  createSingleTierPopulationBelieversRule,
  sanitizePopulationBelieversRule,
} from "@/lib/evangelical-population-believers-rule";
import { normalizeRegionDisplayName } from "@/lib/region-display";

function dedupeStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

export type DatasetOpenPresetSection = keyof DatasetOpenPreset;

export type InitialDatasetDetailState = {
  regionEnabled: boolean;
  selectedRegionIds: Record<string, boolean>;
  countryEnabled: boolean;
  selectedCountryNames: string[];
  watchlistEnabled: boolean;
  watchlistThresholdEnabled: boolean;
  watchlistThreshold: number;
  watchlistEngagementPhaseEnabled: boolean;
  watchlistEngagementPhaseThreshold: number;
  watchlistPopulationBelieversRuleEnabled: boolean;
  watchlistPopulationBelieversRule: PopulationBelieversRule;
  watchlistFrontierGroupEnabled: boolean;
  watchlistFrontierGroupValue: boolean;
  uupgEnabled: boolean;
  sorting: SavedDatasetSort[];
};

function toSavedDatasetFilterStateWithEmptySorting(
  preset: DatasetOpenPreset,
): SavedDatasetFilterState {
  return {
    ...preset,
    sorting: [],
  };
}

function createSelectedRegionIdMap(
  regions: FilterRegion[],
  selectedRegionIds: Set<string>,
) {
  return Object.fromEntries(
    regions.map((region) => [region.id, selectedRegionIds.has(region.id)]),
  );
}

function getMatchingRegionIds(
  regions: FilterRegion[],
  filters: DatasetOpenPreset["region"],
) {
  const selectedRegionIds = new Set<string>();
  const selectedRegionNames = new Set(
    filters.selectedRegionNames.map((regionName) =>
      normalizeRegionDisplayName(regionName),
    ),
  );

  for (const region of regions) {
    if (filters.selectedRegionIds.includes(region.id)) {
      selectedRegionIds.add(region.id);
      continue;
    }

    if (selectedRegionNames.has(normalizeRegionDisplayName(region.name))) {
      selectedRegionIds.add(region.id);
    }
  }

  return selectedRegionIds;
}

function getNormalizedPopulationBelieversRuleState(
  watchlist: SavedDatasetFilterState["watchlist"] | DatasetOpenPreset["watchlist"],
) {
  if (watchlist.evangelicalPopulationBelieversRule) {
    return {
      enabled: watchlist.evangelicalPopulationBelieversRuleEnabled ?? true,
      rule: sanitizePopulationBelieversRule(
        watchlist.evangelicalPopulationBelieversRule,
      ),
      hasPersistedRule: true,
    }
  }

  if (
    watchlist.evangelicalBelieversThreshold !== undefined &&
    (watchlist.evangelicalBelieversEnabled ?? true)
  ) {
    return {
      enabled: true,
      rule: createSingleTierPopulationBelieversRule(
        watchlist.evangelicalBelieversThreshold,
      ),
      hasPersistedRule: true,
    }
  }

  return {
    enabled: watchlist.evangelicalPopulationBelieversRuleEnabled ?? true,
    rule: createDefaultPopulationBelieversRule(),
    hasPersistedRule: false,
  }
}

export function buildSavedDatasetFilterState(input: {
  regions: FilterRegion[];
  selectedRegionIds: Record<string, boolean>;
  regionEnabled: boolean;
  countryEnabled: boolean;
  selectedCountryNames: string[];
  watchlistEnabled: boolean;
  watchlistThresholdEnabled: boolean;
  watchlistThreshold: number;
  watchlistEngagementPhaseEnabled: boolean;
  watchlistEngagementPhaseThreshold: number;
  watchlistPopulationBelieversRuleEnabled: boolean;
  watchlistPopulationBelieversRule: PopulationBelieversRule;
  watchlistFrontierGroupEnabled: boolean;
  watchlistFrontierGroupValue: boolean;
  uupgEnabled: boolean;
  sorting: SavedDatasetSort[];
}): SavedDatasetFilterState {
  const selectedRegions = input.regions.filter(
    (region) => input.selectedRegionIds[region.id],
  );

  return {
    region: {
      enabled: input.regionEnabled,
      selectedRegionIds: selectedRegions.map((region) => region.id),
      selectedRegionNames: selectedRegions.map((region) =>
        normalizeRegionDisplayName(region.name),
      ),
      enabledCountryNames: getEnabledRegionCountryNames(
        input.regions,
        input.selectedRegionIds,
      ),
    },
    country: {
      enabled: input.countryEnabled,
      selectedCountryNames: dedupeStrings(input.selectedCountryNames),
    },
    watchlist: {
      enabled: input.watchlistEnabled,
      thresholdEnabled: input.watchlistThresholdEnabled,
      threshold: input.watchlistThreshold,
      engagementPhaseEnabled: input.watchlistEngagementPhaseEnabled,
      engagementPhaseThreshold: input.watchlistEngagementPhaseThreshold,
      evangelicalPopulationBelieversRuleEnabled:
        input.watchlistPopulationBelieversRuleEnabled,
      evangelicalPopulationBelieversRule: sanitizePopulationBelieversRule(
        input.watchlistPopulationBelieversRule,
      ),
      frontierGroupEnabled: input.watchlistFrontierGroupEnabled,
      frontierGroupValue: input.watchlistFrontierGroupValue,
    },
    uupg: {
      enabled: input.uupgEnabled,
    },
    sorting: input.sorting.map((sort) => ({
      id: sort.id,
      desc: sort.desc,
    })),
  };
}

export function buildDatasetOpenPreset(
  filters: SavedDatasetFilterState,
): DatasetOpenPreset {
  const normalizedFilters = normalizeSavedDatasetFilterState(filters);

  return {
    region: normalizedFilters.region,
    country: normalizedFilters.country,
    watchlist: normalizedFilters.watchlist,
    uupg: normalizedFilters.uupg,
  };
}

export function normalizeDatasetOpenPreset(
  preset: DatasetOpenPreset | undefined | null,
) {
  if (!preset) {
    return null;
  }

  return buildDatasetOpenPreset(
    normalizeSavedDatasetFilterState(
      toSavedDatasetFilterStateWithEmptySorting(preset),
    ),
  );
}

export function getUnsupportedDatasetOpenPresetSections(
  dataset: Pick<DatasetSummary, "columns">,
  preset: DatasetOpenPreset | undefined | null,
) {
  const normalizedPreset = normalizeDatasetOpenPreset(preset);

  if (!normalizedPreset) {
    return [] as DatasetOpenPresetSection[];
  }

  const unsupportedSections: DatasetOpenPresetSection[] = [];

  if (
    normalizedPreset.region.enabled &&
    !datasetSupportsRegionFiltering(dataset)
  ) {
    unsupportedSections.push("region");
  }

  if (
    normalizedPreset.country.enabled &&
    !datasetSupportsCountryFiltering(dataset)
  ) {
    unsupportedSections.push("country");
  }

  if (
    normalizedPreset.watchlist.enabled &&
    !datasetSupportsWatchlistFiltering(dataset)
  ) {
    unsupportedSections.push("watchlist");
  }

  if (
    normalizedPreset.uupg.enabled &&
    !datasetSupportsUupgFiltering(dataset)
  ) {
    unsupportedSections.push("uupg");
  }

  return unsupportedSections;
}

export function getInitialDatasetDetailState(input: {
  dataset: Pick<DatasetSummary, "columns">;
  regions: FilterRegion[];
  initialFilters?: DatasetOpenPreset | null;
  initialSorting?: SavedDatasetSort[];
}): InitialDatasetDetailState {
  const supportsRegionFiltering = datasetSupportsRegionFiltering(input.dataset);
  const supportsCountryFiltering = datasetSupportsCountryFiltering(input.dataset);
  const supportsWatchlistFiltering = datasetSupportsWatchlistFiltering(input.dataset);
  const supportsUupgFiltering = datasetSupportsUupgFiltering(input.dataset);
  const canUseRegionFilter =
    supportsRegionFiltering && input.regions.length > 0;
  const normalizedPreset = normalizeDatasetOpenPreset(input.initialFilters);
  const defaultState = {
    regionEnabled: canUseRegionFilter,
    selectedRegionIds: Object.fromEntries(
      input.regions.map((region) => [region.id, canUseRegionFilter]),
    ),
    countryEnabled: false,
    selectedCountryNames: [],
    watchlistEnabled: false,
    watchlistThresholdEnabled: true,
    watchlistThreshold: 2,
    watchlistEngagementPhaseEnabled: true,
    watchlistEngagementPhaseThreshold: 6,
    watchlistPopulationBelieversRuleEnabled: true,
    watchlistPopulationBelieversRule: createDefaultPopulationBelieversRule(),
    watchlistFrontierGroupEnabled: true,
    watchlistFrontierGroupValue: true,
    uupgEnabled: false,
    sorting: input.initialSorting?.map((sort) => ({
      id: sort.id,
      desc: sort.desc,
    })) ?? [],
  } satisfies InitialDatasetDetailState;

  if (!normalizedPreset) {
    return defaultState;
  }

  const matchedRegionIds =
    normalizedPreset.region.enabled &&
    normalizedPreset.region.selectedRegionIds.length === 0 &&
    normalizedPreset.region.selectedRegionNames.length === 0
      ? new Set(input.regions.map((region) => region.id))
      : getMatchingRegionIds(input.regions, normalizedPreset.region);
  const hasMatchedRegions = matchedRegionIds.size > 0;

  return {
    regionEnabled:
      canUseRegionFilter &&
      normalizedPreset.region.enabled &&
      hasMatchedRegions,
    selectedRegionIds: createSelectedRegionIdMap(input.regions, matchedRegionIds),
    countryEnabled:
      supportsCountryFiltering && normalizedPreset.country.enabled,
    selectedCountryNames: supportsCountryFiltering
      ? dedupeStrings(normalizedPreset.country.selectedCountryNames)
      : [],
    watchlistEnabled:
      supportsWatchlistFiltering && normalizedPreset.watchlist.enabled,
    watchlistThresholdEnabled: supportsWatchlistFiltering
      ? normalizedPreset.watchlist.thresholdEnabled ?? true
      : defaultState.watchlistThresholdEnabled,
    watchlistThreshold: supportsWatchlistFiltering
      ? normalizedPreset.watchlist.threshold
      : defaultState.watchlistThreshold,
    watchlistEngagementPhaseEnabled: supportsWatchlistFiltering
      ? normalizedPreset.watchlist.engagementPhaseEnabled ?? true
      : defaultState.watchlistEngagementPhaseEnabled,
    watchlistEngagementPhaseThreshold: supportsWatchlistFiltering
      ? normalizedPreset.watchlist.engagementPhaseThreshold
      : defaultState.watchlistEngagementPhaseThreshold,
    watchlistPopulationBelieversRuleEnabled: supportsWatchlistFiltering
      ? getNormalizedPopulationBelieversRuleState(normalizedPreset.watchlist).enabled
      : defaultState.watchlistPopulationBelieversRuleEnabled,
    watchlistPopulationBelieversRule: supportsWatchlistFiltering
      ? getNormalizedPopulationBelieversRuleState(normalizedPreset.watchlist).rule
      : defaultState.watchlistPopulationBelieversRule,
    watchlistFrontierGroupEnabled: supportsWatchlistFiltering
      ? normalizedPreset.watchlist.frontierGroupEnabled ?? true
      : defaultState.watchlistFrontierGroupEnabled,
    watchlistFrontierGroupValue: supportsWatchlistFiltering
      ? normalizedPreset.watchlist.frontierGroupValue
      : defaultState.watchlistFrontierGroupValue,
    uupgEnabled: supportsUupgFiltering && normalizedPreset.uupg.enabled,
    sorting: defaultState.sorting,
  };
}

export function normalizeSavedDatasetFilterState(filters: SavedDatasetFilterState) {
  const populationBelieversRuleState =
    getNormalizedPopulationBelieversRuleState(filters.watchlist)

  return {
    ...filters,
    country: {
      enabled: filters.country?.enabled ?? false,
      selectedCountryNames: dedupeStrings(filters.country?.selectedCountryNames ?? []),
    },
    watchlist: {
      enabled: filters.watchlist.enabled,
      thresholdEnabled: filters.watchlist.thresholdEnabled ?? true,
      threshold: filters.watchlist.threshold,
      engagementPhaseEnabled: filters.watchlist.engagementPhaseEnabled ?? true,
      engagementPhaseThreshold: filters.watchlist.engagementPhaseThreshold,
      evangelicalPopulationBelieversRuleEnabled:
        populationBelieversRuleState.hasPersistedRule
          ? populationBelieversRuleState.enabled
          : filters.watchlist.evangelicalPopulationBelieversRuleEnabled ??
            filters.watchlist.evangelicalBelieversEnabled ??
            true,
      evangelicalPopulationBelieversRule:
        populationBelieversRuleState.hasPersistedRule
          ? populationBelieversRuleState.rule
          : undefined,
      ...(populationBelieversRuleState.hasPersistedRule
        ? {}
        : {
            evangelicalPercentEnabled:
              filters.watchlist.evangelicalPercentThreshold === undefined
                ? undefined
                : filters.watchlist.evangelicalPercentEnabled ?? true,
            evangelicalPercentThreshold:
              filters.watchlist.evangelicalPercentThreshold,
          }),
      frontierGroupEnabled: filters.watchlist.frontierGroupEnabled ?? true,
      frontierGroupValue: filters.watchlist.frontierGroupValue,
    },
  } satisfies SavedDatasetFilterState;
}

export function getDatasetRegionFilterStateFromSavedView(
  dataset: Pick<DatasetSummary, "columns">,
  filters: SavedDatasetFilterState,
): DatasetRegionFilterState {
  const normalizedFilters = normalizeSavedDatasetFilterState(filters);

  return {
    enabled: normalizedFilters.region.enabled,
    isSupported: datasetSupportsRegionFiltering(dataset),
    hasConfiguredRegions: normalizedFilters.region.enabledCountryNames.length > 0,
    enabledCountryNames: dedupeStrings(normalizedFilters.region.enabledCountryNames),
  };
}

export function getDatasetCountryFilterStateFromSavedView(
  dataset: Pick<DatasetSummary, "columns">,
  filters: SavedDatasetFilterState,
): DatasetCountryFilterState {
  const normalizedFilters = normalizeSavedDatasetFilterState(filters);

  return {
    enabled: normalizedFilters.country.enabled,
    isSupported: datasetSupportsCountryFiltering(dataset),
    selectedCountryNames: dedupeStrings(normalizedFilters.country.selectedCountryNames),
  };
}

export function getDatasetWatchlistFilterStateFromSavedView(
  dataset: Pick<DatasetSummary, "columns">,
  filters: SavedDatasetFilterState,
): DatasetWatchlistFilterState {
  const normalizedFilters = normalizeSavedDatasetFilterState(filters);

  return {
    enabled: normalizedFilters.watchlist.enabled,
    isSupported: datasetSupportsWatchlistFiltering(dataset),
    thresholdEnabled: normalizedFilters.watchlist.thresholdEnabled ?? true,
    threshold: normalizedFilters.watchlist.threshold,
    engagementPhaseEnabled:
      normalizedFilters.watchlist.engagementPhaseEnabled ?? true,
    engagementPhaseThreshold: normalizedFilters.watchlist.engagementPhaseThreshold,
    evangelicalPopulationBelieversRuleEnabled:
      normalizedFilters.watchlist.evangelicalPopulationBelieversRuleEnabled ??
      true,
    evangelicalPopulationBelieversRule:
      normalizedFilters.watchlist.evangelicalPopulationBelieversRule,
    evangelicalPercentEnabled:
      normalizedFilters.watchlist.evangelicalPercentEnabled,
    evangelicalPercentThreshold:
      normalizedFilters.watchlist.evangelicalPercentThreshold,
    frontierGroupEnabled:
      normalizedFilters.watchlist.frontierGroupEnabled ?? true,
    frontierGroupValue: normalizedFilters.watchlist.frontierGroupValue,
  };
}

export function getDatasetUupgFilterStateFromSavedView(
  dataset: Pick<DatasetSummary, "columns">,
  filters: SavedDatasetFilterState,
): DatasetUupgFilterState {
  const normalizedFilters = normalizeSavedDatasetFilterState(filters);

  return {
    enabled: normalizedFilters.uupg.enabled,
    isSupported: datasetSupportsUupgFiltering(dataset),
  };
}
