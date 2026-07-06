import type {
  DatasetHotspotsMetric,
  DatasetSummary,
  FilterRegion,
  SavedDatasetFilterState,
  SavedDatasetSort,
  WatchlistEngagementPhaseRule,
  WatchlistJpOnlyEvangelicalRule,
} from "@/lib/api-types";
import {
  getDatasetFilterSectionSupport,
  getSelectedRegionCountryNames,
  type DatasetFilterSections,
  normalizeDatasetUupgCriteriaState,
  type DatasetCountryFilterState,
  type DatasetHotspotsFilterState,
  type DatasetRegionFilterState,
  type DatasetUupgFilterState,
  type DatasetWatchlistFilterState,
  normalizeHotspotsCountryCount,
  normalizeHotspotsMetric,
} from "@/lib/dataset-filtering";
import {
  isGlobalRegionName,
  normalizeRegionDisplayName,
} from "@/lib/region-display";
import { normalizeWatchlistEngagementPhaseRule } from "@/lib/watchlist-engagement-phase";
import { normalizeWatchlistJpOnlyEvangelicalRule } from "@/lib/watchlist-jp-only-evangelical";

export const WATCHLIST_FIXED_THRESHOLD = 2;
export const WATCHLIST_THRESHOLD_MIN = 0;
export const WATCHLIST_THRESHOLD_MAX = 6;
export const WATCHLIST_THRESHOLD_RULE_VERSION = 1 as const;

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

export function createSelectedRegionIdMap(
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

export function createDefaultSelectedRegionIdSet(regions: FilterRegion[]) {
  const globalRegion = findGlobalRegion(regions);

  if (!globalRegion) {
    return new Set<string>();
  }

  return new Set<string>([globalRegion.id]);
}

export function normalizeSelectedRegionIdSet(
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

function shouldUsePersistedWatchlistThresholdRule(
  thresholdRuleVersion: number | null | undefined,
) {
  return thresholdRuleVersion === WATCHLIST_THRESHOLD_RULE_VERSION;
}

function normalizeWatchlistThreshold(
  value: number | null | undefined,
  options?: {
    usePersistedValue?: boolean;
  },
) {
  if (!options?.usePersistedValue) {
    return WATCHLIST_FIXED_THRESHOLD;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return WATCHLIST_FIXED_THRESHOLD;
  }

  return Math.min(
    WATCHLIST_THRESHOLD_MAX,
    Math.max(WATCHLIST_THRESHOLD_MIN, Math.round(value)),
  );
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
  watchlistEngagementPhaseRule?: WatchlistEngagementPhaseRule;
  watchlistJpOnlyEvangelicalCriteriaEnabled: boolean;
  watchlistJpOnlyEvangelicalRule: WatchlistJpOnlyEvangelicalRule;
  uupgEnabled: boolean;
  uupgGlobalEngagementAnywhereEnabled: boolean;
  uupgFrontierGroupEnabled: boolean;
  hotspotsEnabled: boolean;
  hotspotsMetric: DatasetHotspotsMetric;
  hotspotsCountryCount: number;
  sorting: SavedDatasetSort[];
}): SavedDatasetFilterState {
  const normalizedWatchlistThreshold = normalizeWatchlistThreshold(
    input.watchlistThreshold,
    { usePersistedValue: true },
  );
  const normalizedEngagementPhaseRule = normalizeWatchlistEngagementPhaseRule(
    input.watchlistEngagementPhaseRule,
  );

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
      thresholdRuleVersion: WATCHLIST_THRESHOLD_RULE_VERSION,
      threshold: normalizedWatchlistThreshold,
      engagementPhaseEnabled: input.watchlistEngagementPhaseEnabled,
      engagementPhaseThreshold: normalizedEngagementPhaseRule.maxPhase,
      engagementPhaseRule: normalizedEngagementPhaseRule,
      jpOnlyEvangelicalCriteriaEnabled:
        input.watchlistJpOnlyEvangelicalCriteriaEnabled,
      jpOnlyEvangelicalRule: normalizeWatchlistJpOnlyEvangelicalRule(
        input.watchlistJpOnlyEvangelicalRule,
      ),
    },
    uupg: {
      enabled: input.uupgEnabled,
      globalEngagementAnywhereEnabled: input.uupgGlobalEngagementAnywhereEnabled,
      frontierGroupEnabled: input.uupgFrontierGroupEnabled,
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

/**
 * An "open preset" is not a distinct type: it is a normalized
 * `SavedDatasetFilterState` whose sorting is empty, used to open a dataset
 * with a given set of filter sections.
 */
export function buildDatasetOpenPreset(
  filters: SavedDatasetFilterState,
): SavedDatasetFilterState {
  return {
    ...normalizeSavedDatasetFilterState(filters),
    sorting: [],
  };
}

export function normalizeDatasetOpenPreset(
  preset: SavedDatasetFilterState | undefined | null,
) {
  return preset ? buildDatasetOpenPreset(preset) : null;
}

export function normalizeSavedDatasetFilterState(filters: SavedDatasetFilterState) {
  const thresholdRuleVersion = shouldUsePersistedWatchlistThresholdRule(
    filters.watchlist.thresholdRuleVersion,
  )
    ? WATCHLIST_THRESHOLD_RULE_VERSION
    : undefined;
  const normalizedEngagementPhaseRule = normalizeWatchlistEngagementPhaseRule(
    filters.watchlist.engagementPhaseRule,
  );

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
      thresholdRuleVersion,
      threshold: normalizeWatchlistThreshold(filters.watchlist.threshold, {
        usePersistedValue: thresholdRuleVersion === WATCHLIST_THRESHOLD_RULE_VERSION,
      }),
      engagementPhaseEnabled: filters.watchlist.engagementPhaseEnabled ?? true,
      engagementPhaseThreshold: normalizedEngagementPhaseRule.maxPhase,
      engagementPhaseRule: normalizedEngagementPhaseRule,
      jpOnlyEvangelicalCriteriaEnabled:
        filters.watchlist.jpOnlyEvangelicalCriteriaEnabled ?? true,
      jpOnlyEvangelicalRule: normalizeWatchlistJpOnlyEvangelicalRule(
        filters.watchlist.jpOnlyEvangelicalRule,
      ),
      frontierGroupEnabled: filters.watchlist.frontierGroupEnabled ?? true,
      frontierGroupValue: filters.watchlist.frontierGroupValue ?? true,
    },
    uupg: {
      enabled: filters.uupg?.enabled ?? false,
      globalEngagementAnywhereEnabled:
        filters.uupg?.globalEngagementAnywhereEnabled ?? true,
      frontierGroupEnabled: filters.uupg?.frontierGroupEnabled ?? true,
    },
    hotspots: {
      enabled: filters.hotspots?.enabled ?? false,
      metric: normalizeHotspotsMetric(filters.hotspots?.metric),
      countryCount: normalizeHotspotsCountryCount(filters.hotspots?.countryCount),
    },
    sorting: (filters.sorting ?? []).map((sort) => ({
      id: sort.id,
      desc: sort.desc,
    })),
  } satisfies SavedDatasetFilterState;
}

function getDatasetRegionFilterStateFromSavedView(
  dataset: Pick<DatasetSummary, "columns">,
  filters: SavedDatasetFilterState,
): DatasetRegionFilterState {
  const normalizedFilters = normalizeSavedDatasetFilterState(filters);

  return {
    enabled: normalizedFilters.region.enabled,
    isSupported: getDatasetFilterSectionSupport(dataset).region,
    hasConfiguredRegions: normalizedFilters.region.enabledCountryNames.length > 0,
    enabledCountryNames: dedupeStrings(normalizedFilters.region.enabledCountryNames),
  };
}

function getDatasetCountryFilterStateFromSavedView(
  dataset: Pick<DatasetSummary, "columns">,
  filters: SavedDatasetFilterState,
): DatasetCountryFilterState {
  const normalizedFilters = normalizeSavedDatasetFilterState(filters);

  return {
    enabled: normalizedFilters.country.enabled,
    isSupported: getDatasetFilterSectionSupport(dataset).country,
    selectedCountryNames: dedupeStrings(normalizedFilters.country.selectedCountryNames),
    includeAlternateCountries:
      normalizedFilters.country.includeAlternateCountries ?? false,
  };
}

function getDatasetWatchlistFilterStateFromSavedView(
  dataset: Pick<DatasetSummary, "columns">,
  filters: SavedDatasetFilterState,
): DatasetWatchlistFilterState {
  const normalizedFilters = normalizeSavedDatasetFilterState(filters);

  return {
    enabled: normalizedFilters.watchlist.enabled,
    isSupported: getDatasetFilterSectionSupport(dataset).watchlist,
    thresholdEnabled: normalizedFilters.watchlist.thresholdEnabled ?? true,
    threshold: normalizedFilters.watchlist.threshold,
    engagementPhaseEnabled:
      normalizedFilters.watchlist.engagementPhaseEnabled ?? true,
    engagementPhaseThreshold: normalizedFilters.watchlist.engagementPhaseThreshold,
    engagementPhaseRule: normalizeWatchlistEngagementPhaseRule(
      normalizedFilters.watchlist.engagementPhaseRule,
    ),
    jpOnlyEvangelicalCriteriaEnabled:
      normalizedFilters.watchlist.jpOnlyEvangelicalCriteriaEnabled ?? true,
    jpOnlyEvangelicalRule: normalizeWatchlistJpOnlyEvangelicalRule(
      normalizedFilters.watchlist.jpOnlyEvangelicalRule,
    ),
    frontierGroupEnabled:
      normalizedFilters.watchlist.frontierGroupEnabled ?? true,
    frontierGroupValue: normalizedFilters.watchlist.frontierGroupValue ?? true,
  };
}

function getDatasetUupgFilterStateFromSavedView(
  dataset: Pick<DatasetSummary, "columns">,
  filters: SavedDatasetFilterState,
): DatasetUupgFilterState {
  const normalizedFilters = normalizeSavedDatasetFilterState(filters);
  const normalizedCriteria = normalizeDatasetUupgCriteriaState({
    globalEngagementAnywhereEnabled:
      normalizedFilters.uupg.globalEngagementAnywhereEnabled,
    frontierGroupEnabled: normalizedFilters.uupg.frontierGroupEnabled,
    frontierGroupSupported: getDatasetFilterSectionSupport(dataset).uupgFrontier,
  });

  return {
    enabled: normalizedFilters.uupg.enabled,
    isSupported: getDatasetFilterSectionSupport(dataset).uupg,
    globalEngagementAnywhereEnabled:
      normalizedCriteria.globalEngagementAnywhereEnabled,
    frontierGroupEnabled: normalizedCriteria.frontierGroupEnabled,
    frontierGroupSupported: normalizedCriteria.frontierGroupSupported,
  };
}

function getDatasetHotspotsFilterStateFromSavedView(
  dataset: Pick<DatasetSummary, "columns">,
  filters: SavedDatasetFilterState,
): DatasetHotspotsFilterState {
  const normalizedFilters = normalizeSavedDatasetFilterState(filters);

  return {
    enabled: normalizedFilters.hotspots?.enabled ?? false,
    isSupported: getDatasetFilterSectionSupport(dataset).hotspots,
    metric: normalizeHotspotsMetric(normalizedFilters.hotspots?.metric),
    countryCount: normalizeHotspotsCountryCount(
      normalizedFilters.hotspots?.countryCount,
    ),
  };
}

/**
 * The single saved-view -> runtime conversion: parses the persisted wire
 * format into the canonical `DatasetFilterSections` consumed by
 * `applyDatasetFilterSections`. Per-section conversion is implementation.
 */
export function getDatasetFilterSectionsFromSavedView(
  dataset: Pick<DatasetSummary, "columns">,
  filters: SavedDatasetFilterState,
): DatasetFilterSections {
  return {
    region: getDatasetRegionFilterStateFromSavedView(dataset, filters),
    country: getDatasetCountryFilterStateFromSavedView(dataset, filters),
    watchlist: getDatasetWatchlistFilterStateFromSavedView(dataset, filters),
    uupg: getDatasetUupgFilterStateFromSavedView(dataset, filters),
    hotspots: getDatasetHotspotsFilterStateFromSavedView(dataset, filters),
  };
}
