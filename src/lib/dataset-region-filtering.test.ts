import { describe, expect, it } from "vitest";

import type { DatasetRowsResponse, DatasetSummary } from "@/lib/api-types";
import {
  datasetSupportsRegionFiltering,
  filterDatasetRowsByRegion,
  getEnabledRegionCountryNames,
} from "./dataset-region-filtering";

const rows: DatasetRowsResponse["rows"] = [
  {
    id: "row-1",
    rowIndex: 0,
    data: {
      geo_country_name: "India",
    },
  },
  {
    id: "row-2",
    rowIndex: 1,
    data: {
      geo_country_name: "Nepal",
    },
  },
  {
    id: "row-3",
    rowIndex: 2,
    data: {
      Geo_Country_Name: "",
    },
  },
];

const dataset = {
  id: "dataset-1",
  sortOrder: 0,
  fileName: "Global",
  blobUrl: "https://example.com/dataset.csv",
  blobPath: "datasets/global.csv",
  isPrimary: true,
  status: "ready",
  rowCount: 2,
  sizeBytes: 512,
  columns: [
    {
      key: "geo_country_name",
      label: "Geo_Country_Name",
      sourceIndex: 0,
    },
  ],
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} satisfies DatasetSummary;

describe("dataset-region-filtering", () => {
  it("detects support when the dataset stores normalized column keys", () => {
    expect(datasetSupportsRegionFiltering(dataset)).toBe(true);
  });

  it("builds the union of selected region countries", () => {
    const countries = getEnabledRegionCountryNames(
      [
        {
          id: "region-1",
          name: "South Asia",
          countries: ["India", "Nepal"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "region-2",
          name: "EMENA",
          countries: ["Turkey", "Jordan"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      {
        "region-1": true,
        "region-2": false,
      },
    );

    expect(countries).toEqual(["India", "Nepal"]);
  });

  it("treats no selector choices as all configured regions", () => {
    const countries = getEnabledRegionCountryNames(
      [
        {
          id: "region-1",
          name: "South Asia",
          countries: ["India", "Nepal"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "region-2",
          name: "EMENA",
          countries: ["Turkey", "Jordan"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      {
        "region-1": false,
        "region-2": false,
      },
    );

    expect(countries).toEqual(["India", "Nepal", "Turkey", "Jordan"]);
  });

  it("filters rows by enabled region countries", () => {
    const filteredRows = filterDatasetRowsByRegion(rows, {
      enabled: true,
      isSupported: true,
      hasConfiguredRegions: true,
      enabledCountryNames: ["Nepal"],
    });

    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0]?.id).toBe("row-2");
  });

  it("still reads legacy row keys that use the raw header casing", () => {
    const filteredRows = filterDatasetRowsByRegion(
      [
        {
          id: "row-legacy",
          rowIndex: 0,
          data: {
            Geo_Country_Name: "India",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        hasConfiguredRegions: true,
        enabledCountryNames: ["India"],
      },
    );

    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0]?.id).toBe("row-legacy");
  });

  it("keeps rows from all configured regions when no selectors are enabled", () => {
    const enabledCountryNames = getEnabledRegionCountryNames(
      [
        {
          id: "region-1",
          name: "South Asia",
          countries: ["India", "Nepal"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      {
        "region-1": false,
      },
    );

    const filteredRows = filterDatasetRowsByRegion(rows, {
      enabled: true,
      isSupported: true,
      hasConfiguredRegions: true,
      enabledCountryNames,
    });

    expect(filteredRows).toHaveLength(2);
    expect(filteredRows.map((row) => row.id)).toEqual(["row-1", "row-2"]);
  });

  it("keeps all rows when region filtering is disabled", () => {
    const filteredRows = filterDatasetRowsByRegion(rows, {
      enabled: false,
      isSupported: true,
      hasConfiguredRegions: true,
      enabledCountryNames: ["India"],
    });

    expect(filteredRows).toHaveLength(3);
  });
});
