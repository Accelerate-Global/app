import { describe, expect, it } from "vitest";

import type { DatasetRowsResponse, DatasetSummary, FilterRegion } from "@/lib/api-types";

import {
  applyDatasetDefaultFilters,
  countDatasetDefaultRows,
  getDatasetDefaultFilters,
  getDatasetDefaultOpenPreset,
  getDatasetDefaultSorting,
} from "@/lib/dataset-default-view";

const baseDataset = {
  id: "dataset-1",
  backingDatasetId: "dataset-source",
  sortOrder: 0,
  fileName: "South Asia",
  blobUrl: "https://example.com/dataset.csv",
  blobPath: "datasets/south-asia.csv",
  isPrimary: false,
  isPublic: true,
  status: "ready",
  rowCount: 0,
  sizeBytes: 100,
  columns: [
    { key: "people_name", label: "People Name", sourceIndex: 0 },
    { key: "geo_country_name", label: "Geo_Country_Name", sourceIndex: 1 },
  ],
  hiddenColumnKeys: [],
  defaultFilters: null,
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} satisfies DatasetSummary;

const rows: DatasetRowsResponse["rows"] = [
  {
    id: "row-1",
    rowIndex: 0,
    data: {
      people_name: "Rana Tharu",
      geo_country_name: "India",
    },
  },
  {
    id: "row-2",
    rowIndex: 1,
    data: {
      people_name: "Tamang",
      geo_country_name: "Nepal",
    },
  },
  {
    id: "row-3",
    rowIndex: 2,
    data: {
      people_name: "Ribeirinho",
      geo_country_name: "Brazil",
    },
  },
];

const regions: FilterRegion[] = [
  {
    id: "region-global",
    name: "Global",
    description: "",
    sortOrder: 1,
    countries: ["Brazil", "India", "Nepal"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "region-south-asia",
    name: "Asia, South",
    description: "",
    sortOrder: 2,
    countries: ["India", "Nepal"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("dataset-default-view", () => {
  it("returns dataset default filters and sorting when present", () => {
    const dataset = {
      ...baseDataset,
      defaultFilters: {
        region: {
          enabled: true,
          selectedRegionIds: ["region-south-asia"],
          selectedRegionNames: ["Asia, South"],
          enabledCountryNames: ["India", "Nepal"],
        },
        country: {
          enabled: false,
          selectedCountryNames: [],
          includeAlternateCountries: false,
        },
        watchlist: {
          enabled: false,
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
          metric: "unique_uupgs" as const,
          countryCount: 10,
        },
        sorting: [{ id: "people_name", desc: true }],
      },
    } satisfies DatasetSummary;

    expect(getDatasetDefaultFilters(dataset)?.region.selectedRegionNames).toEqual([
      "Asia, South",
    ]);
    expect(getDatasetDefaultSorting(dataset)).toEqual([
      { id: "people_name", desc: true },
    ]);
    expect(getDatasetDefaultOpenPreset(dataset)?.region.selectedRegionNames).toEqual([
      "Asia, South",
    ]);
  });

  it("returns null when dataset default filters are absent", () => {
    expect(getDatasetDefaultFilters(baseDataset)).toBeNull();
    expect(getDatasetDefaultOpenPreset(baseDataset)).toBeNull();
    expect(getDatasetDefaultSorting(baseDataset)).toBeNull();
  });

  it("applies default filters and sorting when counting derived rows", () => {
    const dataset = {
      ...baseDataset,
      defaultFilters: {
        region: {
          enabled: true,
          selectedRegionIds: ["region-south-asia"],
          selectedRegionNames: ["Asia, South"],
          enabledCountryNames: ["India", "Nepal"],
        },
        country: {
          enabled: false,
          selectedCountryNames: [],
          includeAlternateCountries: false,
        },
        watchlist: {
          enabled: false,
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
          metric: "unique_uupgs" as const,
          countryCount: 10,
        },
        sorting: [{ id: "people_name", desc: true }],
      },
    } satisfies DatasetSummary;

    const filteredRows = applyDatasetDefaultFilters({
      dataset,
      rows,
      regions,
    });

    expect(filteredRows.map((row) => row.data.people_name)).toEqual([
      "Tamang",
      "Rana Tharu",
    ]);
    expect(
      countDatasetDefaultRows({
        dataset,
        rows,
        regions,
      }),
    ).toBe(2);
  });
});
