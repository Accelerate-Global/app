import { describe, expect, it } from "vitest";

import { datasetMetadataPatchSchema } from "@/lib/validation";

describe("datasetMetadataPatchSchema", () => {
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
});
