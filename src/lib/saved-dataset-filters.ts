import type {
  DatasetHotspotsMetric,
  DatasetOpenPreset,
  PopulationBelieversRule,
  DatasetSummary,
  FilterRegion,
  SavedDatasetFilterState,
  SavedDatasetSort,
} from "@/lib/api-types";
import {
  DEFAULT_HOTSPOTS_COUNTRY_COUNT,
  DEFAULT_HOTSPOTS_METRIC,
  datasetSupportsAlternateCountryFiltering,
  datasetSupportsCountryFiltering,
  datasetSupportsHotspotsFiltering,
  datasetSupportsRegionFiltering,
  datasetSupportsUupgFiltering,
  datasetSupportsWatchlistFiltering,
  getSelectedRegionCountryNames,
  type DatasetCountryFilterState,
  type DatasetHotspotsFilterState,
  type DatasetRegionFilterState,
  type DatasetUupgFilterState,
  type DatasetWatchlistFilterState,
  normalizeHotspotsCountryCount,
  normalizeHotspotsMetric,
} from "@/lib/dataset-region-filtering";
import {
  createDefaultPopulationBelieversRule,
  createSingleTierPopulationBelieversRule,
  sanitizePopulationBelieversRule,
} from "@/lib/evangelical-population-believers-rule";
import {
  isGlobalRegionName,
  normalizeRegionDisplayName,
  normalizeRegionMatchName,
} from "@/lib/region-display";
import { WATCHLIST_FIXED_ENGAGEMENT_PHASE_MIN } from "@/lib/watchlist-engagement-phase";

export const WATCHLIST_FIXED_THRESHOLD = 2;

function dedupeStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function dedupeRegionNames(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeRegionDisplayName(value))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

export type InitialDatasetDetailState = {
  regionEnabled: boolean;
  selectedRegionIds: Record<string, boolean>;
  countryEnabled: boolean;
  selectedCountryNames: string[];
  includeAlternateCountries: boolean;
  watchlistEnabled: boolean;
  watchlistThresholdEnabled: boolean;
  watchlistThreshold: number;
  watchlistEngagementPhaseEnabled: boolean;
  watchlistEngagementPhaseThreshold: number;
  watchlistPopulationBelieversRuleEnabled: boolean;
  watchlistPopulationBelieversRule: PopulationBelieversRule;
  uupgEnabled: boolean;
  hotspotsEnabled: boolean;
  hotspotsMetric: DatasetHotspotsMetric;
  hotspotsCountryCount: number;
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
  options?: {
    allowEmpty?: boolean;
  },
) {
  const normalizedSelectedRegionIds = normalizeSelectedRegionIdSet(
    regions,
    selectedRegionIds,
    options,
  );

  return Object.fromEntries(
    regions.map((region) => [region.id, normalizedSelectedRegionIds.has(region.id)]),
  );
}

function findGlobalRegion(regions: FilterRegion[]) {
  return regions.find((region) => isGlobalRegionName(region.name)) ?? null;
}

function createDefaultSelectedRegionIdSet(regions: FilterRegion[]) {
  const globalRegion = findGlobalRegion(regions);

  if (!globalRegion) {
    return new Set<string>();
  }

  return new Set<string>([globalRegion.id]);
}

function normalizeSelectedRegionIdSet(
  regions: FilterRegion[],
  selectedRegionIds: Set<string>,
  options?: {
    allowEmpty?: boolean;
  },
) {
  const validRegionIds = new Set(regions.map((region) => region.id));
  const normalizedSelectedRegionIds = new Set(
    Array.from(selectedRegionIds).filter((regionId) => validRegionIds.has(regionId)),
  );
  const globalRegion = findGlobalRegion(regions);

  if (globalRegion && normalizedSelectedRegionIds.has(globalRegion.id)) {
    return new Set<string>([globalRegion.id]);
  }

  if (normalizedSelectedRegionIds.size === 0) {
    if (options?.allowEmpty) {
      return new Set<string>();
    }

    return createDefaultSelectedRegionIdSet(regions);
  }

  return normalizedSelectedRegionIds;
}

function getMatchingRegionIds(
  regions: FilterRegion[],
  filters: DatasetOpenPreset["region"],
  options?: {
    allowEmpty?: boolean;
  },
) {
  const selectedRegionIds = new Set<string>();
  const selectedRegionNames = new Set(
    filters.selectedRegionNames.map((regionName) =>
      normalizeRegionMatchName(regionName),
    ),
  );

  for (const region of regions) {
    if (filters.selectedRegionIds.includes(region.id)) {
      selectedRegionIds.add(region.id);
      continue;
    }

    if (selectedRegionNames.has(normalizeRegionMatchName(region.name))) {
      selectedRegionIds.add(region.id);
    }
  }

  return normalizeSelectedRegionIdSet(regions, selectedRegionIds, options);
}

function isLegacyDefaultGlobalPreset(preset: DatasetOpenPreset) {
  return (
    !preset.region.enabled &&
    preset.region.selectedRegionIds.length === 0 &&
    preset.region.selectedRegionNames.length === 0 &&
    preset.region.enabledCountryNames.length === 0 &&
    !preset.country.enabled &&
    preset.country.selectedCountryNames.length === 0 &&
    !(preset.country.includeAlternateCountries ?? false)
  );
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

function normalizeWatchlistThreshold(_value: number | null | undefined) {
  return WATCHLIST_FIXED_THRESHOLD;
}

export function buildSavedDatasetFilterState(input: {
  regions: FilterRegion[];
  selectedRegionIds: Record<string, boolean>;
  regionEnabled: boolean;
  countryEnabled: boolean;
  selectedCountryNames: string[];
  includeAlternateCountries: boolean;
  watchlistEnabled: boolean;
  watchlistThresholdEnabled: boolean;
  watchlistThreshold: number;
  watchlistEngagementPhaseEnabled: boolean;
  watchlistEngagementPhaseThreshold: number;
  watchlistPopulationBelieversRuleEnabled: boolean;
  watchlistPopulationBelieversRule: PopulationBelieversRule;
  uupgEnabled: boolean;
  hotspotsEnabled: boolean;
  hotspotsMetric: DatasetHotspotsMetric;
  hotspotsCountryCount: number;
  sorting: SavedDatasetSort[];
}): SavedDatasetFilterState {
  const normalizedSelectedRegionIdSet = input.regionEnabled
    ? normalizeSelectedRegionIdSet(
        input.regions,
        new Set(
          input.regions
            .filter((region) => input.selectedRegionIds[region.id])
            .map((region) => region.id),
        ),
      )
    : new Set<string>();
  const normalizedSelectedRegionIds = createSelectedRegionIdMap(
    input.regions,
    normalizedSelectedRegionIdSet,
    {
      allowEmpty: !input.regionEnabled,
    },
  );
  const selectedRegions = input.regions.filter(
    (region) => normalizedSelectedRegionIds[region.id],
  );

  return {
    region: {
      enabled: input.regionEnabled,
      selectedRegionIds: selectedRegions.map((region) => region.id),
      selectedRegionNames: selectedRegions.map((region) =>
        normalizeRegionDisplayName(region.name),
      ),
      enabledCountryNames: input.regionEnabled
        ? getSelectedRegionCountryNames(input.regions, normalizedSelectedRegionIds)
        : [],
    },
    country: {
      enabled: input.countryEnabled,
      selectedCountryNames: dedupeStrings(input.selectedCountryNames),
      includeAlternateCountries: input.includeAlternateCountries,
    },
    watchlist: {
      enabled: input.watchlistEnabled,
      thresholdEnabled: input.watchlistThresholdEnabled,
      threshold: normalizeWatchlistThreshold(input.watchlistThreshold),
      engagementPhaseEnabled: true,
      engagementPhaseThreshold: WATCHLIST_FIXED_ENGAGEMENT_PHASE_MIN,
      evangelicalPopulationBelieversRuleEnabled:
        input.watchlistPopulationBelieversRuleEnabled,
      evangelicalPopulationBelieversRule: sanitizePopulationBelieversRule(
        input.watchlistPopulationBelieversRule,
      ),
    },
    uupg: {
      enabled: input.uupgEnabled,
    },
    hotspots: {
      enabled: input.hotspotsEnabled,
      metric: normalizeHotspotsMetric(input.hotspotsMetric),
      countryCount: normalizeHotspotsCountryCount(input.hotspotsCountryCount),
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
    hotspots: normalizedFilters.hotspots,
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

export function getSavedDatasetFilterStateFromOpenPreset(
  preset: DatasetOpenPreset | undefined | null,
): SavedDatasetFilterState | null {
  const normalizedPreset = normalizeDatasetOpenPreset(preset);

  if (!normalizedPreset) {
    return null;
  }

  return normalizeSavedDatasetFilterState({
    ...normalizedPreset,
    sorting: [],
  });
}

export function getInitialDatasetDetailState(input: {
  dataset: Pick<DatasetSummary, "columns">;
  regions: FilterRegion[];
  initialFilters?: DatasetOpenPreset | null;
  initialSorting?: SavedDatasetSort[];
}): InitialDatasetDetailState {
  const supportsRegionFiltering = datasetSupportsRegionFiltering(input.dataset);
  const supportsCountryFiltering = datasetSupportsCountryFiltering(input.dataset);
  const supportsAlternateCountryFiltering =
    datasetSupportsAlternateCountryFiltering(input.dataset);
  const supportsWatchlistFiltering = datasetSupportsWatchlistFiltering(input.dataset);
  const supportsUupgFiltering = datasetSupportsUupgFiltering(input.dataset);
  const supportsHotspotsFiltering = datasetSupportsHotspotsFiltering(input.dataset);
  const canUseRegionFilter =
    supportsRegionFiltering && input.regions.length > 0;
  const normalizedPreset = normalizeDatasetOpenPreset(input.initialFilters);
  const defaultSelectedRegionIds = createSelectedRegionIdMap(
    input.regions,
    createDefaultSelectedRegionIdSet(input.regions),
  );
  const hasDefaultSelectedRegion = Object.values(defaultSelectedRegionIds).some(
    Boolean,
  );
  const defaultState = {
    regionEnabled: canUseRegionFilter && hasDefaultSelectedRegion,
    selectedRegionIds: defaultSelectedRegionIds,
    countryEnabled: false,
    selectedCountryNames: [],
    includeAlternateCountries: false,
    watchlistEnabled: false,
    watchlistThresholdEnabled: true,
    watchlistThreshold: WATCHLIST_FIXED_THRESHOLD,
    watchlistEngagementPhaseEnabled: true,
    watchlistEngagementPhaseThreshold: WATCHLIST_FIXED_ENGAGEMENT_PHASE_MIN,
    watchlistPopulationBelieversRuleEnabled: true,
    watchlistPopulationBelieversRule: createDefaultPopulationBelieversRule(),
    uupgEnabled: false,
    hotspotsEnabled: false,
    hotspotsMetric: DEFAULT_HOTSPOTS_METRIC,
    hotspotsCountryCount: DEFAULT_HOTSPOTS_COUNTRY_COUNT,
    sorting: input.initialSorting?.map((sort) => ({
      id: sort.id,
      desc: sort.desc,
    })) ?? [],
  } satisfies InitialDatasetDetailState;

  if (!normalizedPreset) {
    return defaultState;
  }

  const hasPersistedRegionSelection =
    normalizedPreset.region.selectedRegionIds.length > 0 ||
    normalizedPreset.region.selectedRegionNames.length > 0;
  const shouldUseLegacyDefaultGlobal =
    isLegacyDefaultGlobalPreset(normalizedPreset);
  const matchedRegionIds =
    normalizedPreset.region.enabled && hasPersistedRegionSelection
      ? getMatchingRegionIds(input.regions, normalizedPreset.region, {
          allowEmpty: true,
        })
      : shouldUseLegacyDefaultGlobal
        ? createDefaultSelectedRegionIdSet(input.regions)
        : new Set<string>();
  const regionEnabled =
    canUseRegionFilter &&
    (shouldUseLegacyDefaultGlobal ||
      (normalizedPreset.region.enabled && matchedRegionIds.size > 0));

  return {
    regionEnabled,
    selectedRegionIds: createSelectedRegionIdMap(input.regions, matchedRegionIds, {
      allowEmpty: !regionEnabled,
    }),
    countryEnabled:
      supportsCountryFiltering && normalizedPreset.country.enabled,
    selectedCountryNames: supportsCountryFiltering
      ? dedupeStrings(normalizedPreset.country.selectedCountryNames)
      : [],
    includeAlternateCountries:
      supportsAlternateCountryFiltering &&
      (normalizedPreset.country.includeAlternateCountries ?? false),
    watchlistEnabled:
      supportsWatchlistFiltering && normalizedPreset.watchlist.enabled,
    watchlistThresholdEnabled: supportsWatchlistFiltering
      ? normalizedPreset.watchlist.thresholdEnabled ?? true
      : defaultState.watchlistThresholdEnabled,
    watchlistThreshold: defaultState.watchlistThreshold,
    watchlistEngagementPhaseEnabled: defaultState.watchlistEngagementPhaseEnabled,
    watchlistEngagementPhaseThreshold:
      defaultState.watchlistEngagementPhaseThreshold,
    watchlistPopulationBelieversRuleEnabled: supportsWatchlistFiltering
      ? getNormalizedPopulationBelieversRuleState(normalizedPreset.watchlist).enabled
      : defaultState.watchlistPopulationBelieversRuleEnabled,
    watchlistPopulationBelieversRule: supportsWatchlistFiltering
      ? getNormalizedPopulationBelieversRuleState(normalizedPreset.watchlist).rule
      : defaultState.watchlistPopulationBelieversRule,
    uupgEnabled: supportsUupgFiltering && normalizedPreset.uupg.enabled,
    hotspotsEnabled:
      supportsHotspotsFiltering && (normalizedPreset.hotspots?.enabled ?? false),
    hotspotsMetric: supportsHotspotsFiltering
      ? normalizeHotspotsMetric(normalizedPreset.hotspots?.metric)
      : defaultState.hotspotsMetric,
    hotspotsCountryCount: supportsHotspotsFiltering
      ? normalizeHotspotsCountryCount(normalizedPreset.hotspots?.countryCount)
      : defaultState.hotspotsCountryCount,
    sorting: defaultState.sorting,
  };
}

export function normalizeSavedDatasetFilterState(filters: SavedDatasetFilterState) {
  const populationBelieversRuleState =
    getNormalizedPopulationBelieversRuleState(filters.watchlist);

  return {
    ...filters,
    region: {
      enabled: filters.region?.enabled ?? false,
      selectedRegionIds: dedupeStrings(filters.region?.selectedRegionIds ?? []),
      selectedRegionNames: dedupeRegionNames(
        filters.region?.selectedRegionNames ?? [],
      ),
      enabledCountryNames: dedupeStrings(filters.region?.enabledCountryNames ?? []),
    },
    country: {
      enabled: filters.country?.enabled ?? false,
      selectedCountryNames: dedupeStrings(filters.country?.selectedCountryNames ?? []),
      includeAlternateCountries:
        filters.country?.includeAlternateCountries ?? false,
    },
    watchlist: {
      enabled: filters.watchlist.enabled,
      thresholdEnabled: filters.watchlist.thresholdEnabled ?? true,
      threshold: normalizeWatchlistThreshold(filters.watchlist.threshold),
      engagementPhaseEnabled: true,
      engagementPhaseThreshold: WATCHLIST_FIXED_ENGAGEMENT_PHASE_MIN,
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
      frontierGroupValue: filters.watchlist.frontierGroupValue ?? true,
    },
    uupg: {
      enabled: filters.uupg?.enabled ?? false,
    },
    hotspots: {
      enabled: filters.hotspots?.enabled ?? false,
      metric: normalizeHotspotsMetric(filters.hotspots?.metric),
      countryCount: normalizeHotspotsCountryCount(filters.hotspots?.countryCount),
    },
    sorting: filters.sorting.map((sort) => ({
      id: sort.id,
      desc: sort.desc,
    })),
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
    includeAlternateCountries:
      normalizedFilters.country.includeAlternateCountries ?? false,
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
    frontierGroupValue: normalizedFilters.watchlist.frontierGroupValue ?? true,
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

export function getDatasetHotspotsFilterStateFromSavedView(
  dataset: Pick<DatasetSummary, "columns">,
  filters: SavedDatasetFilterState,
): DatasetHotspotsFilterState {
  const normalizedFilters = normalizeSavedDatasetFilterState(filters);

  return {
    enabled: normalizedFilters.hotspots?.enabled ?? false,
    isSupported: datasetSupportsHotspotsFiltering(dataset),
    metric: normalizeHotspotsMetric(normalizedFilters.hotspots?.metric),
    countryCount: normalizeHotspotsCountryCount(
      normalizedFilters.hotspots?.countryCount,
    ),
  };
}
