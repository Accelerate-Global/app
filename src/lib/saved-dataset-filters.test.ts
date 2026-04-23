import { describe, expect, it } from "vitest";

import type { SavedDatasetFilterState } from "@/lib/api-types";

import {
  buildSavedDatasetFilterState,
  getInitialDatasetDetailState,
  normalizeSavedDatasetFilterState,
  WATCHLIST_FIXED_THRESHOLD,
} from "./saved-dataset-filters";
import { getDefaultWatchlistJpOnlyEvangelicalRule } from "./watchlist-jp-only-evangelical";

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
    engagementPhaseThreshold: 5,
    engagementPhaseRule: {
      minPhase: 2,
      maxPhase: 5,
    },
    jpOnlyEvangelicalCriteriaEnabled: true,
    jpOnlyEvangelicalRule: getDefaultWatchlistJpOnlyEvangelicalRule(),
  },
  uupg: {
    enabled: false,
    globalEngagementAnywhereEnabled: true,
    frontierGroupEnabled: true,
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

  it("writes custom GSEC and engagement rules when building saved filter state", () => {
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
      watchlistEngagementPhaseRule: {
        minPhase: 1,
        maxPhase: 4,
      },
      watchlistJpOnlyEvangelicalCriteriaEnabled: true,
      watchlistJpOnlyEvangelicalRule: {
        minBelievers: 80,
        maxBelievers: 300_000,
        maxPercentEvangelical: 2.5,
      },
      uupgEnabled: false,
      uupgGlobalEngagementAnywhereEnabled: true,
      uupgFrontierGroupEnabled: true,
      hotspotsEnabled: false,
      hotspotsMetric: "unique_uupgs",
      hotspotsCountryCount: 10,
      sorting: [],
    });

    expect(savedFilters.watchlist.thresholdRuleVersion).toBe(1);
    expect(savedFilters.watchlist.threshold).toBe(5);
    expect(savedFilters.watchlist.engagementPhaseEnabled).toBe(true);
    expect(savedFilters.watchlist.engagementPhaseThreshold).toBe(4);
    expect(savedFilters.watchlist.engagementPhaseRule).toEqual({
      minPhase: 1,
      maxPhase: 4,
    });
    expect(savedFilters.watchlist.jpOnlyEvangelicalCriteriaEnabled).toBe(true);
    expect(savedFilters.watchlist.jpOnlyEvangelicalRule).toEqual({
      minBelievers: 80,
      maxBelievers: 300_000,
      maxPercentEvangelical: 2.5,
    });
    expect(savedFilters.watchlist).not.toHaveProperty(
      "evangelicalPopulationBelieversRuleEnabled",
    );
    expect(savedFilters.watchlist).not.toHaveProperty(
      "evangelicalPopulationBelieversRule",
    );
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

  it("hydrates a versioned custom watchlist threshold when present", () => {
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
          thresholdRuleVersion: 1,
          threshold: 4,
        },
      },
    });

    expect(initialState.watchlistThreshold).toBe(4);
  });

  it("defaults the JP-only evangelical toggle to true when hydrating dataset detail state", () => {
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
          enabled: true,
          thresholdEnabled: true,
          threshold: 2,
          engagementPhaseEnabled: true,
          engagementPhaseThreshold: 2,
        },
      },
    });

    expect(initialState.watchlistJpOnlyEvangelicalCriteriaEnabled).toBe(true);
    expect(initialState.watchlistJpOnlyEvangelicalRule).toEqual(
      getDefaultWatchlistJpOnlyEvangelicalRule(),
    );
  });

  it("hydrates a saved JP-only rule into dataset detail state", () => {
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
          jpOnlyEvangelicalRule: {
            minBelievers: 90,
            maxBelievers: 300_000,
            maxPercentEvangelical: 2.5,
          },
        },
      },
    });

    expect(initialState.watchlistJpOnlyEvangelicalRule).toEqual({
      minBelievers: 90,
      maxBelievers: 300_000,
      maxPercentEvangelical: 2.5,
    });
  });

  it("hydrates a disabled engagement-phase toggle from saved filters", () => {
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
          engagementPhaseEnabled: false,
        },
      },
    });

    expect(initialState.watchlistEngagementPhaseEnabled).toBe(false);
  });

  it("hydrates a saved engagement-phase rule into dataset detail state", () => {
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
          engagementPhaseRule: {
            minPhase: 1,
            maxPhase: 4,
          },
        },
      },
    });

    expect(initialState.watchlistEngagementPhaseRule).toEqual({
      minPhase: 1,
      maxPhase: 4,
    });
    expect(initialState.watchlistEngagementPhaseThreshold).toBe(4);
  });

  it("preserves the JP-only evangelical toggle during normalization", () => {
    const normalizedFilters = normalizeSavedDatasetFilterState({
      ...baseFilters,
      watchlist: {
        ...baseFilters.watchlist,
        jpOnlyEvangelicalCriteriaEnabled: false,
      },
    });

    expect(normalizedFilters.watchlist.jpOnlyEvangelicalCriteriaEnabled).toBe(false);
  });

  it("defaults a missing JP-only rule during normalization", () => {
    const normalizedFilters = normalizeSavedDatasetFilterState({
      ...baseFilters,
      watchlist: {
        enabled: true,
        thresholdEnabled: true,
        threshold: WATCHLIST_FIXED_THRESHOLD,
        engagementPhaseEnabled: true,
        engagementPhaseThreshold: 2,
        jpOnlyEvangelicalCriteriaEnabled: true,
      },
    });

    expect(normalizedFilters.watchlist.jpOnlyEvangelicalRule).toEqual(
      getDefaultWatchlistJpOnlyEvangelicalRule(),
    );
  });

  it("preserves the engagement-phase toggle during normalization", () => {
    const normalizedFilters = normalizeSavedDatasetFilterState({
      ...baseFilters,
      watchlist: {
        ...baseFilters.watchlist,
        engagementPhaseEnabled: false,
      },
    });

    expect(normalizedFilters.watchlist.engagementPhaseEnabled).toBe(false);
  });

  it("defaults missing UUPG child criteria to true during normalization", () => {
    const normalizedFilters = normalizeSavedDatasetFilterState({
      ...baseFilters,
      uupg: {
        enabled: true,
      },
    });

    expect(normalizedFilters.uupg.globalEngagementAnywhereEnabled).toBe(true);
    expect(normalizedFilters.uupg.frontierGroupEnabled).toBe(true);
  });

  it("hydrates legacy enabled UUPG filters with both criteria active", () => {
    const initialState = getInitialDatasetDetailState({
      dataset: {
        columns: [
          {
            key: "engage_global_engagement_anywhere",
            label: "Engage_Global_Engagement_Anywhere",
            sourceIndex: 0,
          },
          {
            key: "christianity_frontier_group",
            label: "Christianity_Frontier_Group",
            sourceIndex: 1,
          },
        ],
      },
      regions: [],
      initialFilters: {
        ...baseFilters,
        uupg: {
          enabled: true,
        },
      },
    });

    expect(initialState.uupgEnabled).toBe(true);
    expect(initialState.uupgGlobalEngagementAnywhereEnabled).toBe(true);
    expect(initialState.uupgFrontierGroupEnabled).toBe(true);
  });

  it("ignores the frontier criterion when the dataset does not support it", () => {
    const initialState = getInitialDatasetDetailState({
      dataset: {
        columns: [
          {
            key: "engage_global_engagement_anywhere",
            label: "Engage_Global_Engagement_Anywhere",
            sourceIndex: 0,
          },
        ],
      },
      regions: [],
      initialFilters: {
        ...baseFilters,
        uupg: {
          enabled: true,
          globalEngagementAnywhereEnabled: true,
          frontierGroupEnabled: true,
        },
      },
    });

    expect(initialState.uupgEnabled).toBe(true);
    expect(initialState.uupgGlobalEngagementAnywhereEnabled).toBe(true);
    expect(initialState.uupgFrontierGroupEnabled).toBe(false);
  });

  it("drops the removed population-vs-believers watchlist rule during normalization", () => {
    const normalizedFilters = normalizeSavedDatasetFilterState({
      ...baseFilters,
      watchlist: {
        ...baseFilters.watchlist,
        evangelicalPopulationBelieversRuleEnabled: true,
        evangelicalPopulationBelieversRule: {
          tiers: [
            {
              minPopulation: 0,
              maxPopulation: null,
              minBelievers: 50,
            },
          ],
        },
      },
    });

    expect(normalizedFilters.watchlist).not.toHaveProperty(
      "evangelicalPopulationBelieversRuleEnabled",
    );
    expect(normalizedFilters.watchlist).not.toHaveProperty(
      "evangelicalPopulationBelieversRule",
    );
  });
});
