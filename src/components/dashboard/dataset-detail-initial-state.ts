import type {
  DatasetHotspotsMetric,
  DatasetSummary,
  FilterRegion,
  PopulationBelieversRule,
  SavedDatasetFilterState,
  SavedDatasetSort,
  WatchlistEngagementPhaseRule,
  WatchlistJpOnlyEvangelicalRule,
} from "@/lib/api-types";
import {
  DEFAULT_HOTSPOTS_COUNTRY_COUNT,
  DEFAULT_HOTSPOTS_METRIC,
  getDatasetFilterSectionSupport,
  normalizeDatasetUupgCriteriaState,
  normalizeHotspotsCountryCount,
  normalizeHotspotsMetric,
} from "@/lib/dataset-filtering";
import { createDefaultPopulationBelieversRule } from "@/lib/evangelical-population-believers-rule";
import { normalizeRegionMatchName } from "@/lib/region-display";
import {
  WATCHLIST_FIXED_THRESHOLD,
  createDefaultSelectedRegionIdSet,
  createSelectedRegionIdMap,
  normalizeDatasetOpenPreset,
  normalizeSelectedRegionIdSet,
} from "@/lib/saved-dataset-filters";
import {
  WATCHLIST_FIXED_ENGAGEMENT_PHASE_MAX,
  getDefaultWatchlistEngagementPhaseRule,
  normalizeWatchlistEngagementPhaseRule,
} from "@/lib/watchlist-engagement-phase";
import {
  getDefaultWatchlistJpOnlyEvangelicalRule,
  normalizeWatchlistJpOnlyEvangelicalRule,
} from "@/lib/watchlist-jp-only-evangelical";

// The flat controlled-input state of the dataset detail view. This shape is an
// implementation detail of the dashboard components; lib/ modules consume the
// canonical wire format (SavedDatasetFilterState) and runtime sections
// (DatasetFilterSections) instead.

function dedupeStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
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
  watchlistEngagementPhaseRule: WatchlistEngagementPhaseRule;
  watchlistJpOnlyEvangelicalCriteriaEnabled: boolean;
  watchlistJpOnlyEvangelicalRule: WatchlistJpOnlyEvangelicalRule;
  watchlistPopulationBelieversRuleEnabled: boolean;
  watchlistPopulationBelieversRule: PopulationBelieversRule;
  uupgEnabled: boolean;
  uupgGlobalEngagementAnywhereEnabled: boolean;
  uupgFrontierGroupEnabled: boolean;
  hotspotsEnabled: boolean;
  hotspotsMetric: DatasetHotspotsMetric;
  hotspotsCountryCount: number;
  sorting: SavedDatasetSort[];
};

function getMatchingRegionIds(
  regions: FilterRegion[],
  filters: SavedDatasetFilterState["region"],
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

function isLegacyDefaultGlobalPreset(
  preset: Pick<SavedDatasetFilterState, "region" | "country">,
) {
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

export function getInitialDatasetDetailState(input: {
  dataset: Pick<DatasetSummary, "columns">;
  regions: FilterRegion[];
  initialFilters?: SavedDatasetFilterState | null;
  initialSorting?: SavedDatasetSort[];
}): InitialDatasetDetailState {
  const sectionSupport = getDatasetFilterSectionSupport(input.dataset);
  const supportsRegionFiltering = sectionSupport.region;
  const supportsCountryFiltering = sectionSupport.country;
  const supportsAlternateCountryFiltering =
    sectionSupport.alternateCountry;
  const supportsWatchlistFiltering = sectionSupport.watchlist;
  const supportsUupgFiltering = sectionSupport.uupg;
  const supportsUupgFrontierFiltering =
    sectionSupport.uupgFrontier;
  const supportsHotspotsFiltering = sectionSupport.hotspots;
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
    watchlistEngagementPhaseThreshold: WATCHLIST_FIXED_ENGAGEMENT_PHASE_MAX,
    watchlistEngagementPhaseRule: getDefaultWatchlistEngagementPhaseRule(),
    watchlistJpOnlyEvangelicalCriteriaEnabled: true,
    watchlistJpOnlyEvangelicalRule: getDefaultWatchlistJpOnlyEvangelicalRule(),
    watchlistPopulationBelieversRuleEnabled: false,
    watchlistPopulationBelieversRule: createDefaultPopulationBelieversRule(),
    uupgEnabled: false,
    uupgGlobalEngagementAnywhereEnabled: true,
    uupgFrontierGroupEnabled: true,
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
  const normalizedUupgCriteria = normalizeDatasetUupgCriteriaState({
    globalEngagementAnywhereEnabled:
      normalizedPreset.uupg.globalEngagementAnywhereEnabled ?? true,
    frontierGroupEnabled: normalizedPreset.uupg.frontierGroupEnabled ?? true,
    frontierGroupSupported: supportsUupgFrontierFiltering,
  });

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
    watchlistThreshold: supportsWatchlistFiltering
      ? normalizedPreset.watchlist.threshold
      : defaultState.watchlistThreshold,
    watchlistEngagementPhaseEnabled: supportsWatchlistFiltering
      ? normalizedPreset.watchlist.engagementPhaseEnabled ?? true
      : defaultState.watchlistEngagementPhaseEnabled,
    watchlistEngagementPhaseThreshold: supportsWatchlistFiltering
      ? normalizedPreset.watchlist.engagementPhaseThreshold
      : defaultState.watchlistEngagementPhaseThreshold,
    watchlistEngagementPhaseRule: supportsWatchlistFiltering
      ? normalizeWatchlistEngagementPhaseRule(
          normalizedPreset.watchlist.engagementPhaseRule,
        )
      : defaultState.watchlistEngagementPhaseRule,
    watchlistJpOnlyEvangelicalCriteriaEnabled: supportsWatchlistFiltering
      ? normalizedPreset.watchlist.jpOnlyEvangelicalCriteriaEnabled ?? true
      : defaultState.watchlistJpOnlyEvangelicalCriteriaEnabled,
    watchlistJpOnlyEvangelicalRule: supportsWatchlistFiltering
      ? normalizeWatchlistJpOnlyEvangelicalRule(
          normalizedPreset.watchlist.jpOnlyEvangelicalRule,
        )
      : defaultState.watchlistJpOnlyEvangelicalRule,
    watchlistPopulationBelieversRuleEnabled:
      defaultState.watchlistPopulationBelieversRuleEnabled,
    watchlistPopulationBelieversRule:
      defaultState.watchlistPopulationBelieversRule,
    uupgEnabled: supportsUupgFiltering && normalizedPreset.uupg.enabled,
    uupgGlobalEngagementAnywhereEnabled:
      supportsUupgFiltering && normalizedPreset.uupg.enabled
        ? normalizedUupgCriteria.globalEngagementAnywhereEnabled
        : defaultState.uupgGlobalEngagementAnywhereEnabled,
    uupgFrontierGroupEnabled:
      supportsUupgFiltering && normalizedPreset.uupg.enabled
        ? normalizedUupgCriteria.frontierGroupEnabled
        : defaultState.uupgFrontierGroupEnabled,
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
