import { describe, expect, it } from "vitest";

import { datasetMetadataPatchSchema } from "@/lib/validation";

describe("datasetMetadataPatchSchema", () => {
  it("accepts a public visibility-only update", () => {
    const result = datasetMetadataPatchSchema.safeParse({
      isPublic: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.isPublic).toBe(false);
  });

  it("rejects multiple preset-bearing tags in one dataset payload", () => {
    const result = datasetMetadataPatchSchema.safeParse({
      tags: [
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
            },
            watchlist: {
              enabled: true,
              threshold: 2,
              engagementPhaseThreshold: 6,
              evangelicalPopulationBelieversRule: {
                tiers: [
                  {
                    minPopulation: 0,
                    maxPopulation: null,
                    minBelievers: 50,
                  },
                ],
              },
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
            },
            watchlist: {
              enabled: false,
              threshold: 2,
              engagementPhaseThreshold: 6,
              evangelicalPopulationBelieversRule: {
                tiers: [
                  {
                    minPopulation: 0,
                    maxPopulation: null,
                    minBelievers: 50,
                  },
                ],
              },
              frontierGroupValue: true,
            },
            uupg: {
              enabled: true,
            },
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Only one dataset tag can store an open preset.",
    );
  });

  it("defaults legacy country presets to primary-country-only matching", () => {
    const result = datasetMetadataPatchSchema.safeParse({
      tags: [
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
              enabled: true,
              selectedCountryNames: ["Jordan"],
            },
            watchlist: {
              enabled: false,
              threshold: 2,
              engagementPhaseThreshold: 6,
              frontierGroupValue: true,
            },
            uupg: {
              enabled: false,
            },
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    const tag = result.data.tags?.[0];
    expect(tag?.openPreset?.country.includeAlternateCountries).toBe(false);
  });

  it("defaults missing hotspots presets and accepts explicit hotspots settings", () => {
    const legacyResult = datasetMetadataPatchSchema.safeParse({
      tags: [
        {
          id: "tag-1",
          label: "Legacy",
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
            },
            watchlist: {
              enabled: false,
              threshold: 2,
              engagementPhaseThreshold: 6,
              frontierGroupValue: true,
            },
            uupg: {
              enabled: false,
            },
          },
        },
      ],
    });
    const hotspotsResult = datasetMetadataPatchSchema.safeParse({
      tags: [
        {
          id: "tag-2",
          label: "Hotspots",
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
            },
            watchlist: {
              enabled: false,
              threshold: 2,
              engagementPhaseThreshold: 6,
              frontierGroupValue: true,
            },
            uupg: {
              enabled: false,
            },
            hotspots: {
              enabled: true,
              metric: "population",
              countryCount: 10,
            },
          },
        },
      ],
    });

    expect(legacyResult.success).toBe(true);
    expect(hotspotsResult.success).toBe(true);
    if (!legacyResult.success || !hotspotsResult.success) {
      return;
    }

    const legacyTag = legacyResult.data.tags?.[0];
    const hotspotsTag = hotspotsResult.data.tags?.[0];
    expect(legacyTag?.openPreset?.hotspots).toEqual({
      enabled: false,
      metric: "unique_uupgs",
      countryCount: 10,
    });
    expect(hotspotsTag?.openPreset?.hotspots).toEqual({
      enabled: true,
      metric: "population",
      countryCount: 10,
    });
  });
});
