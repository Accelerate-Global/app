import { describe, expect, it } from "vitest";

import {
  getDatasetOpenPresetTag,
  getDatasetTagIdentity,
  normalizeDatasetTags,
} from "@/lib/dataset-tags";

describe("dataset-tags", () => {
  it("normalizes tag open presets and keeps a single preset-bearing tag discoverable", () => {
    const [tag] = normalizeDatasetTags([
      {
        id: " tag-1 ",
        label: " Watchlist ",
        color: "262531",
        openPreset: {
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
            threshold: 2,
            engagementPhaseThreshold: 6,
            evangelicalBelieversThreshold: 50,
            evangelicalPercentThreshold: 0.05,
            frontierGroupValue: true,
          },
          uupg: {
            enabled: false,
          },
        },
      },
    ]);

    expect(tag).toEqual({
      id: "tag-1",
      label: "Watchlist",
      color: "#262531",
      openPreset: {
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
          threshold: 2,
          engagementPhaseEnabled: true,
          engagementPhaseThreshold: 6,
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
          frontierGroupEnabled: true,
          frontierGroupValue: true,
        },
        uupg: {
          enabled: false,
        },
        hotspots: {
          enabled: false,
          metric: "unique_uupgs",
          countryCount: 10,
        },
      },
    });
    expect(getDatasetOpenPresetTag([tag])).toEqual(tag);
  });

  it("includes the open preset payload in reusable tag identity", () => {
    const baseTag = {
      label: "Watchlist",
      color: "#262531",
    };

    expect(getDatasetTagIdentity(baseTag)).not.toBe(
      getDatasetTagIdentity({
        ...baseTag,
        openPreset: {
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
            threshold: 2,
            engagementPhaseThreshold: 6,
            evangelicalBelieversThreshold: 50,
            evangelicalPercentThreshold: 0.05,
            frontierGroupValue: true,
          },
          uupg: {
            enabled: false,
          },
        },
      }),
    );
  });

  it("returns null when multiple preset-bearing tags are present", () => {
    expect(
      getDatasetOpenPresetTag([
        {
          id: "tag-1",
          label: "Watchlist",
          color: "#262531",
          openPreset: {
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
              threshold: 2,
              engagementPhaseThreshold: 6,
              evangelicalBelieversThreshold: 50,
              evangelicalPercentThreshold: 0.05,
              frontierGroupValue: true,
            },
            uupg: {
              enabled: false,
            },
          },
        },
        {
          id: "tag-2",
          label: "UUPG",
          color: "#fcab2a",
          openPreset: {
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
              enabled: false,
              threshold: 2,
              engagementPhaseThreshold: 6,
              evangelicalBelieversThreshold: 50,
              evangelicalPercentThreshold: 0.05,
              frontierGroupValue: true,
            },
            uupg: {
              enabled: true,
            },
          },
        },
      ]),
    ).toBeNull();
  });
});
