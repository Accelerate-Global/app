import { describe, expect, it } from "vitest";

import * as validationModule from "@/lib/validation";
import {
  datasetAssignDerivedViewSchema,
  datasetMetadataPatchSchema,
} from "@/lib/validation";

describe("datasetMetadataPatchSchema", () => {
  it("does not expose the removed filter region editor schema", () => {
    expect("filterRegionPayloadSchema" in validationModule).toBe(false);
  });

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

  it("accepts normalized dataset tags without preset metadata", () => {
    const result = datasetMetadataPatchSchema.safeParse({
      tags: [
        {
          id: "tag-1",
          label: " Watchlist ",
          color: "#262531",
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.tags).toEqual([
      {
        id: "tag-1",
        label: "Watchlist",
        color: "#262531",
      },
    ]);
  });

  it("ignores removed preset metadata in tag payloads", () => {
    const result = datasetMetadataPatchSchema.safeParse({
      tags: [
        {
          id: "tag-1",
          label: "Legacy",
          color: "#262531",
          openPreset: {
            country: {
              enabled: true,
              selectedCountryNames: ["Jordan"],
            },
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.tags).toEqual([
      {
        id: "tag-1",
        label: "Legacy",
        color: "#262531",
      },
    ]);
  });
});

describe("datasetAssignDerivedViewSchema", () => {
  it("accepts a valid persisted filtered-view assignment payload", () => {
    const result = datasetAssignDerivedViewSchema.safeParse({
      sourceDatasetId: "f0000000-0000-4000-8000-000000000099",
      filters: {
        region: {
          enabled: true,
          selectedRegionIds: ["10000000-0000-4000-8000-000000000001"],
          selectedRegionNames: ["Asia, South"],
          enabledCountryNames: ["India", "Nepal"],
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
        sorting: [
          {
            id: "people_name",
            desc: false,
          },
        ],
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.filters.hotspots).toEqual({
      enabled: false,
      metric: "unique_uupgs",
      countryCount: 10,
    });
    expect(result.data.filters.country.includeAlternateCountries).toBe(false);
  });

  it("keeps legacy persisted region labels syntactically valid", () => {
    const result = datasetAssignDerivedViewSchema.safeParse({
      sourceDatasetId: "f0000000-0000-4000-8000-000000000099",
      filters: {
        region: {
          enabled: true,
          selectedRegionIds: ["10000000-0000-4000-8000-000000000001"],
          selectedRegionNames: ["South Asia"],
          enabledCountryNames: ["India", "Nepal"],
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
        sorting: [],
      },
    });

    expect(result.success).toBe(true);
  });

  it("defaults a missing watchlist frontier-group value to true", () => {
    const result = datasetAssignDerivedViewSchema.safeParse({
      sourceDatasetId: "f0000000-0000-4000-8000-000000000099",
      filters: {
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
        },
        uupg: {
          enabled: false,
        },
        sorting: [],
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.filters.watchlist.frontierGroupValue).toBe(true);
  });

  it("rejects invalid region ids inside the saved filter state", () => {
    const result = datasetAssignDerivedViewSchema.safeParse({
      sourceDatasetId: "f0000000-0000-4000-8000-000000000099",
      filters: {
        region: {
          enabled: true,
          selectedRegionIds: ["south-asia"],
          selectedRegionNames: ["Asia, South"],
          enabledCountryNames: ["India"],
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
        sorting: [],
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes("selectedRegionIds"))).toBe(true);
  });
});
