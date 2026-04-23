import { describe, expect, it } from "vitest";

import type { SavedDatasetFilterState } from "@/lib/api-types";
import { DEFAULT_POPULATION_BELIEVERS_RULE } from "@/lib/evangelical-population-believers-rule";

import {
  buildSavedDatasetFilterState,
  getInitialDatasetDetailState,
  normalizeSavedDatasetFilterState,
  WATCHLIST_FIXED_THRESHOLD,
} from "./saved-dataset-filters";

const baseFilters: SavedDatasetFilterState = {
  region: {
    enabled: false,
    selectedRegionIds: [],
    selectedRegionNames: [],
    enabledCountryNames: [],
  },
  country: {
    enabled: false,
    selectedCountryNames: [],
    includeAlternateCountries: false,
  },
  watchlist: {
    enabled: true,
    thresholdEnabled: true,
    threshold: WATCHLIST_FIXED_THRESHOLD,
    engagementPhaseEnabled: true,
    engagementPhaseThreshold: 2,
    evangelicalPopulationBelieversRuleEnabled: true,
    evangelicalPopulationBelieversRule: DEFAULT_POPULATION_BELIEVERS_RULE,
  },
  uupg: {
    enabled: false,
  },
  hotspots: {
    enabled: false,
    metric: "unique_uupgs",
    countryCount: 10,
  },
  sorting: [],
};

describe("saved-dataset-filters watchlist threshold normalization", () => {
  it("normalizes persisted watchlist thresholds to the fixed GSEC rule", () => {
    const normalizedFilters = normalizeSavedDatasetFilterState({
      ...baseFilters,
      watchlist: {
        ...baseFilters.watchlist,
        threshold: 6,
      },
    });

    expect(normalizedFilters.watchlist.threshold).toBe(WATCHLIST_FIXED_THRESHOLD);
  });

  it("writes the fixed GSEC rule when building saved filter state", () => {
    const savedFilters = buildSavedDatasetFilterState({
      regions: [],
      selectedRegionIds: {},
      regionEnabled: false,
      countryEnabled: false,
      selectedCountryNames: [],
      includeAlternateCountries: false,
      watchlistEnabled: true,
      watchlistThresholdEnabled: true,
      watchlistThreshold: 5,
      watchlistEngagementPhaseEnabled: true,
      watchlistEngagementPhaseThreshold: 6,
      watchlistPopulationBelieversRuleEnabled: true,
      watchlistPopulationBelieversRule: DEFAULT_POPULATION_BELIEVERS_RULE,
      uupgEnabled: false,
      hotspotsEnabled: false,
      hotspotsMetric: "unique_uupgs",
      hotspotsCountryCount: 10,
      sorting: [],
    });

    expect(savedFilters.watchlist.threshold).toBe(WATCHLIST_FIXED_THRESHOLD);
  });

  it("ignores historical watchlist thresholds when hydrating dataset detail state", () => {
    const initialState = getInitialDatasetDetailState({
      dataset: {
        columns: [
          {
            key: "christianity_gsec",
            label: "Christianity_GSEC",
            sourceIndex: 0,
          },
          {
            key: "engage_8_phases_of_engagement",
            label: "Engage_8_Phases_of_Engagement",
            sourceIndex: 1,
          },
          {
            key: "pg_population",
            label: "PG_Population",
            sourceIndex: 2,
          },
          {
            key: "percent_evangelical_pgac",
            label: "Percent_Evangelical_PGAC",
            sourceIndex: 3,
          },
        ],
      },
      regions: [],
      initialFilters: {
        ...baseFilters,
        watchlist: {
          ...baseFilters.watchlist,
          threshold: 4,
        },
      },
    });

    expect(initialState.watchlistThreshold).toBe(WATCHLIST_FIXED_THRESHOLD);
  });
});
